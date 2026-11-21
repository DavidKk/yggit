'use client'

import { type ReactNode, useEffect, useState } from 'react'
import type { ThemedToken } from 'shiki'

import { highlightGitCode, highlightGitLines } from '@/components/git/gitHighlight'
import { useLocaleCode } from '@/components/i18n/LocaleProvider'
import { useThemeMode } from '@/components/theme/ThemeProvider'
import type { GitBlameLine } from '@/lib/git/driver/types'
import { formatCommitAgo } from '@/lib/git/format-commit-ago'
import { splitTokenWithRanges } from '@/lib/git/intra-diff'
import { cn } from '@/lib/utils'

type Props = {
  content: string
  path: string
  searchNeedle?: string
  activeIndex?: number
  blameMap?: Record<number, GitBlameLine>
}

function highlightMatch(text: string, needle?: string, isActive = false): ReactNode {
  if (!needle || !text) return text
  const lowerText = text.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const idx = lowerText.indexOf(lowerNeedle)
  if (idx === -1) return text

  const result: ReactNode[] = []
  let lastIdx = 0
  let currentIdx = idx
  let key = 0

  while (currentIdx !== -1) {
    if (currentIdx > lastIdx) {
      result.push(text.slice(lastIdx, currentIdx))
    }
    const matchedStr = text.slice(currentIdx, currentIdx + needle.length)
    result.push(
      <mark
        key={`m-${key++}`}
        className={cn(
          'rounded-xs px-0.5 select-text',
          isActive ? 'bg-accent text-white font-semibold shadow-xs' : 'bg-amber-300 text-black dark:bg-amber-400/80 dark:text-ink font-normal'
        )}
      >
        {matchedStr}
      </mark>
    )
    lastIdx = currentIdx + needle.length
    currentIdx = lowerText.indexOf(lowerNeedle, lastIdx)
  }

  if (lastIdx < text.length) {
    result.push(text.slice(lastIdx))
  }

  return <>{result}</>
}

export function GitTokenSpans({
  tokens,
  text,
  searchNeedle,
  isActiveLine,
  diffRanges,
  diffKind,
}: {
  tokens?: ThemedToken[]
  text: string
  searchNeedle?: string
  isActiveLine?: boolean
  diffRanges?: Array<[number, number]>
  diffKind?: 'add' | 'del'
}) {
  const hasTokens = Boolean(tokens && tokens.length > 0)
  const highlightClass =
    diffKind === 'add'
      ? cn('bg-[color-mix(in_oklab,var(--ok)_40%,transparent)] rounded-xs font-semibold px-0.5', !hasTokens && 'text-ok')
      : diffKind === 'del'
        ? cn('bg-[color-mix(in_oklab,var(--fail)_40%,transparent)] rounded-xs font-semibold px-0.5', !hasTokens && 'text-fail')
        : 'bg-accent/30 rounded-xs px-0.5'

  if (!tokens || tokens.length === 0) {
    if (!diffRanges || diffRanges.length === 0) {
      return <>{searchNeedle ? highlightMatch(text || ' ', searchNeedle, isActiveLine) : text || ' '}</>
    }
    const parts = splitTokenWithRanges(text, 0, diffRanges)
    return (
      <>
        {parts.map((part, pIdx) => {
          const content = searchNeedle ? highlightMatch(part.text, searchNeedle, isActiveLine) : part.text
          if (part.isHighlight) {
            return (
              <span key={pIdx} className={highlightClass}>
                {content}
              </span>
            )
          }
          return <span key={pIdx}>{content}</span>
        })}
      </>
    )
  }

  const tokensWithOffsets: Array<{ token: ThemedToken; start: number }> = []
  let offset = 0
  for (const token of tokens) {
    tokensWithOffsets.push({ token, start: offset })
    offset += token.content.length
  }

  return (
    <>
      {tokensWithOffsets.map(({ token, start }, index) => {
        if (diffRanges && diffRanges.length > 0) {
          const parts = splitTokenWithRanges(token.content, start, diffRanges)
          return (
            <span key={index} style={token.color ? { color: token.color } : undefined}>
              {parts.map((part, pIdx) => {
                const content = searchNeedle ? highlightMatch(part.text, searchNeedle, isActiveLine) : part.text
                if (part.isHighlight) {
                  return (
                    <span key={pIdx} className={highlightClass}>
                      {content}
                    </span>
                  )
                }
                return <span key={pIdx}>{content}</span>
              })}
            </span>
          )
        }
        const content = searchNeedle ? highlightMatch(token.content, searchNeedle, isActiveLine) : token.content
        return (
          <span key={index} style={token.color ? { color: token.color } : undefined}>
            {content}
          </span>
        )
      })}
    </>
  )
}

