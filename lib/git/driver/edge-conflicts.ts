import { structuredPatch } from 'diff'
import git, { TREE } from 'isomorphic-git'

import type { MergeConflictRecord } from '@/lib/git/conflict-cache'

import type { EdgeRepositoryReader } from './edge-repository-reader'

function containsConflictMarkers(content: string): boolean {
  return /^<{7,} /m.test(content) && /^={7,}$/m.test(content) && /^>{7,} /m.test(content)
}

interface HunkRange {
  start: number
  end: number
  removed: string[]
  added: string[]
}

function extractHunkRanges(baseText: string, targetText: string): HunkRange[] {
  const patch = structuredPatch('file', 'file', baseText, targetText, '', '', { context: 0 })
  return patch.hunks.map((hunk) => {
    const start = hunk.oldStart
    const end = hunk.oldLines === 0 ? hunk.oldStart : hunk.oldStart + hunk.oldLines - 1
    const removed: string[] = []
    const added: string[] = []
    for (const line of hunk.lines) {
      if (line.startsWith('-')) removed.push(line.slice(1))
      else if (line.startsWith('+')) added.push(line.slice(1))
    }
    return { start, end, removed, added }
  })
}

function hunksOverlap(a: HunkRange, b: HunkRange): boolean {
  if (a.removed.length === 0 && b.removed.length === 0) {
    return a.start === b.start
  }
  if (a.removed.length === 0) {
    return a.start >= b.start && a.start <= b.end
  }
  if (b.removed.length === 0) {
    return b.start >= a.start && b.start <= a.end
  }
  return a.start <= b.end && b.start <= a.end
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i])
}

/**
 * Perform pure-JS 3-way conflict detection and generate conflict-marked regions.
 */
export function detectThreeWayConflicts(
  baseText: string,
  oursText: string,
  theirsText: string,
  oursLabel = 'ours',
  theirsLabel = 'theirs'
): { count: number; conflictBlocks: string[] } {
  if (oursText === theirsText) return { count: 0, conflictBlocks: [] }

  const baseLines = baseText ? baseText.split('\n') : []
  const oursHunks = extractHunkRanges(baseText, oursText)
  const theirsHunks = extractHunkRanges(baseText, theirsText)

  if (oursHunks.length === 0 || theirsHunks.length === 0) {
    return { count: 0, conflictBlocks: [] }
  }

  const conflictBlocks: string[] = []
  const usedTheirs = new Set<number>()

  for (const ours of oursHunks) {
    for (let j = 0; j < theirsHunks.length; j++) {
      if (usedTheirs.has(j)) continue
      const theirs = theirsHunks[j]
      if (!hunksOverlap(ours, theirs)) continue
      if (sameLines(ours.added, theirs.added) && sameLines(ours.removed, theirs.removed)) continue

      usedTheirs.add(j)
      const minStart = Math.max(1, Math.min(ours.start, theirs.start))
      const maxEnd = Math.max(ours.end, theirs.end)
      const baseSlice = ours.removed.length === 0 && theirs.removed.length === 0 ? [] : baseLines.slice(minStart - 1, maxEnd)
      const oursDisplay = ours.added.length > 0 || ours.removed.length > 0 ? ours.added : baseSlice
      const theirsDisplay = theirs.added.length > 0 || theirs.removed.length > 0 ? theirs.added : baseSlice

      const block = [
        `@@ -${minStart},${Math.max(1, baseSlice.length)} +${minStart},${oursDisplay.length + theirsDisplay.length + 3} @@`,
        `+<<<<<<< ${oursLabel}`,
        ...oursDisplay.map((l) => `+${l}`),
        `+=======`,
        ...theirsDisplay.map((l) => `+${l}`),
        `+>>>>>>> ${theirsLabel}`,
      ].join('\n')
      conflictBlocks.push(block)
      break
    }
  }

  return { count: conflictBlocks.length, conflictBlocks }
}

async function readBlobText(reader: EdgeRepositoryReader, oid: string | null): Promise<{ text: string; binary: boolean }> {
  if (!oid) return { text: '', binary: false }
  try {
    const { blob } = await git.readBlob({ fs: reader.fs, dir: '/', oid, cache: reader.cache })
    const binary = blob.slice(0, 8000).includes(0)
    return { text: binary ? '' : new TextDecoder().decode(blob), binary }
  } catch {
    return { text: '', binary: false }
  }
}

interface CandidateConflictFile {
  path: string
  baseOid: string | null
  oursOid: string | null
  theirsOid: string | null
  mergedOid: string | null
}

async function findCandidateConflictFiles(reader: EdgeRepositoryReader, hash: string, p1: string, p2: string): Promise<CandidateConflictFile[]> {
  let baseOid: string | null = null
  try {
    const bases = await git.findMergeBase({ fs: reader.fs, dir: '/', oids: [p1, p2], cache: reader.cache })
    baseOid = bases[0] || null
  } catch {
    baseOid = null
  }

  const trees = [TREE({ ref: p1 }), TREE({ ref: p2 }), TREE({ ref: hash }), ...(baseOid ? [TREE({ ref: baseOid })] : [])]
  const candidates: CandidateConflictFile[] = []

  await git.walk({
    fs: reader.fs,
    dir: '/',
    trees,
    cache: reader.cache,
    map: async (filepath, entries) => {
      if (filepath === '.') return undefined
      const [oursEntry, theirsEntry, mergedEntry, baseEntry] = entries || []
      const [oursType, theirsType, mergedType, baseType] = await Promise.all([
        oursEntry?.type().catch(() => null),
        theirsEntry?.type().catch(() => null),
        mergedEntry?.type().catch(() => null),
        baseEntry?.type().catch(() => null),
      ])

      if (oursType === 'tree' || theirsType === 'tree' || mergedType === 'tree' || baseType === 'tree') {
        return undefined
      }

      const [oursSha, theirsSha, mergedSha, baseSha] = await Promise.all([
        oursType === 'blob' ? oursEntry?.oid().catch(() => null) : null,
        theirsType === 'blob' ? theirsEntry?.oid().catch(() => null) : null,
        mergedType === 'blob' ? mergedEntry?.oid().catch(() => null) : null,
        baseType === 'blob' ? baseEntry?.oid().catch(() => null) : null,
      ])

      if (oursSha === theirsSha) return undefined
      if (baseSha && (oursSha === baseSha || theirsSha === baseSha)) return undefined

      candidates.push({
        path: filepath,
        baseOid: baseSha || null,
        oursOid: oursSha || null,
        theirsOid: theirsSha || null,
        mergedOid: mergedSha || null,
      })
      return undefined
    },
  })

  return candidates
}

