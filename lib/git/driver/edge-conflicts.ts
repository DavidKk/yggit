import { structuredPatch } from 'diff'
import git, { TREE } from 'isomorphic-git'

import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import { containsConflictMarkers } from '@/lib/git/conflict-regions'

import type { EdgeRepositoryReader } from './edge-repository-reader'

interface HunkRange {
  /** 0-indexed boundary before the first touched line (equals `oldStart` for pure insertions). */
  left: number
  /** 0-indexed boundary after the last touched line (equals `left` for pure insertions). */
  right: number
  /** 1-based line start in base for header display. */
  start: number
  /** 1-based line end in base for slice display. */
  end: number
  removed: string[]
  added: string[]
}

function extractHunkRanges(baseText: string, targetText: string): HunkRange[] {
  const patch = structuredPatch('file', 'file', baseText, targetText, '', '', { context: 0 })
  return patch.hunks.map((hunk) => {
    const left = Math.max(0, hunk.oldStart - 1)
    const right = left + hunk.oldLines
    const start = hunk.oldStart
    const end = hunk.oldLines === 0 ? hunk.oldStart : hunk.oldStart + hunk.oldLines - 1
    const removed: string[] = []
    const added: string[] = []
    for (const line of hunk.lines) {
      if (line.startsWith('-')) removed.push(line.slice(1))
      else if (line.startsWith('+')) added.push(line.slice(1))
    }
    return { left, right, start, end, removed, added }
  })
}

/**
 * Checks Git xdiff 3-way conflict boundary intersection: edits that touch or share
 * an intervening boundary line (including adjacent line edits and boundary insertions) conflict.
 */
function hunksOverlap(a: HunkRange, b: HunkRange): boolean {
  return a.left <= b.right && b.left <= a.right
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i])
}

function buildConflictBlockLines(oursLabel: string, oursLines: string[], theirsLabel: string, theirsLines: string[]): string[] {
  return [`<<<<<<< ${oursLabel}`, ...oursLines, '=======', ...theirsLines, `>>>>>>> ${theirsLabel}`]
}

/**
 * Perform pure-JS 3-way conflict detection and return both conflict blocks and
 * merged output (used for recursive virtual merge bases).
 */
function mergeThreeWayText(
  baseText: string,
  oursText: string,
  theirsText: string,
  oursLabel = 'ours',
  theirsLabel = 'theirs'
): { count: number; conflictBlocks: string[]; mergedText: string } {
  if (oursText === theirsText) return { count: 0, conflictBlocks: [], mergedText: oursText }

  const baseLines = baseText ? baseText.split('\n') : []
  const oursHunks = extractHunkRanges(baseText, oursText)
  const theirsHunks = extractHunkRanges(baseText, theirsText)

  if (oursHunks.length === 0) return { count: 0, conflictBlocks: [], mergedText: theirsText }
  if (theirsHunks.length === 0) return { count: 0, conflictBlocks: [], mergedText: oursText }

  const conflictBlocks: string[] = []
  const usedTheirs = new Set<number>()
  const regions: Array<{ left: number; right: number; replacement: string[] }> = []

  for (const ours of oursHunks) {
    const matchingIndices: number[] = []
    for (let j = 0; j < theirsHunks.length; j++) {
      if (usedTheirs.has(j)) continue
      if (hunksOverlap(ours, theirsHunks[j])) {
        matchingIndices.push(j)
      }
    }

    if (matchingIndices.length === 0) {
      regions.push({ left: ours.left, right: ours.right, replacement: ours.added })
      continue
    }

    const firstTheirs = theirsHunks[matchingIndices[0]]
    const singleExactMatch =
      matchingIndices.length === 1 &&
      ours.left === firstTheirs.left &&
      ours.right === firstTheirs.right &&
      sameLines(ours.added, firstTheirs.added) &&
      sameLines(ours.removed, firstTheirs.removed)

    for (const j of matchingIndices) usedTheirs.add(j)

    if (singleExactMatch) {
      regions.push({ left: ours.left, right: ours.right, replacement: ours.added })
      continue
    }

    const unionLeft = Math.min(ours.left, ...matchingIndices.map((j) => theirsHunks[j].left))
    const unionRight = Math.max(ours.right, ...matchingIndices.map((j) => theirsHunks[j].right))
    const minStart = Math.max(1, unionLeft + 1)
    const baseSlice = unionRight > unionLeft ? baseLines.slice(unionLeft, unionRight) : []

    const oursDisplay = applyHunksToSlice(baseLines, unionLeft, unionRight, [ours])
    const theirsDisplay = applyHunksToSlice(
      baseLines,
      unionLeft,
      unionRight,
      matchingIndices.map((j) => theirsHunks[j])
    )

    if (sameLines(oursDisplay, theirsDisplay)) {
      regions.push({ left: unionLeft, right: unionRight, replacement: oursDisplay })
      continue
    }

    const markerLines = buildConflictBlockLines(oursLabel, oursDisplay, theirsLabel, theirsDisplay)
    regions.push({ left: unionLeft, right: unionRight, replacement: markerLines })

    const block = [`@@ -${minStart},${Math.max(1, baseSlice.length)} +${minStart},${markerLines.length} @@`, ...markerLines.map((l) => `-${l}`)].join('\n')
    conflictBlocks.push(block)
  }

  for (let j = 0; j < theirsHunks.length; j++) {
    if (usedTheirs.has(j)) continue
    const theirs = theirsHunks[j]
    regions.push({ left: theirs.left, right: theirs.right, replacement: theirs.added })
  }

  regions.sort((a, b) => a.left - b.left || a.right - b.right)
  const mergedLines: string[] = []
  let cursor = 0
  for (const reg of regions) {
    if (reg.left > cursor) {
      mergedLines.push(...baseLines.slice(cursor, reg.left))
    }
    mergedLines.push(...reg.replacement)
    cursor = Math.max(cursor, reg.right)
  }
  if (cursor < baseLines.length) {
    mergedLines.push(...baseLines.slice(cursor))
  }

  return {
    count: conflictBlocks.length,
    conflictBlocks,
    mergedText: mergedLines.join('\n'),
  }
}

