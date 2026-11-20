export type ConflictRegion = { parents: [number, number]; result: number; patch: number }

export function remergeHeaderPath(line: string): string | undefined {
  if (!/^(?:\+\+\+|---) /.test(line)) return undefined
  const value = line.slice(4).replace(/\t$/, '')
  let decoded = value
  if (value.startsWith('"')) {
    try {
      decoded = JSON.parse(value)
    } catch {
      return undefined
    }
  }
  return /^[ab]\//.test(decoded) ? decoded.slice(2) : undefined
}

export function fileRemergePatch(diff: string, path: string): string {
  return diff.split(/(?=^diff --git )/m).find((part) => part.split('\n').some((line) => remergeHeaderPath(line) === path)) ?? ''
}

/** Locate the removed conflict markers in the remerge preimage, then map each side to its original blob. */
export function conflictRegions(patch: string, parentContents: [string, string]): ConflictRegion[] {
  const parents = parentContents.map((content) => content.replace(/\n$/, '').split('\n'))
  const cursors = [0, 0]
  const result: ConflictRegion[] = []
  let newLine = 0
  let recentContext: string[] = []
  let region: { sides: [string[], string[]]; side: number; result: number; patch: number; beforeContext: string[] } | undefined

  const findSequence = (source: string[], seq: string[], startAt: number): number => {
    if (!seq.length) return -1
    for (let index = startAt; index <= source.length - seq.length; index++) {
      if (seq.every((line, offset) => source[index + offset] === line)) return index
    }
    return -1
  }

  const locate = (side: number, lines: string[], beforeContext: string[]): number => {
    const source = parents[side]
    if (lines.length > 0) {
      // 1. Try full match from cursor then from 0
      let idx = findSequence(source, lines, cursors[side])
      if (idx < 0 && cursors[side] > 0) idx = findSequence(source, lines, 0)
      if (idx >= 0) {
        cursors[side] = idx + 1
        return idx
      }

      // 2. Try prefix match with decreasing length (handles hunk breaks inside conflict blocks)
      for (let len = Math.min(lines.length - 1, 6); len >= 1; len--) {
        const prefix = lines.slice(0, len)
        idx = findSequence(source, prefix, cursors[side])
        if (idx < 0 && cursors[side] > 0) idx = findSequence(source, prefix, 0)
        if (idx >= 0) {
          cursors[side] = idx + 1
          return idx
        }
      }
    }

    // 3. Fallback: match beforeContext lines (e.g. empty or deleted side)
    if (beforeContext && beforeContext.length > 0) {
      for (let len = Math.min(beforeContext.length, 3); len >= 1; len--) {
        const sub = beforeContext.slice(beforeContext.length - len)
        let idx = findSequence(source, sub, cursors[side])
        if (idx < 0 && cursors[side] > 0) idx = findSequence(source, sub, 0)
        if (idx >= 0) {
          cursors[side] = idx + len
          return idx + len
        }
      }
    }

    return Math.min(cursors[side], Math.max(0, source.length - 1))
  }

  patch.split('\n').forEach((line, index) => {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line)
    if (hunk) {
      newLine = Math.max(0, Number(hunk[1]) - 1)
      recentContext = []
      return
    }
    if (line.startsWith('---') || line.startsWith('+++')) return
    if (/^-<{7}(?: |$)/.test(line)) {
      region = { sides: [[], []], side: 0, result: newLine, patch: index, beforeContext: [...recentContext] }
    } else if (region && /^-={7}$/.test(line)) {
      region.side = 1
    } else if (region && /^-\|{7}(?: |$)/.test(line)) {
      region.side = 2
    } else if (region && /^->{7}(?: |$)/.test(line)) {
      result.push({
        parents: [locate(0, region.sides[0], region.beforeContext), locate(1, region.sides[1], region.beforeContext)],
        result: region.result,
        patch: region.patch,
      })
      region = undefined
    } else if (region && (line.startsWith('-') || line.startsWith(' ')) && region.side < 2) {
      region.sides[region.side].push(line.slice(1))
    } else if (!region && line.startsWith(' ')) {
      recentContext.push(line.slice(1))
      if (recentContext.length > 5) recentContext.shift()
    }
    if (line.startsWith(' ') || (line.startsWith('+') && !line.startsWith('+++'))) newLine++
  })
  return result
}
