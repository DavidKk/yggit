/**
 * Intra-line diff algorithm that calculates exact added/deleted snippet ranges
 * within modified lines for syntax-highlighted diff displays.
 */

export interface IntraDiffRanges {
  oldRanges: Array<[number, number]>
  newRanges: Array<[number, number]>
}

interface Token {
  text: string
  start: number
  end: number
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const regex = /\s+|[a-zA-Z0-9_$]+|[^\s\w]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length })
  }
  return tokens
}

function mergeTokens(tokens: Token[]): Array<[number, number]> {
  if (tokens.length === 0) return []
  const ranges: Array<[number, number]> = []
  let curStart = tokens[0].start
  let curEnd = tokens[0].end
  for (let k = 1; k < tokens.length; k++) {
    if (tokens[k].start === curEnd) {
      curEnd = tokens[k].end
    } else {
      ranges.push([curStart, curEnd])
      curStart = tokens[k].start
      curEnd = tokens[k].end
    }
  }
  ranges.push([curStart, curEnd])
  return ranges
}

/**
 * Computes character ranges in `oldStr` and `newStr` that changed.
 */
export function computeIntraDiff(oldStr: string, newStr: string): IntraDiffRanges {
  if (!oldStr && !newStr) return { oldRanges: [], newRanges: [] }
  if (!oldStr) return { oldRanges: [], newRanges: [[0, newStr.length]] }
  if (!newStr) return { oldRanges: [[0, oldStr.length]], newRanges: [] }
  if (oldStr === newStr) return { oldRanges: [], newRanges: [] }

  const a = tokenize(oldStr)
  const b = tokenize(newStr)
  const m = a.length
  const n = b.length

  if (m === 0) return { oldRanges: [], newRanges: [[0, newStr.length]] }
  if (n === 0) return { oldRanges: [[0, oldStr.length]], newRanges: [] }

  // For very long lines (> 80 tokens each), use O(N) common prefix and suffix to avoid large DP tables
  if (m * n > 6400) {
    let start = 0
    while (start < m && start < n && a[start].text === b[start].text) {
      start++
    }
    let endOld = m - 1
    let endNew = n - 1
    while (endOld >= start && endNew >= start && a[endOld].text === b[endNew].text) {
      endOld--
      endNew--
    }
    const oldRanges: Array<[number, number]> = start <= endOld ? [[a[start].start, a[endOld].end]] : []
    const newRanges: Array<[number, number]> = start <= endNew ? [[b[start].start, b[endNew].end]] : []
    return { oldRanges, newRanges }
  }

  // Token LCS (Longest Common Subsequence) dynamic programming
  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1))
  for (let i = 1; i <= m; i++) {
    const ai = a[i - 1].text
    const prevRow = dp[i - 1]
    const curRow = dp[i]
    for (let j = 1; j <= n; j++) {
      if (ai === b[j - 1].text) {
        curRow[j] = prevRow[j - 1] + 1
      } else {
        curRow[j] = prevRow[j] > curRow[j - 1] ? prevRow[j] : curRow[j - 1]
      }
    }
  }

  // Backtrack to find unmatched tokens in a and b
  let i = m
  let j = n
  const oldUnmatched: Token[] = []
  const newUnmatched: Token[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1].text === b[j - 1].text) {
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newUnmatched.push(b[j - 1])
      j--
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      oldUnmatched.push(a[i - 1])
      i--
    }
  }

  oldUnmatched.reverse()
  newUnmatched.reverse()

  return {
    oldRanges: mergeTokens(oldUnmatched),
    newRanges: mergeTokens(newUnmatched),
  }
}

/**
 * Splits a token's content into parts based on whether they overlap any highlight ranges.
 */
export function splitTokenWithRanges(content: string, tokenStart: number, ranges?: Array<[number, number]>): Array<{ text: string; isHighlight: boolean }> {
  if (!ranges || ranges.length === 0 || !content) {
    return [{ text: content, isHighlight: false }]
  }

  const tokenEnd = tokenStart + content.length
  const intersecting = ranges.filter(([s, e]) => s < tokenEnd && e > tokenStart)
  if (intersecting.length === 0) {
    return [{ text: content, isHighlight: false }]
  }

  const result: Array<{ text: string; isHighlight: boolean }> = []
  let at = tokenStart
  for (const [rStart, rEnd] of intersecting) {
    const s = Math.max(at, rStart)
    const e = Math.min(tokenEnd, rEnd)
    if (s > at) {
      result.push({ text: content.slice(at - tokenStart, s - tokenStart), isHighlight: false })
    }
    if (e > s) {
      result.push({ text: content.slice(s - tokenStart, e - tokenStart), isHighlight: true })
    }
    at = e
  }
  if (at < tokenEnd) {
    result.push({ text: content.slice(at - tokenStart), isHighlight: false })
  }
  return result
}
