import { expect, test } from '@playwright/test'

test.describe('Workspace, Settings & Yggi Assistant E2E (P2)', () => {
  test('Settings pages render without runtime errors and allow language + theme switching', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    const settingsRoutes = ['/settings/general', '/settings/models', '/settings/mcp', '/settings/skills', '/settings/menus', '/settings/privacy', '/settings/about']
    for (const route of settingsRoutes) {
      await page.goto(route)
      await expect(page.locator('main, [role="main"]').first()).toBeVisible()
    }

    // Switch language to Simplified Chinese and verify UI updates
    const langBtn = page.getByRole('button', { name: /Language|语言/i }).first()
    await expect(langBtn).toBeVisible()
    await langBtn.click()
    await page.getByText('简体中文', { exact: true }).first().click()
    await expect(page.getByRole('link', { name: /设置/i }).first()).toBeVisible()

    // Switch back to English
    await page
      .getByRole('button', { name: /Language|语言/i })
      .first()
      .click()
    await page.getByText('English', { exact: true }).first().click()
    await expect(page.getByRole('link', { name: /Settings/i }).first()).toBeVisible()

    expect(pageErrors).toEqual([])
  })

  test('Model channel create and delete flow uses confirmation modal and returns to list', async ({ page }) => {
    await page.goto('/settings/models/new')

    const channelName = `E2E-Channel-${Date.now()}`
    const nameInput = page.locator('input').first()
    await expect(nameInput).toBeVisible()
    await nameInput.fill(channelName)

    const saveBtn = page.getByRole('button', { name: /Save|Create|保存|创建/i }).first()
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    await expect(page).toHaveURL(/\/settings\/models/, { timeout: 15_000 })
    await expect(page.getByText(channelName).first()).toBeVisible({ timeout: 10_000 })

    // Open channel or delete directly with confirmation
    await page.getByText(channelName).first().click()
    const deleteBtn = page.getByRole('button', { name: /Delete|删除/i }).first()
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    const confirmBtn = page.getByRole('button', { name: /Remove|Delete|Confirm|确认|删除|移除/i }).last()
    await expect(confirmBtn).toBeVisible()
    await confirmBtn.click()

    await expect(page).toHaveURL(/\/settings\/models$/, { timeout: 15_000 })
    await expect(page.getByText(channelName)).toHaveCount(0)
  })

  test('Workdesk, Import, Dev Logs, Dev Studio, and Yggi Assistant drawer render cleanly', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    for (const route of ['/workdesk', '/import', '/dev/logs', '/dev/studio']) {
      await page.goto(route)
      await expect(page.locator('body')).toBeVisible()
    }

    // Wake Yggi assistant drawer on /git/github/DavidKk/yggit
    await page.addInitScript(() => {
      window.localStorage.setItem('yggit.driver_mode', 'edge')
    })
    await page.goto('/git/github/DavidKk/yggit')
    const wakeYggiBtn = page.getByRole('button', { name: /Wake Yggi|唤醒 Yggi/i }).first()
    await expect(wakeYggiBtn).toBeVisible()
    await wakeYggiBtn.click()

    await expect(page.getByText(/Yggi/i).first()).toBeVisible()
    expect(pageErrors).toEqual([])
  })
})