export function useGitLineTokens(lines: string[], path: string): ThemedToken[][] | null {
  const theme = useThemeMode()
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null)
  const sourceKey = lines.join('\n')
  const lineCount = lines.length

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    setTokens(null)
    const sourceLines = lineCount === 0 ? [] : sourceKey.split('\n')
    if (sourceLines.length === 0) {
      setTokens([])
      return
    }

    // Fast initial batch for immediate responsiveness
    const MAX_CHUNK = 600
    const initialBatch = sourceLines.length > MAX_CHUNK ? sourceLines.slice(0, MAX_CHUNK) : sourceLines

    void highlightGitLines(initialBatch, path)
      .then((initialTokens) => {
        if (cancelled) return
        if (sourceLines.length <= MAX_CHUNK) {
          setTokens(initialTokens)
        } else {
          // Pad initial tokens with empty arrays so visible lines render instantly
          const padded = initialTokens.slice()
          while (padded.length < sourceLines.length) padded.push([])
          setTokens(padded)

          // Schedule tokenizing the remaining lines in background
          timer = setTimeout(() => {
            if (cancelled) return
            void highlightGitLines(sourceLines, path)
              .then((fullTokens) => {
                if (!cancelled) setTokens(fullTokens)
              })
              .catch(() => {
                // Keep the initial tokens if background highlighting fails.
              })
          }, 80)
        }
      })
      .catch(() => {
        if (!cancelled) setTokens(null)
      })

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sourceKey, lineCount, path, theme])

  return tokens
}

