import { expect, test } from '@playwright/test'

import { cleanupTestRepo, createRichTestRepo, type RichRepoFixture } from './helpers/git-fixture'

test.describe('Shared Components E2E (Search, Collapse, Drag, ContextMenu)', () => {
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

  test('Sidebar section collapse/expand and branch search filter', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(fixture.repoDir)}`)

    const branchNav = page.getByRole('navigation', { name: /Branches|分支/i }).first()
    const localSectionBtn = branchNav.getByRole('button', { name: /^Local|^本地/i }).first()
    await expect(localSectionBtn).toBeVisible()
    await expect(localSectionBtn).toHaveAttribute('aria-expanded', 'true')

    const featBranchLeaf = page.getByRole('treeitem', { name: /^ui/i }).first()
    await expect(featBranchLeaf).toBeVisible()

    // Collapse Local section
    await localSectionBtn.click()
    await expect(localSectionBtn).toHaveAttribute('aria-expanded', 'false')
    await expect(featBranchLeaf).toBeHidden()

    // Expand Local section again
    await localSectionBtn.click()
    await expect(localSectionBtn).toHaveAttribute('aria-expanded', 'true')
    await expect(featBranchLeaf).toBeVisible()

    // Open branch search inside Local section and filter
    const searchBtns = branchNav.getByRole('button', { name: /^Search$|^搜索$/i })
    await searchBtns.first().click()
    const searchInput = page.getByPlaceholder(/^Search$|^搜索$/i).first()
    await expect(searchInput).toBeVisible()
    await searchInput.fill('api')

    const localList = branchNav.getByRole('list', { name: /^Local|^本地/i }).first()
    await expect(localList.getByRole('treeitem', { name: /^api/i }).first()).toBeVisible()
    await expect(localList.getByRole('treeitem', { name: /^ui/i })).toHaveCount(0)

    await searchInput.fill('')
    await expect(localList.getByRole('treeitem', { name: /^ui/i }).first()).toBeVisible()
  })

  test('PanelSplitter drag-to-resize updates sidebar and file-tree widths', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(fixture.repoDir)}`)
    await expect(page.getByText('merge: conflicted feat/ui into main').first()).toBeVisible()
    await expect(page.getByRole('status', { name: /Switching repository|正在切换/i })).toHaveCount(0)

    const branchSplitter = page.getByRole('separator', { name: /branch panel|分支面板/i }).first()
    await expect(branchSplitter).toBeAttached()
    const initialBranchWidth = Number(await branchSplitter.getAttribute('aria-valuenow'))
    const box = await branchSplitter.locator('span').first().boundingBox()
    expect(box).not.toBeNull()

    if (box) {
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      await page.mouse.move(cx + 60, cy, { steps: 10 })
      await page.mouse.up()
    }

    await expect.poll(async () => Number(await branchSplitter.getAttribute('aria-valuenow'))).toBeGreaterThan(initialBranchWidth)

    // Select a commit to mount the right file-tree panel and its splitter
    await page.getByText('feat(ui): add sub helper and ui mode').first().click()
    const treeSplitter = page.getByRole('separator', { name: /file tree|文件树/i }).first()
    await expect(treeSplitter).toBeAttached()
    const initialTreeWidth = Number(await treeSplitter.getAttribute('aria-valuenow'))
    const treeBox = await treeSplitter.locator('span').first().boundingBox()
    expect(treeBox).not.toBeNull()

    if (treeBox) {
      const cx = treeBox.x + treeBox.width / 2
      const cy = treeBox.y + treeBox.height / 2
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      await page.mouse.move(cx - 50, cy, { steps: 10 })
      await page.mouse.up()
    }

    await expect.poll(async () => Number(await treeSplitter.getAttribute('aria-valuenow'))).toBeGreaterThan(initialTreeWidth)
  })

  test('Commit file tree collapse/expand, file search, and diff find box', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(fixture.repoDir)}`)
    await page.getByText('feat(ui): add sub helper and ui mode').first().click()

    const treePanel = page.getByRole('complementary', { name: /Files|文件/i }).first()
    await expect(treePanel).toBeVisible()

    // Folder collapse/expand in commit file tree
    const srcFolder = treePanel.getByText('src', { exact: true }).first()
    await expect(srcFolder).toBeVisible()
    const appFile = treePanel.getByText('app.ts', { exact: true }).first()
    await expect(appFile).toBeVisible()

    await srcFolder.click()
    await expect(appFile).toBeHidden()
    await srcFolder.click()
    await expect(appFile).toBeVisible()

    // Filter files using commit panel search button
    await treePanel
      .getByRole('button', { name: /Search|搜索/i })
      .first()
      .click()
    const fileFilterInput = page.getByPlaceholder(/All files|全部文件/i).first()
    await expect(fileFilterInput).toBeVisible()
    await fileFilterInput.fill('math.ts')
    await expect(treePanel.getByText('math.ts', { exact: true }).first()).toBeVisible()
    await expect(treePanel.getByText('app.ts', { exact: true })).toHaveCount(0)

    // Open math.ts diff and test diff search + viewport tabs
    await treePanel.getByText('math.ts', { exact: true }).first().click()
    await expect(page.getByText('export const sub', { exact: false }).first()).toBeVisible()

    await page
      .getByRole('button', { name: /Search content|搜索内容/i })
      .first()
      .click()
    const diffFindInput = page
      .getByRole('region', { name: /Changes|内容变更/i })
      .locator('input')
      .first()
    await expect(diffFindInput).toBeVisible()
    await diffFindInput.fill('sub')
    await page.keyboard.press('Escape')

    // Switch viewport tabs (Full / Split / Grouped)
    const fullTab = page.getByRole('tab', { name: /Full|全文改动/i }).first()
    await fullTab.click()
    await expect(fullTab).toHaveAttribute('aria-selected', 'true')
  })

  test('Context menu opens on right-click and closes on Escape', async ({ page }) => {
    await page.goto(`/git?repo=${encodeURIComponent(fixture.repoDir)}`)
    await expect(page.getByText('merge: conflicted feat/ui into main').first()).toBeVisible()

    const branchNav = page.getByRole('navigation', { name: /Branches|分支/i }).first()
    const branchItem = branchNav.getByRole('treeitem', { name: /^ui/i }).first()
    await expect(branchItem).toBeVisible()
    await branchItem.click({ button: 'right' })

    const menu = page.getByRole('menu').first()
    await expect(menu).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
  })
})
