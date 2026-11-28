import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { openMockGitHubInEdgeMode } from './helpers/mock-github'

function runGit(cwd: string, args: string[]): string {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'E2E Bot',
      GIT_AUTHOR_EMAIL: 'e2e@yggit.local',
      GIT_COMMITTER_NAME: 'E2E Bot',
      GIT_COMMITTER_EMAIL: 'e2e@yggit.local',
    },
  }).trim()
}

function createConflictedRepo(): { repoDir: string; mergeHash: string; conflictFile: string } {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yggit-e2e-'))
  const conflictFile = 'app.txt'

  runGit(repoDir, ['init', '-b', 'main'])
  fs.writeFileSync(path.join(repoDir, conflictFile), 'line1\nbase-value\nline3\n')
  runGit(repoDir, ['add', conflictFile])
  runGit(repoDir, ['commit', '-m', 'chore: base commit'])

  runGit(repoDir, ['checkout', '-b', 'branch-theirs'])
  fs.writeFileSync(path.join(repoDir, conflictFile), 'line1\ntheirs-value\nline3\n')
  runGit(repoDir, ['add', conflictFile])
  runGit(repoDir, ['commit', '-m', 'feat: theirs change'])

  runGit(repoDir, ['checkout', 'main'])
  fs.writeFileSync(path.join(repoDir, conflictFile), 'line1\nours-value\nline3\n')
  runGit(repoDir, ['add', conflictFile])
  runGit(repoDir, ['commit', '-m', 'feat: ours change'])

  try {
    runGit(repoDir, ['merge', '--no-ff', 'branch-theirs', '-m', 'merge: conflicted merge'])
  } catch {
    // Expected merge conflict; resolve to create a historical conflicted merge commit
    fs.writeFileSync(path.join(repoDir, conflictFile), 'line1\nours-and-theirs\nline3\n')
    runGit(repoDir, ['add', conflictFile])
    runGit(repoDir, ['commit', '--no-edit'])
  }

  const mergeHash = runGit(repoDir, ['rev-parse', 'HEAD'])
  return { repoDir, mergeHash, conflictFile }
}

test.describe('Yggit Core Git & Edge Parity E2E', () => {
  let repoDir = ''
  let mergeHash = ''
  let conflictFile = 'app.txt'

  test.beforeAll(() => {
    const fixture = createConflictedRepo()
    repoDir = fixture.repoDir
    mergeHash = fixture.mergeHash
    conflictFile = fixture.conflictFile
  })

  test.afterAll(() => {
    if (repoDir && fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true })
    }
  })

  test('Edge mode renders remote GitHub commit with zero /api/git/* server calls', async ({ page }) => {
    test.setTimeout(25_000)
    const apiGitRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/git/')) {
        apiGitRequests.push(`${req.method()} ${req.url()}`)
      }
    })

    await openMockGitHubInEdgeMode(page)
    const historyRegion = page.getByRole('region', { name: /Commit history|提交历史/i }).first()
    const firstCommitMessage = historyRegion.getByRole('row').first().locator('[data-git-message-cell]').first()
    await expect(firstCommitMessage).toBeVisible({ timeout: 15_000 })
    await firstCommitMessage.click()
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain('/commit/')
    await expect(page.getByRole('complementary', { name: /Files|文件/i }).first()).toBeVisible({ timeout: 12_000 })

    expect(apiGitRequests).toEqual([])
  })

  test('Local mode detects merge conflict without refresh and enables 3-way conflict view', async ({ page }) => {
    const conflictBatchCalls: string[] = []
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/git/conflicts')) {
        conflictBatchCalls.push(req.url())
      }
    })

    await page.goto(`/local/git?repo=${encodeURIComponent(repoDir)}`)

    // Verify merge commit appears in history and conflict detection fires automatically without refresh
    await expect(page.getByText('merge: conflicted merge').first()).toBeVisible()
    await expect.poll(() => conflictBatchCalls.length).toBeGreaterThan(0)

    // Navigate directly to the conflicted merge commit + file
    await page.goto(`/local/git?repo=${encodeURIComponent(repoDir)}&hash=${mergeHash}&file=${encodeURIComponent(conflictFile)}`)
    const conflictBtn = page.getByRole('button', { name: /Conflict|冲突/i }).first()
    await expect(conflictBtn).toBeEnabled()

    await conflictBtn.click()
    await expect(page.getByText('ours-value').first()).toBeVisible()
    await expect(page.getByText('theirs-value').first()).toBeVisible()
  })

  test('Switching from Local to Edge mode stops /api/git/* server calls', async ({ page }) => {
    const initialConflictsRes = page.waitForResponse((res) => res.url().includes('/api/git/conflicts'))
    const initialProjectsRes = page.waitForResponse((res) => res.url().includes('/api/git/projects'))
    await page.goto(`/local/git?repo=${encodeURIComponent(repoDir)}`)
    await Promise.all([initialConflictsRes, initialProjectsRes])
    await expect(page.getByText('merge: conflicted merge').first()).toBeVisible()
    await expect(page.getByText(/All history commits loaded|已加载全部/i).first()).toBeVisible()
    // Let initial watch EventSource & canonical path settlement finish before switching mode
    await page.waitForTimeout(200)

    const localBtn = page.getByRole('button', { name: /Local|本地/i }).first()
    await expect(localBtn).toBeVisible()

    const postSwitchApiCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/git/')) {
        postSwitchApiCalls.push(`${req.method()} ${req.url()}`)
      }
    })

    await localBtn.click()
    await expect(page).not.toHaveURL(/\/local\//)
    await expect(page).toHaveURL(/\/git(?:\/|\?|$)/)
    await page.waitForTimeout(300)

    expect(postSwitchApiCalls).toEqual([])
  })
})