/**
 * Pure-browser merge conflict detector for Edge directory handles.
 */
export async function detectEdgeMergeConflict(reader: EdgeRepositoryReader, hash: string, parents: string[]): Promise<MergeConflictRecord> {
  if (!parents || parents.length < 2) {
    return { hash, hasConflict: false, status: 'clean', analyzedAt: Date.now() }
  }

  const p1 = parents[0]
  const p2 = parents[1]

  try {
    const candidates = await findCandidateConflictFiles(reader, hash, p1, p2)
    const conflictFiles: string[] = []
    const conflictFileCounts: Record<string, number | null> = {}
    const unresolvedFiles: string[] = []

    for (const item of candidates) {
      const [baseBlob, oursBlob, theirsBlob, mergedBlob] = await Promise.all([
        readBlobText(reader, item.baseOid),
        readBlobText(reader, item.oursOid),
        readBlobText(reader, item.theirsOid),
        readBlobText(reader, item.mergedOid),
      ])

      if (mergedBlob.text && containsConflictMarkers(mergedBlob.text)) {
        unresolvedFiles.push(item.path)
      }

      if (baseBlob.binary || oursBlob.binary || theirsBlob.binary || !item.oursOid || !item.theirsOid) {
        conflictFiles.push(item.path)
        conflictFileCounts[item.path] = 1
        continue
      }

      const { count } = detectThreeWayConflicts(baseBlob.text, oursBlob.text, theirsBlob.text)
      if (count > 0) {
        conflictFiles.push(item.path)
        conflictFileCounts[item.path] = count
      }
    }

    const hasConflict = conflictFiles.length > 0
    return {
      hash,
      hasConflict,
      conflictFiles: hasConflict ? conflictFiles : [],
      conflictCount: conflictFiles.length,
      conflictFileCounts,
      unresolvedConflictFiles: unresolvedFiles,
      parent1: p1,
      parent2: p2,
      status: hasConflict ? 'conflicted' : 'clean',
      analyzedAt: Date.now(),
    }
  } catch {
    return { hash, hasConflict: false, status: 'clean', analyzedAt: Date.now() }
  }
}

/**
 * Build a pure-browser remerge diff with conflict markers for Edge directory handles.
 */
export async function buildEdgeRemergeDiff(reader: EdgeRepositoryReader, hash: string): Promise<{ diff: string; files: string[]; record: MergeConflictRecord | null }> {
  try {
    const { commit } = await git.readCommit({ fs: reader.fs, dir: '/', oid: hash, cache: reader.cache })
    const parents = commit.parent || []
    if (parents.length < 2) return { diff: '', files: [], record: null }

    const [p1, p2] = parents
    const candidates = await findCandidateConflictFiles(reader, hash, p1, p2)
    const diffParts: string[] = []
    const files: string[] = []
    const conflictFileCounts: Record<string, number | null> = {}
    const unresolvedFiles: string[] = []

    for (const item of candidates) {
      const [baseBlob, oursBlob, theirsBlob, mergedBlob] = await Promise.all([
        readBlobText(reader, item.baseOid),
        readBlobText(reader, item.oursOid),
        readBlobText(reader, item.theirsOid),
        readBlobText(reader, item.mergedOid),
      ])

      if (mergedBlob.text && containsConflictMarkers(mergedBlob.text)) {
        unresolvedFiles.push(item.path)
      }

      if (baseBlob.binary || oursBlob.binary || theirsBlob.binary || !item.oursOid || !item.theirsOid) {
        files.push(item.path)
        conflictFileCounts[item.path] = 1
        continue
      }

      const { count, conflictBlocks } = detectThreeWayConflicts(baseBlob.text, oursBlob.text, theirsBlob.text, p1.slice(0, 7), p2.slice(0, 7))
      if (count > 0) {
        files.push(item.path)
        conflictFileCounts[item.path] = count
        diffParts.push(`diff --git a/${item.path} b/${item.path}\n--- a/${item.path}\n+++ b/${item.path}\n${conflictBlocks.join('\n')}`)
      }
    }

    const hasConflict = files.length > 0
    const record: MergeConflictRecord = {
      hash,
      hasConflict,
      conflictFiles: files,
      conflictCount: files.length,
      conflictFileCounts,
      unresolvedConflictFiles: unresolvedFiles,
      parent1: p1,
      parent2: p2,
      status: hasConflict ? 'conflicted' : 'clean',
      analyzedAt: Date.now(),
    }

    return { diff: diffParts.join('\n'), files, record }
  } catch {
    return { diff: '', files: [], record: null }
  }
}
