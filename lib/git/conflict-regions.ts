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
  let region: { sides: [string[], string[]]; side: number; result: number; patch: number } | undefined
  const locate = (side: number, lines: string[]) => {
    const source = parents[side]
    if (!lines.length) return Math.min(cursors[side], Math.max(0, source.length - 1))
    for (let index = cursors[side]; index <= source.length - lines.length; index++) {
      if (lines.every((line, offset) => source[index + offset] === line)) {
        cursors[side] = index + lines.length
        return index
      }
    }
    return Math.min(cursors[side], Math.max(0, source.length - 1))
  }
  patch.split('\n').forEach((line, index) => {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line)
    if (hunk) {
      newLine = Math.max(0, Number(hunk[1]) - 1)
      return
    }
    if (line.startsWith('---') || line.startsWith('+++')) return
    if (/^-<{7}(?: |$)/.test(line)) region = { sides: [[], []], side: 0, result: newLine, patch: index }
    else if (region && /^-={7}$/.test(line)) region.side = 1
    else if (region && /^-\|{7}(?: |$)/.test(line)) region.side = 2
    else if (region && /^->{7}(?: |$)/.test(line)) {
      result.push({ parents: [locate(0, region.sides[0]), locate(1, region.sides[1])], result: region.result, patch: region.patch })
      region = undefined
    } else if (region && (line.startsWith('-') || line.startsWith(' ')) && region.side < 2) region.sides[region.side].push(line.slice(1))
    if (line.startsWith(' ') || (line.startsWith('+') && !line.startsWith('+++'))) newLine++
  })
  return result
}
