import { expect, test } from '@playwright/test'

import { cleanupTestRepo, createRichTestRepo, type RichRepoFixture } from './helpers/git-fixture'

test.describe('Agent CRUD (Model, Skill, MCP) & Runtime Injection E2E', () => {
  let fixture: RichRepoFixture

  test.beforeAll(() => {
    fixture = createRichTestRepo()
  })

  test.afterAll(() => {
    cleanupTestRepo(fixture.repoDir)
  })

  test('Create Model, Skill, and MCP Server, verify runtime injection into gateway payload, then clean up', async ({ page }) => {
    test.setTimeout(45_000)
    const stamp = Date.now()
    const modelName = `E2E-Inject-Model-${stamp}`
    const skillName = `e2e-skill-magic-${stamp}`
    const mcpName = `E2E-MCP-${stamp}`
    const mcpToolName = 'e2e_custom_ping'
    const skillInstruction = `E2E_SKILL_INJECTED_DIRECTIVE_${stamp}`

    // Mock external MCP endpoint for browser discovery (initialize + tools/list)
    await page.route('https://mcp.e2e.local/**', async (route) => {
      const body = route.request().postDataJSON() as { id?: number | string; method?: string } | null
      const method = body?.method || ''
      if (method === 'initialize') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: body?.id ?? 1,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: mcpName, version: '1.0.0' },
            },
          }),
        })
        return
      }
      if (method === 'tools/list') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: body?.id ?? 2,
            result: {
              tools: [
                {
                  name: mcpToolName,
                  description: 'E2E custom ping tool',
                  inputSchema: { type: 'object', properties: { target: { type: 'string' } } },
                },
              ],
            },
          }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jsonrpc: '2.0', id: body?.id ?? 3, result: {} }),
      })
    })

    // 1. Create Model Channel in Local mode
    await page.goto('/local/settings/models/new', { waitUntil: 'networkidle' })
    const modelNameInput = page.getByPlaceholder(/DeepSeek-V3/i).first()
    await expect(modelNameInput).toBeVisible()
    await modelNameInput.fill(modelName)
    await expect(modelNameInput).toHaveValue(modelName)
    await page
      .getByRole('button', { name: /Save|Create|保存|创建/i })
      .first()
      .click()
    await expect(page).not.toHaveURL(/\/settings\/models\/new/)
    await expect(page.getByText(modelName).first()).toBeVisible()

    // 2. Create Custom Skill
    await page.goto('/local/settings/skills/new')
    await page.getByPlaceholder('e.g. Go Concurrency Review').fill(skillName)
    await page.getByPlaceholder(/Briefly describe/i).fill(`Trigger for ${skillName}`)
    await page.getByPlaceholder(/Workflow Instructions/i).fill(`---\nname: ${skillName}\ndescription: Trigger for ${skillName}\n---\n\n# Instructions\n${skillInstruction}\n`)
    await page
      .getByRole('button', { name: /^Save$|^保存$/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/settings\/skills$/)
    await expect(page.getByText(skillName).first()).toBeVisible()

    // 3. Create MCP Server & verify tool discovery
    await page.goto('/local/settings/mcp/new')
    await page.locator('#mcp-server-name').fill(mcpName)
    await page.locator('#mcp-server-url').fill('https://mcp.e2e.local/mcp')
    await page
      .getByRole('button', { name: /Save|Connect|Test|保存|连接/i })
      .last()
      .click()
    await expect(page).toHaveURL(/\/settings\/mcp$/)
    await expect(page.getByText(mcpName).first()).toBeVisible()
    await expect(page.getByText(/1 tools/i).first()).toBeVisible()

    // 4. Open /git, wake Yggi, intercept /api/git/agent/gateway, and verify Skill + MCP injection
    interface GatewayPayload {
      messages?: Array<{ role: string; content: string }>
      tools?: Array<{ function?: { name?: string } }>
    }
    let capturedGatewayPayload: GatewayPayload | null = null
    await page.route('**/api/git/agent/gateway', async (route) => {
      capturedGatewayPayload = route.request().postDataJSON() as GatewayPayload
      const sseBody = [
        `data: ${JSON.stringify({ id: 'e2e-completion', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'E2E_INJECTION_VERIFIED' }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ id: 'e2e-completion', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}`,
        'data: [DONE]',
        '',
      ].join('\n\n')
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody,
      })
    })

    await page.goto(`/local/git?repo=${encodeURIComponent(fixture.repoDir)}`)
    await expect(page.getByText('merge: conflicted feat/ui into main').first()).toBeVisible()

    await page
      .getByRole('button', { name: /Wake Yggi|唤醒 Yggi/i })
      .first()
      .click()
    const yggiInput = page.getByPlaceholder(/Ask about Git history|Ask Yggi|深入追问|向 Yggi 提问/i).last()
    await expect(yggiInput).toBeVisible()

    // Select the newly created model channel in Yggi model picker if needed
    const modelBtn = page.getByRole('button', { name: /Model & Platform|模型与平台/i }).first()
    if (await modelBtn.isVisible().catch(() => false)) {
      await modelBtn.click()
      const targetModelOption = page.getByText(modelName).first()
      if (await targetModelOption.isVisible().catch(() => false)) {
        await targetModelOption.click()
      } else {
        await page.keyboard.press('Escape')
      }
    }

    await yggiInput.fill(`Please execute ${skillName}`)
    await yggiInput.press('Enter')

    await expect.poll(() => capturedGatewayPayload !== null).toBe(true)
    await expect(page.getByText('E2E_INJECTION_VERIFIED').first()).toBeVisible()

    const payload = capturedGatewayPayload as GatewayPayload | null
    // Verify Skill instructions were injected into system/request messages
    const allMessagesText = (payload?.messages || []).map((m) => m.content).join('\n')
    expect(allMessagesText).toContain(skillInstruction)

    // Verify MCP tool definition was injected into payload.tools
    const toolNames = (payload?.tools || []).map((t) => t.function?.name || '')
    expect(toolNames.some((n) => n.includes(mcpToolName))).toBe(true)

    // 5. Clean up created Model, Skill, and MCP Server
    await page.goto('/local/settings/models')
    await page.getByText(modelName).first().click()
    await page
      .getByRole('button', { name: /^Delete$|^删除$/i })
      .first()
      .click()
    await page
      .getByRole('button', { name: /^Remove$|^Delete$|^Confirm$|^确认$|^删除$|^移除$/i })
      .last()
      .click()
    await expect(page).toHaveURL(/\/settings\/models$/)

    await page.goto('/local/settings/skills')
    await page.getByText(skillName).first().click()
    await page
      .getByRole('button', { name: /^Delete$|^删除$/i })
      .first()
      .click()
    const skillConfirm = page.getByRole('button', { name: /^Remove$|^Delete$|^Confirm$|^确认$|^删除$|^移除$/i }).last()
    if (await skillConfirm.isVisible().catch(() => false)) await skillConfirm.click()
    await expect(page).toHaveURL(/\/settings\/skills$/)

    await page.goto('/local/settings/mcp')
    await page.getByText(mcpName).first().click()
    await page
      .getByRole('button', { name: /^Delete$|^删除$/i })
      .first()
      .click()
    const mcpConfirm = page.getByRole('button', { name: /^Remove$|^Delete$|^Confirm$|^确认$|^删除$|^移除$/i }).last()
    if (await mcpConfirm.isVisible().catch(() => false)) await mcpConfirm.click()
    await expect(page).toHaveURL(/\/settings\/mcp$/)
  })
})
