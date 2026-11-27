import { expect, test } from '@playwright/test'

import { cleanupTestRepo, createRichTestRepo, type RichRepoFixture } from './helpers/git-fixture'

test.describe('Git Main Workflows E2E (Open Local, Branch, File, Context Menus)', () => {
  let fixture: RichRepoFixture

  test.beforeAll(() => {
    fixture = createRichTestRepo()
  })

  test.afterAll(() => {
    cleanupTestRepo(fixture.repoDir)
  })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('yggit.driver_mode', 'local')
    })
  })

  test('Open local repository, inspect branches/tags, and filter in project switcher', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(fixture.repoDir)}`)

    await expect(page.getByText('merge: conflicted feat/ui into main').first()).toBeVisible()
    await expect(page.getByRole('treeitem', { name: /^main/i }).first()).toBeVisible()
    await expect(page.getByRole('treeitem', { name: /^ui/i }).first()).toBeVisible()
    await expect(page.getByRole('treeitem', { name: /^api/i }).first()).toBeVisible()

    // Open project switcher dropdown and verify search input works
    const repoFolderName = fixture.repoDir.split('/').pop() || ''
    const switcherBtn = page.getByRole('button', { name: new RegExp(repoFolderName, 'i') }).first()
    await expect(switcherBtn).toBeVisible()
    await switcherBtn.click()

    const projectDialog = page.getByRole('dialog', { name: /Project switcher|项目切换/i }).first()
    await expect(projectDialog).toBeVisible()
    await projectDialog
      .getByRole('button', { name: /Search projects|搜索项目/i })
      .first()
      .click()
    const projectSearch = page.getByPlaceholder(/Search name|搜索名称/i).first()
    await expect(projectSearch).toBeVisible()
    await projectSearch.fill(repoFolderName)
    await page.keyboard.press('Escape')
  })

  test('Select branches in sidebar and view commit files + diff + history + blame', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(fixture.repoDir)}`)

    // Select branch in sidebar
    const featBranch = page.getByRole('treeitem', { name: /^ui/i }).first()
    await featBranch.click()
    await expect(featBranch).toHaveAttribute('aria-selected', 'true')

    // Click commit row to inspect changed files
    const featCommitRow = page.getByText('feat(ui): add sub helper and ui mode').first()
    await featCommitRow.click()

    const treePanel = page.getByRole('complementary', { name: /Files|文件/i }).first()
    const mathFile = treePanel.getByText('math.ts', { exact: true }).first()
    await expect(mathFile).toBeVisible()
    await mathFile.click()

    // Verify diff content renders and switch between File / Diff / History / Blame tabs
    await expect(page.getByText('export const sub', { exact: false }).first()).toBeVisible()

    const fileTab = page.getByRole('tab', { name: /File View|文件查看/i }).first()
    await fileTab.click()
    await expect(fileTab).toHaveAttribute('aria-selected', 'true')

    const historyTab = page.getByRole('tab', { name: /File History|文件历史/i }).first()
    await historyTab.click()
    await expect(historyTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('feat(ui): add sub helper and ui mode').first()).toBeVisible()

    const blameTab = page.getByRole('tab', { name: /Blame|逐行追溯/i }).first()
    await blameTab.click()
    await expect(blameTab).toHaveAttribute('aria-selected', 'true')
  })

  test('Right-click context menus work across Branch, Commit, and File panels', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(fixture.repoDir)}`)
    await expect(page.getByText('feat(ui): add sub helper and ui mode').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Merge encountered conflicts|冲突/i }).first()).toBeVisible()

    // 1. Branch right-click context menu
    const fixBranch = page.getByRole('treeitem', { name: /^api/i }).first()
    await expect(fixBranch).toBeVisible()
    await fixBranch.click({ button: 'right', position: { x: 20, y: 10 } })

    const branchMenu = page.getByRole('menu').first()
    await expect(branchMenu).toBeVisible()
    await expect(branchMenu.getByRole('menuitem').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(branchMenu).toHaveCount(0)

    // 2. Commit row right-click context menu
    const commitRow = page.getByText('feat(ui): add sub helper and ui mode').first()
    await commitRow.click({ button: 'right' })

    const commitMenu = page.getByRole('menu').first()
    await expect(commitMenu).toBeVisible()
    await expect(commitMenu.getByRole('menuitem', { name: /Copy|复制/i }).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(commitMenu).toHaveCount(0)

    // 3. File item right-click context menu -> open File History from menu
    await commitRow.click()
    const treePanel = page.getByRole('complementary', { name: /Files|文件/i }).first()
    const mathFile = treePanel.getByText('math.ts', { exact: true }).first()
    await expect(mathFile).toBeVisible()
    await mathFile.click({ button: 'right' })

    const fileMenu = page.getByRole('menu').first()
    await expect(fileMenu).toBeVisible()
    const fileHistoryAction = fileMenu.getByRole('menuitem', { name: /History|历史/i }).first()
    await expect(fileHistoryAction).toBeVisible()
    await fileHistoryAction.click()

    await expect(page.getByText('feat(ui): add sub helper and ui mode').first()).toBeVisible()
  })
})