function applyHunksToSlice(baseLines: string[], sliceLeft: number, sliceRight: number, hunks: HunkRange[]): string[] {
  const sorted = hunks.slice().sort((a, b) => a.left - b.left || a.right - b.right)
  const out: string[] = []
  let cursor = sliceLeft
  for (const hunk of sorted) {
    const start = Math.max(cursor, hunk.left)
    if (start > cursor) {
      out.push(...baseLines.slice(cursor, start))
    }
    out.push(...hunk.added)
    cursor = Math.max(cursor, Math.min(sliceRight, hunk.right))
  }
  if (cursor < sliceRight) {
    out.push(...baseLines.slice(cursor, sliceRight))
  }
  return out
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
): { count: number; conflictBlocks: string[]; mergedText: string } {
  return mergeThreeWayText(baseText, oursText, theirsText, oursLabel, theirsLabel)
}

function buildRemergeFileDiff(filepath: string, preimageText: string, postimageText: string, fallbackBlocks: string[]): string {
  const patch = structuredPatch(`a/${filepath}`, `b/${filepath}`, preimageText, postimageText, '', '', { context: 3 })
  if (patch.hunks.length > 0) {
    const hunkText = patch.hunks.map((h) => `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@\n${h.lines.join('\n')}`).join('\n')
    return `diff --git a/${filepath} b/${filepath}\n--- a/${filepath}\n+++ b/${filepath}\n${hunkText}`
  }
  if (fallbackBlocks.length > 0) {
    return `diff --git a/${filepath} b/${filepath}\n--- a/${filepath}\n+++ b/${filepath}\n${fallbackBlocks.join('\n')}`
  }
  return ''
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

async function readBlobAtCommit(reader: EdgeRepositoryReader, commitOid: string, filepath: string): Promise<{ oid: string | null; text: string; binary: boolean }> {
  try {
    const { oid } = await git.readBlob({ fs: reader.fs, dir: '/', oid: commitOid, filepath, cache: reader.cache })
    const textRes = await readBlobText(reader, oid)
    return { oid, ...textRes }
  } catch {
    return { oid: null, text: '', binary: false }
  }
}

/**
 * Recursively synthesize a virtual base file text across multiple criss-cross merge bases,
 * matching Git ORT / recursive merge behavior when `git.findMergeBase` returns >1 LCAs.
 */
async function resolveVirtualBaseText(
  reader: EdgeRepositoryReader,
  filepath: string,
  baseCommits: string[],
  baseOids: Array<string | null>,
  depth = 0
): Promise<{ text: string; binary: boolean; hasBase: boolean }> {
  const present = baseOids.filter((id): id is string => Boolean(id))
  if (present.length === 0) {
    return { text: '', binary: false, hasBase: false }
  }
  const unique = new Set(baseOids)
  if (unique.size === 1 && present[0]) {
    const blob = await readBlobText(reader, present[0])
    return { ...blob, hasBase: true }
  }

  let accCommit = baseCommits[0]
  let accBlob = await readBlobText(reader, baseOids[0])
  if (accBlob.binary) return { text: '', binary: true, hasBase: true }

  for (let i = 1; i < baseCommits.length; i++) {
    const nextCommit = baseCommits[i]
    const nextBlob = await readBlobText(reader, baseOids[i])
    if (nextBlob.binary) return { text: '', binary: true, hasBase: true }
    if (accBlob.text === nextBlob.text) {
      accCommit = nextCommit
      continue
    }

    let ancestorText = ''
    if (depth < 2) {
      const subBases = await git.findMergeBase({ fs: reader.fs, dir: '/', oids: [accCommit, nextCommit], cache: reader.cache }).catch(() => [])
      if (subBases.length === 1) {
        const sub = await readBlobAtCommit(reader, subBases[0], filepath)
        if (sub.binary) return { text: '', binary: true, hasBase: true }
        ancestorText = sub.text
      } else if (subBases.length > 1) {
        const subOids = await Promise.all(subBases.slice(0, 3).map(async (b) => (await readBlobAtCommit(reader, b, filepath)).oid))
        const nested = await resolveVirtualBaseText(reader, filepath, subBases.slice(0, 3), subOids, depth + 1)
        if (nested.binary) return { text: '', binary: true, hasBase: true }
        ancestorText = nested.text
      }
    }

    const merged = mergeThreeWayText(ancestorText, accBlob.text, nextBlob.text, accCommit.slice(0, 7), nextCommit.slice(0, 7))
    accBlob = { text: merged.mergedText, binary: false }
    accCommit = nextCommit
  }

  return { text: accBlob.text, binary: false, hasBase: true }
}

interface CandidateConflictFile {
  path: string
  baseCommits: string[]
  baseOids: Array<string | null>
  oursOid: string | null
  theirsOid: string | null
  mergedOid: string | null
  structuralConflict?: boolean
}

async function findCandidateConflictFiles(reader: EdgeRepositoryReader, hash: string, p1: string, p2: string): Promise<CandidateConflictFile[]> {
  let bases: string[] = []
  try {
    bases = await git.findMergeBase({ fs: reader.fs, dir: '/', oids: [p1, p2], cache: reader.cache })
  } catch {
    bases = []
  }

  const baseCommits = bases.slice(0, 4)
  const trees = [TREE({ ref: p1 }), TREE({ ref: p2 }), TREE({ ref: hash }), ...baseCommits.map((b) => TREE({ ref: b }))]
  const candidates: CandidateConflictFile[] = []
  const deletedInBoth: Array<{ path: string; baseOid: string; mergedOid: string | null }> = []
  const addedOids = new Set<string>()

  await git.walk({
    fs: reader.fs,
    dir: '/',
    trees,
    cache: reader.cache,
    map: async (filepath, entries) => {
      if (filepath === '.') return undefined
      const [oursEntry, theirsEntry, mergedEntry, ...baseEntries] = entries || []
      const [oursType, theirsType, mergedType, ...baseTypes] = await Promise.all([
        oursEntry?.type().catch(() => null),
        theirsEntry?.type().catch(() => null),
        mergedEntry?.type().catch(() => null),
        ...baseEntries.map((entry) => entry?.type().catch(() => null)),
      ])

      const isTreeMismatch =
        (oursType === 'tree' && (theirsType === 'blob' || theirsType === 'commit')) || (theirsType === 'tree' && (oursType === 'blob' || oursType === 'commit'))

      if (isTreeMismatch) {
        candidates.push({
          path: filepath,
          baseCommits,
          baseOids: [],
          oursOid: oursType || null,
          theirsOid: theirsType || null,
          mergedOid: mergedType || null,
          structuralConflict: true,
        })
        return null
      }

      if (oursType === 'tree' || theirsType === 'tree' || mergedType === 'tree' || baseTypes.some((t) => t === 'tree')) {
        if (oursType === 'tree' && theirsType === 'tree') {
          const [oursTreeOid, theirsTreeOid] = await Promise.all([oursEntry?.oid().catch(() => null), theirsEntry?.oid().catch(() => null)])
          if (oursTreeOid && oursTreeOid === theirsTreeOid) {
            return null
          }
          if (baseEntries.length === 1 && baseTypes[0] === 'tree') {
            const baseTreeOid = await baseEntries[0]?.oid().catch(() => null)
            if (baseTreeOid && (oursTreeOid === baseTreeOid || theirsTreeOid === baseTreeOid)) {
              return null
            }
          }
        }
        return undefined
      }

      if (oursType === 'commit' || theirsType === 'commit') {
        const [oursSubOid, theirsSubOid, mergedSubOid, ...baseSubOids] = await Promise.all([
          oursType === 'commit' ? oursEntry?.oid().catch(() => null) : null,
          theirsType === 'commit' ? theirsEntry?.oid().catch(() => null) : null,
          mergedType === 'commit' ? mergedEntry?.oid().catch(() => null) : null,
          ...baseEntries.map((entry, idx) => (baseTypes[idx] === 'commit' ? entry?.oid().catch(() => null) : null)),
        ])
        if (oursSubOid === theirsSubOid) return undefined
        const uniqueBases = new Set(baseSubOids.map((x) => x || null))
        if (baseSubOids.length > 0 && uniqueBases.size === 1) {
          const singleBase = baseSubOids[0] || null
          if (singleBase && (oursSubOid === singleBase || theirsSubOid === singleBase)) return undefined
        }
        candidates.push({
          path: filepath,
          baseCommits,
          baseOids: baseSubOids.map((x) => x || null),
          oursOid: oursSubOid || null,
          theirsOid: theirsSubOid || null,
          mergedOid: mergedSubOid || null,
          structuralConflict: true,
        })
        return undefined
      }

      const [oursSha, theirsSha, mergedSha, ...baseShas] = await Promise.all([
        oursType === 'blob' ? oursEntry?.oid().catch(() => null) : null,
        theirsType === 'blob' ? theirsEntry?.oid().catch(() => null) : null,
        mergedType === 'blob' ? mergedEntry?.oid().catch(() => null) : null,
        ...baseEntries.map((entry, idx) => (baseTypes[idx] === 'blob' ? entry?.oid().catch(() => null) : null)),
      ])

      const normalizedBaseShas = baseShas.map((sha) => sha || null)
      const uniqueBases = new Set(normalizedBaseShas)
      const singleBase = normalizedBaseShas.length > 0 && uniqueBases.size === 1 ? normalizedBaseShas[0] : null

      if (!oursSha && !theirsSha) {
        if (singleBase) {
          deletedInBoth.push({ path: filepath, baseOid: singleBase, mergedOid: mergedSha || null })
        }
        return undefined
      }

      if (oursSha === theirsSha) return undefined

      if (normalizedBaseShas.length > 0 && uniqueBases.size === 1) {
        if (singleBase && (oursSha === singleBase || theirsSha === singleBase)) {
          return undefined
        }
        if (!singleBase && (!oursSha || !theirsSha)) {
          const addedSha = oursSha || theirsSha
          if (addedSha) addedOids.add(addedSha)
          return undefined
        }
      } else if (normalizedBaseShas.length === 0 && (!oursSha || !theirsSha)) {
        const addedSha = oursSha || theirsSha
        if (addedSha) addedOids.add(addedSha)
        return undefined
      }

      candidates.push({
        path: filepath,
        baseCommits,
        baseOids: normalizedBaseShas,
        oursOid: oursSha || null,
        theirsOid: theirsSha || null,
        mergedOid: mergedSha || null,
      })
      return undefined
    },
  })

  for (const deleted of deletedInBoth) {
    if (addedOids.has(deleted.baseOid)) {
      candidates.push({
        path: deleted.path,
        baseCommits,
        baseOids: [deleted.baseOid],
        oursOid: null,
        theirsOid: null,
        mergedOid: deleted.mergedOid,
        structuralConflict: true,
      })
    }
  }

  return candidates
}

async function analyzeEdgeConflictCandidates(
  reader: EdgeRepositoryReader,
  hash: string,
  p1: string,
  p2: string,
  includeDiff: boolean
): Promise<{ diff: string; record: MergeConflictRecord }> {
  const candidates = await findCandidateConflictFiles(reader, hash, p1, p2)
  const conflictFiles: string[] = []
  const conflictFileCounts: Record<string, number | null> = {}
  const unresolvedFiles: string[] = []
  const diffParts: string[] = []

  for (const item of candidates) {
    if (item.structuralConflict) {
      conflictFiles.push(item.path)
      conflictFileCounts[item.path] = 1
      continue
    }

    const [baseResolved, oursBlob, theirsBlob, mergedBlob] = await Promise.all([
      resolveVirtualBaseText(reader, item.path, item.baseCommits, item.baseOids),
      readBlobText(reader, item.oursOid),
      readBlobText(reader, item.theirsOid),
      readBlobText(reader, item.mergedOid),
    ])

    if (mergedBlob.text && containsConflictMarkers(mergedBlob.text)) {
      unresolvedFiles.push(item.path)
    }

    if (baseResolved.binary || oursBlob.binary || theirsBlob.binary || !item.oursOid || !item.theirsOid) {
      conflictFiles.push(item.path)
      conflictFileCounts[item.path] = 1
      continue
    }

    if (!baseResolved.hasBase && item.oursOid !== item.theirsOid && (!oursBlob.text || !theirsBlob.text)) {
      if (includeDiff) {
        const markerLines = buildConflictBlockLines(
          p1.slice(0, 7),
          oursBlob.text ? oursBlob.text.split('\n') : [],
          p2.slice(0, 7),
          theirsBlob.text ? theirsBlob.text.split('\n') : []
        )
        const fallback = [`@@ -1,${markerLines.length} +1,1 @@`, ...markerLines.map((l) => `-${l}`)]
        const fileDiff = buildRemergeFileDiff(item.path, markerLines.join('\n'), mergedBlob.text, fallback)
        if (fileDiff) diffParts.push(fileDiff)
      }
      conflictFiles.push(item.path)
      conflictFileCounts[item.path] = 1
      continue
    }

    const { count, conflictBlocks, mergedText } = detectThreeWayConflicts(baseResolved.text, oursBlob.text, theirsBlob.text, p1.slice(0, 7), p2.slice(0, 7))
    if (count > 0) {
      conflictFiles.push(item.path)
      conflictFileCounts[item.path] = count
      if (includeDiff) {
        const fileDiff = buildRemergeFileDiff(item.path, mergedText, mergedBlob.text, conflictBlocks)
        if (fileDiff) diffParts.push(fileDiff)
      }
    }
  }

  const hasConflict = conflictFiles.length > 0
  return {
    diff: diffParts.join('\n'),
    record: {
      hash,
      hasConflict,
      conflictFiles,
      conflictCount: conflictFiles.length,
      conflictFileCounts,
      unresolvedConflictFiles: unresolvedFiles,
      parent1: p1,
      parent2: p2,
      status: hasConflict ? 'conflicted' : 'clean',
      analyzedAt: Date.now(),
    },
  }
}

/**
 * Pure-browser merge conflict detector for Edge directory handles.
 */
export async function detectEdgeMergeConflict(reader: EdgeRepositoryReader, hash: string, parents: string[]): Promise<MergeConflictRecord> {
  if (!parents || parents.length < 2) {
    return { hash, hasConflict: false, status: 'clean', analyzedAt: Date.now() }
  }

  const [p1, p2] = parents
  try {
    const { record } = await analyzeEdgeConflictCandidates(reader, hash, p1, p2, false)
    return record
  } catch {
    return { hash, hasConflict: false, status: 'error', analyzedAt: Date.now() }
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
    const { diff, record } = await analyzeEdgeConflictCandidates(reader, hash, p1, p2, true)
    return { diff, files: record.conflictFiles || [], record }
  } catch {
    return { diff: '', files: [], record: null }
  }
}
