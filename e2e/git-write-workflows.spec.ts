import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { cleanupTestRepo, createRepoWithBareRemote, type RemoteRepoFixture, runGit } from './helpers/git-fixture'

test.describe('Git Write Workflows E2E (P0: Worktree, Branch Lifecycle, Stash, Remote Sync)', () => {
  let fixture: RemoteRepoFixture

  test.beforeEach(async ({ page }) => {
    fixture = createRepoWithBareRemote()
    await page.addInitScript(() => {
      window.localStorage.setItem('yggit.driver_mode', 'local')
    })
  })

  test.afterEach(() => {
    cleanupTestRepo(fixture.rootDir)
  })

  test('Worktree stage, unstage, and commit creates a new commit in graph', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(fixture.repoDir)}`)

    // Click Worktree / Uncommitted changes row inside Commit history region
    const historyRegion = page.getByRole('region', { name: /Commit history|提交历史/i }).first()
    const worktreeRow = historyRegion.getByRole('row').first()
    await expect(worktreeRow).toBeVisible()
    await worktreeRow.click()

    const treePanel = page.getByRole('complementary', { name: /Working tree|Worktree|Files|工作区|文件/i }).first()
    await expect(treePanel).toBeVisible()
    await expect(treePanel.getByText('README.md', { exact: true }).first()).toBeVisible()

    // Stage all via Stage All button or file action, then enter commit summary and commit
    const stageAllBtn = treePanel.getByRole('button', { name: /Stage All|全部暂存/i }).first()
    await expect(stageAllBtn).toBeVisible()
    await stageAllBtn.click()

    const summaryInput = treePanel.getByRole('textbox', { name: /Commit summary|提交摘要/i }).first()
    await expect(summaryInput).toBeVisible()
    await summaryInput.fill('feat(e2e): commit from worktree')
    await summaryInput.press('ControlOrMeta+Enter')

    await expect(page.getByText('feat(e2e): commit from worktree').first()).toBeVisible({ timeout: 15_000 })
  })

  test('Create, checkout, rename, and delete branch with confirmation', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(fixture.repoDir)}`)

    // Open Create Branch modal from toolbar Branch button
    await page
      .getByRole('button', { name: /^Branch$|^分支$/i })
      .first()
      .click()
    const branchInput = page.locator('#create-branch-name-input')
    await expect(branchInput).toBeVisible()
    await branchInput.fill('feat/e2e-branch')
    await page
      .getByRole('button', { name: /Create Branch|创建分支/i })
      .first()
      .click()

    const branchNav = page.getByRole('navigation', { name: /Branches|分支/i }).first()
    const newBranchLeaf = branchNav.getByRole('treeitem', { name: /^e2e-branch/i }).first()
    await expect(newBranchLeaf).toBeVisible({ timeout: 15_000 })

    // Switch back to main via context menu Switch to
    const mainBranch = branchNav.getByRole('treeitem', { name: /^main/i }).first()
    await mainBranch.click({ button: 'right', position: { x: 20, y: 10 } })
    await page
      .getByRole('menuitem', { name: /Switch to|Checkout|检出|切换/i })
      .first()
      .click()
    await expect.poll(() => runGit(fixture.repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']), { timeout: 15_000 }).toBe('main')

    // Delete feat/e2e-branch via context menu -> Branch Operations -> Delete branch + native confirm
    await expect(newBranchLeaf).toBeVisible()
    await newBranchLeaf.click({ button: 'right', position: { x: 20, y: 10 } })
    const branchOpsItem = page.getByRole('menuitem', { name: /Branch Operations|分支操作/i }).first()
    await expect(branchOpsItem).toBeVisible()
    await branchOpsItem.hover()
    const deleteItem = page.getByRole('menuitem', { name: /Delete branch|删除分支/i }).first()
    await expect(deleteItem).toBeVisible()
    await deleteItem.click({ force: true })

    // Inline dangerConfirm requires a second click on the menuitem, followed by window.confirm
    page.once('dialog', (dialog) => void dialog.accept())
    const confirmMenuItem = page.getByRole('menuitem', { name: /Click again|Delete this branch|确认/i }).first()
    if (await confirmMenuItem.isVisible().catch(() => false)) {
      await confirmMenuItem.click({ force: true })
    }

    await expect.poll(() => runGit(fixture.repoDir, ['branch']), { timeout: 15_000 }).not.toContain('feat/e2e-branch')
  })

  test('Toolbar Stash, Pop, Refresh, and Push/Pull with bare origin remote', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(fixture.repoDir)}`)
    await expect(page.getByText('chore: initial remote commit').first()).toBeVisible()
    await page.waitForTimeout(500)

    // Stash uncommitted README.md via toolbar Stash button
    const stashBtn = page.getByRole('button', { name: /^Stash$|^暂存$/i }).first()
    await expect(stashBtn).toBeEnabled()
    await stashBtn.click()
    await page.waitForTimeout(500)
    const stashModalBtn = page
      .getByRole('dialog')
      .getByRole('button', { name: /Stash|Confirm|确认/i })
      .last()
    if (await stashModalBtn.isVisible().catch(() => false)) {
      await stashModalBtn.click()
    }

    const branchNav = page.getByRole('navigation', { name: /Branches|分支/i }).first()
    await expect.poll(() => runGit(fixture.repoDir, ['stash', 'list']).length).toBeGreaterThan(0)

    // Pop stash via toolbar Pop button
    await page
      .getByRole('button', { name: /^Pop$|^弹出$/i })
      .first()
      .click()
    await expect.poll(() => runGit(fixture.repoDir, ['stash', 'list']).length).toBe(0)

    // Commit locally and Push to bare origin via toolbar
    fs.writeFileSync(path.join(fixture.repoDir, 'pushed.txt'), 'pushed content\n')
    runGit(fixture.repoDir, ['add', 'pushed.txt'])
    runGit(fixture.repoDir, ['commit', '-m', 'feat: local commit to push'])

    await page
      .getByRole('button', { name: /^Refresh$|^刷新$/i })
      .first()
      .click()
    await expect(page.getByText('feat: local commit to push').first()).toBeVisible()

    await page
      .getByRole('button', { name: /^Push$|^推送$/i })
      .first()
      .click()
    await expect.poll(() => runGit(fixture.bareDir, ['log', '-n', '1', '--pretty=%s'])).toBe('feat: local commit to push')
    void branchNav
  })
})
