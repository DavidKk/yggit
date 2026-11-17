import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { detectMergeConflict, getRemergeDiff, readCachedConflicts, writeCachedConflicts } from '@/services/git/conflicts'

describe('git conflict detection service', () => {
  let repo: string
  let cleanMergeHash: string
  let conflictedMergeHash: string
  let p1Hash: string
  let p2Hash: string

  function git(...args: string[]): string {
    return execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.devNull },
    }).trim()
  }

  beforeAll(() => {
    repo = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'yggdrasil-conflict-test-'))
    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Test Author')
    git('config', 'user.email', 'test@example.invalid')

    // Initial commit
    fs.writeFileSync(path.join(repo, 'file1.txt'), 'base\n')
    fs.writeFileSync(path.join(repo, 'file2.txt'), 'base2\n')
    git('add', '.')
    git('commit', '-m', 'Initial commit')

    // Branch feature-clean
    git('checkout', '-b', 'feature-clean')
    fs.writeFileSync(path.join(repo, 'file2.txt'), 'base2-modified\n')
    git('commit', '-am', 'Clean edit in feature')

    // Merge clean into main
    git('checkout', 'main')
    fs.writeFileSync(path.join(repo, 'file3.txt'), 'file3\n')
    git('add', '.')
    git('commit', '-m', 'Main commit file3')
    git('merge', '--no-ff', '-m', 'Clean merge', 'feature-clean')
    cleanMergeHash = git('rev-parse', 'HEAD')

    // Branch feature-conflict
    git('checkout', '-b', 'feature-conflict')
    fs.writeFileSync(path.join(repo, 'conflict.txt'), 'feature version\n')
    git('add', '.')
    git('commit', '-m', 'Feature version')
    p2Hash = git('rev-parse', 'HEAD')

    // Commit conflict on main
    git('checkout', 'main')
    fs.writeFileSync(path.join(repo, 'conflict.txt'), 'main version\n')
    git('add', '.')
    git('commit', '-m', 'Main version')
    p1Hash = git('rev-parse', 'HEAD')

    // Try merge with conflict, resolve it, and commit
    try {
      git('merge', '--no-ff', '-m', 'Conflicted merge', 'feature-conflict')
    } catch {
      // conflict occurred as expected
    }
    fs.writeFileSync(path.join(repo, 'conflict.txt'), 'resolved version\n')
    git('add', 'conflict.txt')
    git('commit', '-m', 'Merge branch feature-conflict (resolved)')
    conflictedMergeHash = git('rev-parse', 'HEAD')
  })

  afterAll(() => {
    fs.rmSync(repo, { recursive: true, force: true })
  })

  it('detects clean merge commit with hasConflict: false', async () => {
    const parents = git('rev-list', '--parents', '-n', '1', cleanMergeHash).split(' ').slice(1)
    const result = await detectMergeConflict(repo, cleanMergeHash, parents)

    expect(result.hasConflict).toBe(false)
    expect(result.status).toBe('clean')
    expect(result.conflictFiles).toEqual([])
  })

  it('detects conflicted merge commit with hasConflict: true and lists conflicted files', async () => {
    const result = await detectMergeConflict(repo, conflictedMergeHash, [p1Hash, p2Hash])

    expect(result.hasConflict).toBe(true)
    expect(result.status).toBe('conflicted')
    expect(result.conflictFiles).toContain('conflict.txt')
  })

  it('reads remerge diff containing resolution', async () => {
    const diffResult = await getRemergeDiff(repo, conflictedMergeHash)
    expect(diffResult.files).toContain('conflict.txt')
    expect(diffResult.diff).toContain('conflict.txt')
  })

  it('persists and retrieves conflicts from file cache', async () => {
    const sampleRecord = {
      hash: conflictedMergeHash,
      hasConflict: true,
      conflictFiles: ['conflict.txt'],
      status: 'conflicted' as const,
      analyzedAt: Date.now(),
    }

    await writeCachedConflicts(repo, { [conflictedMergeHash]: sampleRecord })
    const cached = await readCachedConflicts(repo)
    expect(cached[conflictedMergeHash]).toBeDefined()
    expect(cached[conflictedMergeHash]?.hasConflict).toBe(true)
    expect(cached[conflictedMergeHash]?.conflictFiles).toEqual(['conflict.txt'])
  })
})
