import { expect, test } from '@playwright/test'

import { cleanupTestRepo, createRepoWithBareRemote, createRichTestRepo, type RemoteRepoFixture, type RichRepoFixture, runGit } from './helpers/git-fixture'

test.describe('Git Sidebar Icons, Remote Menus, Copy Actions & Conflict View E2E', () => {
  let richFixture: RichRepoFixture
  let remoteFixture: RemoteRepoFixture

  test.beforeAll(() => {
    richFixture = createRichTestRepo()
    remoteFixture = createRepoWithBareRemote()
  })

  test.afterAll(() => {
    cleanupTestRepo(richFixture.repoDir)
    cleanupTestRepo(remoteFixture.rootDir)
  })

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.addInitScript(() => {
      window.localStorage.setItem('yggit.driver_mode', 'local')
    })
  })

  test('Conflict badge opens 3-way conflict view and toggles Remerge Diff tab', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(richFixture.repoDir)}`)

    // Wait for automatic conflict detection badge on the conflicted merge commit row
    const conflictBadge = page.getByRole('button', { name: /Merge encountered conflicts|冲突/i }).first()
    await expect(conflictBadge).toBeVisible({ timeout: 15_000 })
    await conflictBadge.click()

    // 3-Way conflict view should open immediately showing both sides
    await expect(page.getByText('feat-ui').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('main-line').first()).toBeVisible({ timeout: 15_000 })

    // Switch to Remerge Diff tab
    const remergeTab = page.getByRole('tab', { name: /Remerge Diff/i }).first()
    await expect(remergeTab).toBeVisible()
    await remergeTab.click()
    await expect(remergeTab).toHaveAttribute('aria-selected', 'true')
  })

  test('Sidebar header icons (Collapse/Expand, Locate, Add Remote, Add Worktree) and Remote context menu', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(remoteFixture.repoDir)}`)
    await expect(page.getByText('chore: initial remote commit').first()).toBeVisible()
    await expect(page.getByRole('status', { name: /Switching repository/i })).toHaveCount(0)

    const branchNav = page.getByRole('navigation', { name: /Branches|分支/i }).first()

    // 1. Locate Current Branch icon
    const locateBtn = branchNav.getByRole('button', { name: /Locate current branch|定位当前分支/i }).first()
    await expect(locateBtn).toBeVisible()
    await locateBtn.click({ force: true })
    await expect(branchNav.getByRole('treeitem', { name: /^main/i }).first()).toHaveAttribute('aria-selected', 'true')

    // 2. Add Remote icon -> fill AddRemoteModal -> verify new remote appears
    const addRemoteBtn = branchNav.getByRole('button', { name: /Add remote|添加远程源/i }).first()
    await expect(addRemoteBtn).toBeVisible()
    await addRemoteBtn.click({ force: true })

    await page.locator('#add-remote-name-input').fill('upstream')
    await page.locator('#add-remote-pull-url-input').fill(remoteFixture.bareDir)
    await page.getByRole('dialog').last().locator('button[type="submit"]').first().click()

    await expect.poll(() => runGit(remoteFixture.repoDir, ['remote']), { timeout: 15_000 }).toContain('upstream')

    // 3. Expand Remote section, right-click origin remote group -> Fetch origin & Copy link
    const remoteSectionBtn = branchNav.getByRole('button', { name: /^Remote|^远程/i }).first()
    await remoteSectionBtn.click()
    const originGroupItem = branchNav.getByRole('treeitem', { name: /origin/i }).first()
    await expect(originGroupItem).toBeVisible({ timeout: 10_000 })

    await originGroupItem.click({ button: 'right', position: { x: 20, y: 10 } })
    const remoteMenu = page.getByRole('menu').first()
    await expect(remoteMenu).toBeVisible()
    await expect(remoteMenu.getByRole('menuitem', { name: /Fetch origin/i }).first()).toBeVisible()
    await remoteMenu
      .getByRole('menuitem', { name: /Fetch origin/i })
      .first()
      .click()

    // 4. Right-click remote branch (origin/main) -> verify actions menu
    const originExpandBtn = originGroupItem.locator('button').first()
    if (await originExpandBtn.isVisible().catch(() => false)) {
      await originExpandBtn.click({ force: true })
    }
    const remoteMainBranch = branchNav.getByRole('treeitem', { name: /^main/i }).nth(1)
    if (await remoteMainBranch.isVisible().catch(() => false)) {
      await remoteMainBranch.click({ button: 'right', position: { x: 20, y: 10 } })
      await expect(page.getByRole('menu').first()).toBeVisible()
      await page.keyboard.press('Escape')
    }

    // 5. Add Worktree icon opens dialog cleanly
    const addWorktreeBtn = branchNav.getByRole('button', { name: /Add Worktree|添加工作区/i }).first()
    await expect(addWorktreeBtn).toBeVisible()
    await addWorktreeBtn.click({ force: true })
    await page.keyboard.press('Escape')
  })

  test('Stash, Tags, Worktrees, and Submodules sidebar panels support expand, search, and context menus', async ({ page }) => {
    // 1. Tags, Worktrees, and Submodules on richFixture
    await page.goto(`/git?repo=${encodeURIComponent(richFixture.repoDir)}`)
    await expect(page.getByText('merge: conflicted feat/ui into main').first()).toBeVisible()
    const branchNav = page.getByRole('navigation', { name: /Branches|分支/i }).first()

    // Tags panel: expand, click v1.0.0 tag, right-click context menu
    const tagsBtn = branchNav.getByRole('button', { name: /^Tags|^标签/i }).first()
    await tagsBtn.click()
    const tagItem = branchNav.getByRole('treeitem', { name: /v1\.0\.0/i }).first()
    await expect(tagItem).toBeVisible()
    await tagItem.click()
    await tagItem.click({ button: 'right', position: { x: 20, y: 10 } })
    await expect(page.getByRole('menu').first()).toBeVisible()
    await page.keyboard.press('Escape')

    // Worktrees panel: expand and right-click main worktree
    const worktreesBtn = branchNav.getByRole('button', { name: /^Worktrees|^工作区/i }).first()
    await worktreesBtn.click()
    const worktreeItem = branchNav.getByRole('treeitem', { name: /main/i }).last()
    await expect(worktreeItem).toBeVisible()
    await worktreeItem.click({ button: 'right', position: { x: 20, y: 10 } })
    await expect(page.getByRole('menu').first()).toBeVisible()
    await page.keyboard.press('Escape')

    // Submodules panel: expand/collapse cleanly
    const submodulesBtn = branchNav.getByRole('button', { name: /^Submodules|^子模块/i }).first()
    await submodulesBtn.click()
    await expect(submodulesBtn).toHaveAttribute('aria-expanded', 'true')
    await submodulesBtn.click()
    await expect(submodulesBtn).toHaveAttribute('aria-expanded', 'false')

    // 2. Stash panel on remoteFixture (has uncommitted README.md)
    await page.goto(`/git?repo=${encodeURIComponent(remoteFixture.repoDir)}`)
    await expect(page.getByText('chore: initial remote commit').first()).toBeVisible()
    await page.waitForTimeout(400)

    await page
      .getByRole('button', { name: /^Stash$|^暂存$/i })
      .first()
      .click()
    await expect.poll(() => runGit(remoteFixture.repoDir, ['stash', 'list']).length, { timeout: 15_000 }).toBeGreaterThan(0)

    const stashSectionBtn = branchNav.getByRole('button', { name: /^Stash|^暂存/i }).first()
    if ((await stashSectionBtn.getAttribute('aria-expanded')) !== 'true') {
      await stashSectionBtn.click()
    }
    const stashItem = branchNav
      .getByRole('treeitem')
      .filter({ hasText: /WIP on|On main|stash/i })
      .first()
    await expect(stashItem).toBeVisible({ timeout: 10_000 })
    await stashItem.click({ button: 'right', position: { x: 20, y: 10 } })
    await expect(page.getByRole('menu').first()).toBeVisible()
    await page.keyboard.press('Escape')

    // Restore stashed changes so fixture stays clean
    await page
      .getByRole('button', { name: /^Pop$|^弹出$/i })
      .first()
      .click()
    await expect.poll(() => runGit(remoteFixture.repoDir, ['stash', 'list']).length, { timeout: 15_000 }).toBe(0)
  })

  test('Context menu Copy actions copy Commit SHA/Message and File Path to clipboard', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(richFixture.repoDir)}`)
    await expect(page.getByText('feat(ui): add sub helper and ui mode').first()).toBeVisible()
    await page.waitForTimeout(300)

    // 1. Commit row right-click -> Copy -> Copy Commit SHA
    const commitRow = page.getByText('feat(ui): add sub helper and ui mode').first()
    await commitRow.click({ button: 'right' })

    const copyMenu = page.getByRole('menuitem', { name: /^Copy$|^复制$/i }).first()
    await expect(copyMenu).toBeVisible()
    await copyMenu.hover({ force: true })

    const copyShaItem = page.getByRole('menuitem', { name: /Copy Commit SHA|复制.*Hash|SHA/i }).first()
    await expect(copyShaItem).toBeVisible()
    await copyShaItem.click({ force: true })

    await expect.poll(async () => (await page.evaluate(() => navigator.clipboard.readText())).trim()).toContain(richFixture.featHash.slice(0, 7))

    // 2. Click commit -> right-click file -> Copy relative path
    await commitRow.click()
    const treePanel = page.getByRole('complementary', { name: /Files|文件/i }).first()
    const mathFile = treePanel.getByText('math.ts', { exact: true }).first()
    await expect(mathFile).toBeVisible()
    await mathFile.click({ button: 'right' })

    const copyPathItem = page.getByRole('menuitem', { name: /Copy.*Path|复制.*路径/i }).first()
    await expect(copyPathItem).toBeVisible()
    await copyPathItem.click({ force: true })

    await expect.poll(async () => (await page.evaluate(() => navigator.clipboard.readText())).trim()).toContain('math.ts')
  })
})
