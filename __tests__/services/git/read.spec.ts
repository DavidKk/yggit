import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { GIT_LOG_PAGE_SIZE } from '@/lib/git/identity'
import { readGitHistory, readGitLog } from '@/services/git/read'

jest.mock('@/services/git/projects', () => ({
  rememberLocalProject: jest.fn(async () => undefined),
  writeLastOpenedRepo: jest.fn(),
}))
jest.mock('@/services/git/marks', () => ({
  readBranchMarks: jest.fn(() => ({})),
}))

describe('git stash history', () => {
  let repo: string
  let base: string
  let head: string
  let expected: string[]
  let branchHistory: string[]
  let sideTip: string
  let stashHashes: string[]
  let internalHashes: string[]

  function git(...args: string[]): string {
    return execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.devNull },
    }).trim()
  }

  beforeAll(() => {
    repo = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'yggdrasil-git-stash-'))
    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Test Author')
    git('config', 'user.email', 'test@example.invalid')
    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'base\n')
    git('add', '.')
    git('commit', '-qm', 'base')
    for (let index = 0; index < GIT_LOG_PAGE_SIZE + 2; index++) {
      git('commit', '--allow-empty', '-qm', `history ${index}`)
    }
    base = git('rev-parse', 'HEAD')
    expected = git('log', '--format=%H', 'HEAD').split('\n')
    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'first stash\n')
    git('stash', 'push', '-qm', 'tracked changes')
    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'second stash\n')
    fs.writeFileSync(path.join(repo, 'untracked.txt'), 'untracked changes\n')
    git('stash', 'push', '-uqm', 'with untracked files')
    stashHashes = git('stash', 'list', '--format=%H').split('\n')
    internalHashes = stashHashes.flatMap((hash) => git('rev-parse', `${hash}^2`).split('\n'))
    internalHashes.push(git('rev-parse', 'stash@{0}^3'))
    git('commit', '--allow-empty', '-qm', 'after stashing')
    head = git('rev-parse', 'HEAD')
    git('checkout', '-qb', 'side', `${base}^`)
    git('commit', '--allow-empty', '-qm', 'another branch')
    sideTip = git('rev-parse', 'HEAD')
    git('checkout', '-q', 'main')
    branchHistory = git('log', '--branches', '--tags', '--remotes', 'HEAD', '--date-order', '--format=%H').split('\n')
  })

  afterAll(() => {
    if (repo) fs.rmSync(repo, { recursive: true, force: true })
  })

  it.each(['stash@{0}', 'stash@{1}', 'refs/stash', 'stash'])('preserves branch tips without stash internals when selecting %s', async (ref) => {
    const page = await readGitHistory({ repo, ref })
    expect(page.commits.map((commit) => commit.hash)).toEqual(branchHistory.slice(0, GIT_LOG_PAGE_SIZE))
    expect(page.hasMore).toBe(true)
    expect(page.commits.map((commit) => commit.hash)).toEqual(expect.arrayContaining([head, sideTip, base]))
  })

  it('keeps stash internals out of subsequent pages', async () => {
    const first = await readGitHistory({ repo, ref: 'stash@{0}' })
    const second = await readGitHistory({ repo, ref: 'stash@{0}', skip: first.commits.length })
    expect([...first.commits, ...second.commits].map((commit) => commit.hash)).toEqual(branchHistory)
    expect(second.hasMore).toBe(false)
  })

  it('keeps the selected stash available separately from ordinary commits', async () => {
    const view = await readGitLog({ repo, ref: 'stash@{0}' })
    expect(view.stashes.map((stash) => stash.hash)).toEqual(stashHashes)
    expect(view.stashes[0].base).toBe(base)
    const commits = new Set(view.commits.map((commit) => commit.hash))
    expect(commits.has(head)).toBe(true)
    for (const hash of [...stashHashes, ...internalHashes]) expect(commits.has(hash)).toBe(false)
  })

  it.each(['*', 'main'])('preserves ordinary branch history for %s', async (ref) => {
    const page = await readGitHistory({ repo, ref })
    expect(page.commits.map((commit) => commit.hash)).toEqual((ref === '*' ? branchHistory : [head, ...expected]).slice(0, GIT_LOG_PAGE_SIZE))
    expect(page.hasMore).toBe(true)
  })

  it('loads all branches by default so sidebar navigation does not replace history', async () => {
    const view = await readGitLog({ repo })
    expect(view.commits.map((commit) => commit.hash)).toEqual(branchHistory.slice(0, GIT_LOG_PAGE_SIZE))
    expect(view.commits.some((commit) => commit.hash === sideTip)).toBe(true)
  })
})
