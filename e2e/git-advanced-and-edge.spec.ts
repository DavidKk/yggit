import { expect, test } from '@playwright/test'

import { cleanupTestRepo, createRichTestRepo, type RichRepoFixture } from './helpers/git-fixture'
import { openMockGitHubInEdgeMode } from './helpers/mock-github'

test.describe('Git Advanced & Edge Flows E2E (P1: Merge Lineage, Solo, Folders, Edge Parity)', () => {
  let fixture: RichRepoFixture

  test.beforeAll(() => {
    fixture = createRichTestRepo()
  })

  test.afterAll(() => {
    cleanupTestRepo(fixture.repoDir)
  })

  test('Merge lineage panel highlights ancestors and locates parent commit', async ({ page }) => {
    await page.goto(`/local/git?repo=${encodeURIComponent(fixture.repoDir)}`)

    // Click the merge commit row
    const mergeRow = page.getByText('merge: conflicted feat/ui into main').first()
    await expect(mergeRow).toBeVisible()
    await mergeRow.click()

    // Merge lineage panel should appear
    const lineagePanel = page.getByRole('region', { name: /Merge|合并/i }).first()
    await expect(lineagePanel).toBeVisible()

    const highlightBtn = lineagePanel.getByRole('button', { name: /Highlight|高亮/i }).first()
    await expect(highlightBtn).toBeVisible()
    await highlightBtn.click()
    await expect(lineagePanel.getByRole('button', { name: /Clear|取消高亮/i }).first()).toBeVisible()
  })

  test('Branch Solo filter isolates branch commits via context menu', async ({ page }) => {
    await page.goto(`/local/git?repo=${encodeURIComponent(fixture.repoDir)}`)
    await expect(page.getByText('merge: conflicted feat/ui into main').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Merge encountered conflicts|冲突/i }).first()).toBeVisible()
    await expect(page.getByRole('status', { name: /Switching repository/i })).toHaveCount(0)

    const branchNav = page.getByRole('navigation', { name: /Branches|分支/i }).first()
    const featLeaf = branchNav.getByRole('treeitem', { name: /^ui/i }).first()
    await expect(featLeaf).toBeVisible()
    await featLeaf.click({ button: 'right', position: { x: 20, y: 10 } })

    const soloItem = page.getByRole('menuitemcheckbox', { name: /Focus Branch|Solo|仅看|聚焦/i }).first()
    await expect(soloItem).toBeVisible()
    await soloItem.click({ force: true })

    // Solo / Focus badge should appear in sidebar and feat/ui commit remains visible
    await expect(branchNav.getByText(/Focus|Solo|聚焦/i).first()).toBeVisible()
    await expect(page.getByText('feat(ui): add sub helper and ui mode').first()).toBeVisible()
  })

  test('Project switcher can create and delete a custom folder', async ({ page }) => {
    await page.goto(`/local/git?repo=${encodeURIComponent(fixture.repoDir)}`)

    const repoFolderName = fixture.repoDir.split('/').pop() || ''
    await page
      .getByRole('button', { name: new RegExp(repoFolderName, 'i') })
      .first()
      .click()

    const projectDialog = page.getByRole('dialog', { name: /Project switcher|项目切换/i }).first()
    await expect(projectDialog).toBeVisible()

    const folderName = `E2E-Folder-${Date.now()}`
    await projectDialog
      .getByRole('button', { name: /New folder|新建文件夹/i })
      .first()
      .click()

    // Fill folder prompt/modal if opened
    const folderInput = page.getByRole('dialog').last().locator('input').first()
    await expect(folderInput).toBeVisible()
    await folderInput.fill(folderName)
    await page.keyboard.press('Enter')

    await expect(projectDialog.getByText(folderName).first()).toBeVisible()

    // Clean up created folder
    const deleteFolderBtn = projectDialog.getByRole('button', { name: new RegExp(`Delete folder ${folderName}|删除.*${folderName}`, 'i') }).first()
    await expect(deleteFolderBtn).toBeVisible()
    await deleteFolderBtn.click()
    const confirmDelete = page
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: /Delete|Confirm|确认|删除/i })
      .last()
    if (await confirmDelete.isVisible().catch(() => false)) {
      await confirmDelete.click()
    }
    await expect(projectDialog.getByText(folderName)).toHaveCount(0)
  })

  test('Edge mode loads remote GitHub repository log, branches, and diff with zero /api/git/* calls', async ({ page }) => {
    test.setTimeout(25_000)
    const apiGitRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/git/')) {
        apiGitRequests.push(`${req.method()} ${req.url()}`)
      }
    })

    await openMockGitHubInEdgeMode(page)
    const branchNav = page.getByRole('navigation', { name: /Branches|分支/i }).first()
    await expect(branchNav.getByText(/mock-edge/i).first()).toBeVisible({ timeout: 12_000 })

    const historyRegion = page.getByRole('region', { name: /Commit history|提交历史/i }).first()
    const firstCommitMessage = historyRegion.getByRole('row').first().locator('[data-git-message-cell]').first()
    await expect(firstCommitMessage).toBeVisible({ timeout: 12_000 })
    await firstCommitMessage.click()
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain('/commit/')
    const treePanel = page.getByRole('complementary', { name: /Files|文件/i }).first()
    await expect(treePanel).toBeVisible({ timeout: 12_000 })
    await expect(treePanel.getByText('README.md', { exact: true }).first()).toBeVisible()
    await treePanel.getByText('README.md', { exact: true }).first().click()
    await expect(page.getByText(/Added offline Edge mock diff line/i).first()).toBeVisible({ timeout: 10_000 })

    await page.waitForTimeout(300)
    expect(apiGitRequests).toEqual([])
  })
})
