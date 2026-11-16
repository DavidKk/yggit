import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getGitBranches, getGitRepoSummary } from '@/services/git/agent-impact'

describe('Agent Git Branches & Repo Summary Tools', () => {
  let repo: string

  function git(...args: string[]): string {
    return execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.devNull },
    }).trim()
  }

  beforeAll(() => {
    repo = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'yggdrasil-agent-branches-'))
    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Test Agent')
    git('config', 'user.email', 'agent@example.invalid')
    fs.writeFileSync(path.join(repo, 'file.txt'), 'hello world\n')
    git('add', '.')
    git('commit', '-qm', 'initial commit')
    git('branch', 'feature/test-branch')
    git('branch', 'bugfix/patch-1')
  })

  afterAll(() => {
    fs.rmSync(repo, { recursive: true, force: true })
  })

  it('lists branches accurately with totalCount and local/remote classification', async () => {
    const result = await getGitBranches({ repo })
    expect(result.currentBranch).toBe('main')
    expect(result.totalCount).toBeGreaterThanOrEqual(3)
    expect(result.localCount).toBeGreaterThanOrEqual(3)
    const branchNames = result.branches.map((b) => b.name)
    expect(branchNames).toContain('main')
    expect(branchNames).toContain('feature/test-branch')
    expect(branchNames).toContain('bugfix/patch-1')
  })

  it('retrieves repository summary accurately', async () => {
    const summary = await getGitRepoSummary({ repo })
    expect(summary.currentBranch).toBe('main')
    expect(summary.totalCommits).toBe(1)
    expect(summary.totalBranches).toBe(3)
    expect(summary.latestCommit?.subject).toBe('initial commit')
    expect(summary.latestCommit?.author).toBe('Test Agent')
  })
})