function PlainLines({
  content,
  searchNeedle,
  activeIndex,
  blameMap,
  locale,
}: {
  content: string
  searchNeedle?: string
  activeIndex?: number
  blameMap?: Record<number, GitBlameLine>
  locale: ReturnType<typeof useLocaleCode>
}) {
  const lines = content.replace(/\n$/, '').split('\n')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  return (
    <div className="font-mono text-xs leading-5 pb-[calc(100vh-140px)]" onMouseLeave={() => setHoveredIndex(null)}>
      {lines.map((line, index) => {
        const lineNum = index + 1
        const blame = blameMap?.[lineNum]
        const isActive = activeIndex === index
        const isHovered = hoveredIndex === index
        const isMatch = Boolean(searchNeedle && line.toLowerCase().includes(searchNeedle.toLowerCase()))
        return (
          <div
            key={index}
            data-diff-line-idx={index}
            onMouseEnter={() => setHoveredIndex(index)}
            className={cn(
              'group/coderow relative flex min-w-full w-max items-center transition-colors',
              isActive && 'bg-accent/25 ring-1 ring-accent',
              !isActive && isMatch && 'bg-accent/5',
              isHovered && !isActive && 'bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]'
            )}
          >
            <span className="w-12 shrink-0 pr-2 text-right text-ink-soft select-none font-mono">{lineNum}</span>
            <span className="shrink-0 whitespace-pre text-ink">{highlightMatch(line || ' ', searchNeedle, isActive)}</span>
            {blame && (
              <span
                className={cn(
                  'ml-6 pl-1 pr-3 text-[11px] text-ink-soft/75 select-none font-sans shrink-0 pointer-events-none truncate italic transition-opacity duration-150',
                  isHovered ? 'opacity-100' : 'opacity-0 group-hover/coderow:opacity-100'
                )}
                title={`${blame.author} (${blame.hash.slice(0, 7)}): ${blame.summary}`}
              >
                {blame.author}, {formatCommitAgo(blame.date, locale)} · {blame.summary}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function GitHighlightedCode({ content, path, searchNeedle, activeIndex, blameMap }: Props) {
  const theme = useThemeMode()
  const locale = useLocaleCode()
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setTokens(null)
    void highlightGitCode(content, path)
      .then((next) => {
        if (!cancelled) setTokens(next)
      })
      .catch(() => {
        if (!cancelled) setTokens(null)
      })
    return () => {
      cancelled = true
    }
  }, [content, path, theme])

  if (!tokens) return <PlainLines content={content} searchNeedle={searchNeedle} activeIndex={activeIndex} blameMap={blameMap} locale={locale} />

  return (
    <div className="font-mono text-xs leading-5 pb-[calc(100vh-140px)]" onMouseLeave={() => setHoveredIndex(null)}>
      {tokens.map((line, index) => {
        const lineNum = index + 1
        const blame = blameMap?.[lineNum]
        const isActive = activeIndex === index
        const isHovered = hoveredIndex === index
        const isMatch = Boolean(searchNeedle && line.some((t) => t.content.toLowerCase().includes(searchNeedle.toLowerCase())))
        return (
          <div
            key={index}
            data-diff-line-idx={index}
            onMouseEnter={() => setHoveredIndex(index)}
            className={cn(
              'group/coderow relative flex min-w-full w-max items-center transition-colors',
              isActive && 'bg-accent/25 ring-1 ring-accent',
              !isActive && isMatch && 'bg-accent/5',
              isHovered && !isActive && 'bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]'
            )}
          >
            <span className="w-12 shrink-0 pr-2 text-right text-ink-soft select-none font-mono">{lineNum}</span>
            <span className="shrink-0 whitespace-pre text-ink">
              <GitTokenSpans tokens={line} text="" searchNeedle={searchNeedle} isActiveLine={isActive} />
            </span>
            {blame && (
              <span
                className={cn(
                  'ml-6 pl-1 pr-3 text-[11px] text-ink-soft/75 select-none font-sans shrink-0 pointer-events-none truncate italic transition-opacity duration-150',
                  isHovered ? 'opacity-100' : 'opacity-0 group-hover/coderow:opacity-100'
                )}
                title={`${blame.author} (${blame.hash.slice(0, 7)}): ${blame.summary}`}
              >
                {blame.author}, {formatCommitAgo(blame.date, locale)} · {blame.summary}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function gitDiffLineClass(kind: string, highlighted: boolean, wrap = false): string {
  return cn(
    wrap ? 'min-w-0 flex-1 whitespace-pre-wrap break-all' : 'shrink-0 whitespace-pre',
    kind === 'add' && 'bg-[color-mix(in_oklab,var(--ok)_16%,transparent)]',
    kind === 'del' && 'bg-[color-mix(in_oklab,var(--fail)_16%,transparent)]',
    kind === 'meta' && 'text-ink-soft',
    !highlighted && kind === 'add' && 'text-ok',
    !highlighted && kind === 'del' && 'text-fail',
    !highlighted && kind === 'context' && 'text-ink'
  )
}

export function GitDiffCodeText({
  kind,
  text,
  tokens,
  searchNeedle,
  isActiveLine,
  wrap = false,
  diffRanges,
}: {
  kind: string
  text: string
  tokens?: ThemedToken[]
  searchNeedle?: string
  isActiveLine?: boolean
  wrap?: boolean
  diffRanges?: Array<[number, number]>
}): ReactNode {
  const highlighted = Boolean(tokens && tokens.length > 0)
  const diffKind = kind === 'add' ? 'add' : kind === 'del' ? 'del' : undefined
  return (
    <span className={gitDiffLineClass(kind, highlighted, wrap)}>
      <GitTokenSpans tokens={tokens} text={text} searchNeedle={searchNeedle} isActiveLine={isActiveLine} diffRanges={diffRanges} diffKind={diffKind} />
    </span>
  )
}
