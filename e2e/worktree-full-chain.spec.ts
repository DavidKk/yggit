import { expect, test } from '@playwright/test'

import { edgeHandleInitScript, serializeDirectoryToTree } from './helpers/edge-handle-mock'
import { cleanupTestRepo, createRepoWithBareRemote, type RemoteRepoFixture, runGit } from './helpers/git-fixture'

test.describe('Worktree -> File Diff -> Stage -> Commit -> Push Full Chain (Local & Edge)', () => {
  let fixture: RemoteRepoFixture

  test.beforeEach(() => {
    fixture = createRepoWithBareRemote()
  })

  test.afterEach(() => {
    cleanupTestRepo(fixture.rootDir)
  })

  test('Local mode: Worktree -> expand files -> view diff -> stage -> commit -> push', async ({ page }) => {
    await page.goto(`/local/git?repo=${encodeURIComponent(fixture.repoDir)}`)

    // 1. Verify Working tree row and click it
    const historyRegion = page.getByRole('region', { name: /Commit history|提交历史/i }).first()
    const worktreeRow = historyRegion.getByRole('row').first()
    await expect(worktreeRow).toBeVisible()
    await expect(worktreeRow).toContainText(/Working tree|工作区/i)
    await worktreeRow.click()

    // 2. Verify Working tree file list and click README.md to view diff content
    const treePanel = page.getByRole('complementary', { name: /Working tree|工作区/i }).first()
    await expect(treePanel).toBeVisible()
    const readmeBtn = treePanel.getByText('README.md', { exact: true }).first()
    await expect(readmeBtn).toBeVisible()
    await expect(treePanel.getByText('worktree.txt', { exact: true }).first()).toBeVisible()
    await readmeBtn.click()

    await expect(page.getByText('Modified in worktree').first()).toBeVisible()

    // 3. Stage all changes and verify Commit button enables
    await treePanel
      .getByRole('button', { name: /Stage All|全部暂存/i })
      .first()
      .click()
    await expect(treePanel.getByText(/Staged Changes|已暂存文件/i).first()).toBeVisible()

    // 4. Commit changes
    const summaryInput = treePanel.getByRole('textbox', { name: /Commit summary|提交摘要/i }).first()
    await summaryInput.fill('feat(e2e): local full chain commit')
    await summaryInput.press('ControlOrMeta+Enter')
    await expect(page.getByText('feat(e2e): local full chain commit').first()).toBeVisible()

    // 5. Push to bare origin remote and verify remote HEAD
    await page
      .getByRole('button', { name: /^Push$|^推送$/i })
      .first()
      .click()
    await expect.poll(() => runGit(fixture.bareDir, ['log', '-n', '1', '--pretty=%s'])).toBe('feat(e2e): local full chain commit')
  })

  test('Edge mode: Worktree -> expand files -> view diff -> stage -> commit -> push with zero /api/git/* calls', async ({ page }) => {
    const apiGitRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/git/')) {
        apiGitRequests.push(`${req.method()} ${req.url()}`)
      }
    })

    const tree = serializeDirectoryToTree(fixture.repoDir, 'e2e-edge-repo')
    const handleId = 'edge_e2e_worktree'

    await page.addInitScript(() => {
      window.localStorage.setItem('yggit.driver_mode', 'edge')
    })
    await page.addInitScript(edgeHandleInitScript, { handleId, tree })

    await page.goto('/git')
    const reAuthBtn = page.getByRole('button', { name: /Select folder to re-authorize|Add local|添加本地/i }).first()
    if (await reAuthBtn.isVisible().catch(() => false)) {
      await reAuthBtn.click()
    } else {
      await page
        .getByRole('button', { name: /No repository open|Project switcher|未打开仓库|项目切换/i })
        .first()
        .click()
      await page
        .getByRole('button', { name: /Add local|添加本地/i })
        .first()
        .click()
    }

    // 1. Verify Working tree row appears in Edge mode
    const historyRegion = page.getByRole('region', { name: /Commit history|提交历史/i }).first()
    const worktreeRow = historyRegion.getByRole('row').first()
    await expect(worktreeRow).toBeVisible()
    await expect(worktreeRow).toContainText(/Working tree|工作区/i)
    await worktreeRow.click()

    // 2. Expand/view files in Working tree and click README.md to view diff content
    const treePanel = page.getByRole('complementary', { name: /Working tree|工作区/i }).first()
    await expect(treePanel).toBeVisible()
    const readmeBtn = treePanel.getByText('README.md', { exact: true }).first()
    await expect(readmeBtn).toBeVisible()
    await readmeBtn.click()

    await expect(page.getByText('Modified in worktree').first()).toBeVisible()

    // 3. Stage all, unstage all, then re-stage all purely in browser (Edge mode)
    await treePanel
      .getByRole('button', { name: /Stage All|全部暂存/i })
      .first()
      .click()
    const unstageAllBtn = treePanel.getByRole('button', { name: /Unstage All|全部取消暂存/i }).first()
    await expect(unstageAllBtn).toBeVisible()
    await unstageAllBtn.click()
    const stageAllBtn = treePanel.getByRole('button', { name: /Stage All|全部暂存/i }).first()
    await expect(stageAllBtn).toBeVisible()
    await stageAllBtn.click()
    await expect(unstageAllBtn).toBeVisible()

    // 4. Commit changes purely in browser (isomorphic-git)
    const summaryInput = treePanel.getByRole('textbox', { name: /Commit summary|提交摘要/i }).first()
    await summaryInput.fill('feat(e2e): edge full chain commit')
    await summaryInput.press('ControlOrMeta+Enter')
    await expect(page.getByText('feat(e2e): edge full chain commit').first()).toBeVisible()

    // 5. Trigger Push in Edge mode: verify Edge driver handles it without /api/git/* calls
    //    and surfaces the explicit pure-browser Edge push boundary error
    await page
      .getByRole('button', { name: /^Push$|^推送$/i })
      .first()
      .click()
    await expect(page.getByText(/Push is not supported in pure-browser Edge mode/i).first()).toBeVisible()
    expect(apiGitRequests).toEqual([])
  })
})
