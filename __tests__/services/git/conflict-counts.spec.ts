import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { devNull, tmpdir } from 'node:os'
import { join } from 'node:path'

import { detectMergeConflict } from '@/services/git/conflicts'

let repo: string
function git(...args: string[]) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()
}
function commitFiles(message: string) {
  git('add', '.')
  git('commit', '-qm', message)
  return git('rev-parse', 'HEAD')
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'yggit-conflict-count-'))
  git('init', '-q', '-b', 'base')
  git('config', 'core.hooksPath', devNull)
  git('config', 'user.name', 'Conflict test')
  git('config', 'user.email', 'test@example.com')
  git('config', 'commit.gpgsign', 'false')
})
afterEach(() => rmSync(repo, { recursive: true, force: true }))

it('counts separate conflict regions, including paths with non-ASCII characters and spaces', async () => {
  const file = '冲突 file.txt'
  const lines = Array.from({ length: 40 }, (_, i) => `unchanged ${i}`)
  writeFileSync(join(repo, file), lines.join('\n') + '\n')
  commitFiles('base')
  git('checkout', '-qb', 'ours')
  const ours = [...lines]
  ours[2] = 'ours first'
  ours[35] = 'ours second'
  writeFileSync(join(repo, file), ours.join('\n') + '\n')
  const p1 = commitFiles('ours')
  git('checkout', '-qb', 'theirs', 'base')
  const theirs = [...lines]
  theirs[2] = 'theirs first'
  theirs[35] = 'theirs second'
  writeFileSync(join(repo, file), theirs.join('\n') + '\n')
  const p2 = commitFiles('theirs')
  const result = await detectMergeConflict(repo, 'merge', [p1, p2])
  expect(result.conflictFiles).toEqual([file])
  expect(result.conflictCount).toBe(1)
  expect(result.conflictFileCounts).toEqual({ [file]: 2 })
  expect(git('status', '--porcelain')).toBe('')
  expect(git('rev-parse', 'HEAD')).toBe(p2)
})

it('counts a binary conflict as one structural conflict', async () => {
  writeFileSync(join(repo, 'image.bin'), Buffer.from([0, 1]))
  commitFiles('base')
  git('checkout', '-qb', 'ours')
  writeFileSync(join(repo, 'image.bin'), Buffer.from([0, 2]))
  const p1 = commitFiles('ours')
  git('checkout', '-qb', 'theirs', 'base')
  writeFileSync(join(repo, 'image.bin'), Buffer.from([0, 3]))
  const p2 = commitFiles('theirs')
  const result = await detectMergeConflict(repo, 'merge', [p1, p2])
  expect(result.conflictFileCounts).toEqual({ 'image.bin': 1 })
})

it('maps two resolved regions from an actual remerge patch to all three blobs', async () => {
  const { getRemergeDiff } = await import('@/services/git/conflicts')
  const { conflictRegions, fileRemergePatch } = await import('@/lib/git/conflict-regions')
  const file = '冲突 file.txt'
  const lines = Array.from({ length: 40 }, (_, i) => `unchanged ${i}`)
  writeFileSync(join(repo, file), lines.join('\n') + '\n')
  commitFiles('base')
  git('checkout', '-qb', 'ours')
  const ours = [...lines]
  ours[2] = 'ours first'
  ours[35] = 'ours second'
  writeFileSync(join(repo, file), ours.join('\n') + '\n')
  const p1 = commitFiles('ours')
  git('checkout', '-qb', 'theirs', 'base')
  const theirs = [...lines]
  theirs[2] = 'theirs first'
  theirs[35] = 'theirs second'
  writeFileSync(join(repo, file), theirs.join('\n') + '\n')
  commitFiles('theirs')
  git('checkout', 'ours')
  try {
    git('merge', '--no-commit', 'theirs')
  } catch {
    /* The merge intentionally conflicts. */
  }
  writeFileSync(join(repo, file), ours.join('\n') + '\n')
  const merged = commitFiles('resolved')
  const { diff, files } = await getRemergeDiff(repo, merged)
  expect(files).toContain(file)
  const regions = conflictRegions(fileRemergePatch(diff, file), [ours.join('\n'), theirs.join('\n')])
  expect(regions.map((region) => region.parents)).toEqual([
    [2, 2],
    [35, 35],
  ])
  expect(regions.map((region) => region.result)).toEqual([2, 35])
  expect(fileRemergePatch(diff, 'other.txt')).toBe('')
  expect(git('rev-parse', `${merged}^1`)).toBe(p1)
  const { readCommitChanges } = await import('@/services/git/show')
  const changed = await readCommitChanges(repo, merged, true)
  expect(changed.files).toEqual([])
  const selected = await readCommitChanges(repo, merged, false, file)
  expect(selected.patch).toBe('')
  expect(selected.content).toContain('ours first')
})

it.each([false, true])('detects markers in the committed result (unresolved: %s)', async (unresolved) => {
  writeFileSync(join(repo, 'file.txt'), 'base\n')
  commitFiles('base')
  git('checkout', '-qb', 'ours')
  writeFileSync(join(repo, 'file.txt'), 'ours\n')
  const p1 = commitFiles('ours')
  git('checkout', '-qb', 'theirs', 'base')
  writeFileSync(join(repo, 'file.txt'), 'theirs\n')
  const p2 = commitFiles('theirs')
  git('checkout', 'ours')
  try {
    git('merge', '--no-commit', 'theirs')
  } catch {
    /* Expected conflict. */
  }
  if (!unresolved) writeFileSync(join(repo, 'file.txt'), 'resolved\n=======\nordinary divider\n')
  const hash = commitFiles('merge result')
  const result = await detectMergeConflict(repo, hash, [p1, p2])
  expect(result.hasConflict).toBe(true)
  expect(result.unresolvedConflictFiles).toEqual(unresolved ? ['file.txt'] : [])
  expect(git('status', '--porcelain')).toBe('')
  expect(git('rev-parse', 'HEAD')).toBe(hash)
})
