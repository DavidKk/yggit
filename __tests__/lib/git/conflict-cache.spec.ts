import { type MergeConflictRecord, queryConflictsBatch, saveConflictToCache } from '@/lib/git/conflict-cache'
import * as driverModule from '@/lib/git/driver'

beforeEach(() => {
  jest.spyOn(driverModule, 'getDriverMode').mockReturnValue('local')
})

afterEach(() => {
  jest.restoreAllMocks()
})

const parents = ['first', 'second']
const legacy: MergeConflictRecord = { hash: 'merge', hasConflict: true, conflictFiles: ['file.txt'], status: 'conflicted', analyzedAt: 1 }

it('refreshes legacy conflict records so file region counts are available', async () => {
  const repo = 'conflict-count-cache-migration'
  await saveConflictToCache(repo, legacy)
  const updated = { ...legacy, conflictFileCounts: { 'file.txt': 4 }, unresolvedConflictFiles: [] }
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ conflicts: { merge: updated } }) } as Response)
  const result = await queryConflictsBatch(repo, [{ hash: 'merge', parents }])
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(result.merge.conflictFileCounts).toEqual({ 'file.txt': 4 })
  await queryConflictsBatch(repo, [{ hash: 'merge', parents }])
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('keeps unavailable counts cached without repeatedly rerunning analysis', async () => {
  const repo = 'conflict-count-cache-unavailable'
  await saveConflictToCache(repo, { ...legacy, conflictFileCounts: { 'file.txt': null }, unresolvedConflictFiles: null })
  const fetchMock = jest.spyOn(globalThis, 'fetch')
  const result = await queryConflictsBatch(repo, [{ hash: 'merge', parents }])
  expect(fetchMock).not.toHaveBeenCalled()
  expect(result.merge.conflictFileCounts).toEqual({ 'file.txt': null })
})

it('refreshes counts-only records to inspect committed conflict markers', async () => {
  const repo = 'conflict-result-cache-migration'
  await saveConflictToCache(repo, { ...legacy, conflictFileCounts: { 'file.txt': 1 } })
  const updated = { ...legacy, conflictFileCounts: { 'file.txt': 1 }, unresolvedConflictFiles: ['file.txt'] }
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ conflicts: { merge: updated } }) } as Response)
  const result = await queryConflictsBatch(repo, [{ hash: 'merge', parents }])
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(result.merge.unresolvedConflictFiles).toEqual(['file.txt'])
})
