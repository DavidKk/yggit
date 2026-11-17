'use client'

import { type ReactNode, useEffect, useState } from 'react'
import type { ThemedToken } from 'shiki'

import { highlightGitCode, highlightGitLines } from '@/components/git/gitHighlight'
import { useThemeMode } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

type Props = {
  content: string
  path: string
  searchNeedle?: string
  activeIndex?: number
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

export function GitTokenSpans({ tokens, text, searchNeedle, isActiveLine }: { tokens?: ThemedToken[]; text: string; searchNeedle?: string; isActiveLine?: boolean }) {
  if (!tokens || tokens.length === 0) {
    return <>{searchNeedle ? highlightMatch(text || ' ', searchNeedle, isActiveLine) : text || ' '}</>
  }
  return (
    <>
      {tokens.map((token, index) => {
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

  useEffect(() => {
    let cancelled = false
    setTokens(null)
    const splitLines = sourceKey.length === 0 ? [] : sourceKey.split('\n')
    if (splitLines.length === 0) {
      setTokens([])
      return
    }
    void highlightGitLines(splitLines, path)
      .then((next) => {
        if (!cancelled) setTokens(next)
      })
      .catch(() => {
        if (!cancelled) setTokens(null)
      })
    return () => {
      cancelled = true
    }
  }, [sourceKey, path, theme])

  return tokens
}

function PlainLines({ content, searchNeedle, activeIndex }: { content: string; searchNeedle?: string; activeIndex?: number }) {
  const lines = content.replace(/\n$/, '').split('\n')
  return (
    <div className="font-mono text-xs leading-5">
      {lines.map((line, index) => {
        const isActive = activeIndex === index
        const isMatch = Boolean(searchNeedle && line.toLowerCase().includes(searchNeedle.toLowerCase()))
        return (
          <div
            key={index}
            data-diff-line-idx={index}
            className={cn('flex transition-colors', isActive && 'bg-accent/25 ring-1 ring-accent', !isActive && isMatch && 'bg-accent/5')}
          >
            <span className="w-12 shrink-0 pr-2 text-right text-ink-soft select-none">{index + 1}</span>
            <span className="min-w-0 flex-1 whitespace-pre text-ink">{highlightMatch(line || ' ', searchNeedle, isActive)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function GitHighlightedCode({ content, path, searchNeedle, activeIndex }: Props) {
  const theme = useThemeMode()
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null)

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

  if (!tokens) return <PlainLines content={content} searchNeedle={searchNeedle} activeIndex={activeIndex} />

  return (
    <div className="font-mono text-xs leading-5">
      {tokens.map((line, index) => {
        const isActive = activeIndex === index
        const isMatch = Boolean(searchNeedle && line.some((t) => t.content.toLowerCase().includes(searchNeedle.toLowerCase())))
        return (
          <div
            key={index}
            data-diff-line-idx={index}
            className={cn('flex transition-colors', isActive && 'bg-accent/25 ring-1 ring-accent', !isActive && isMatch && 'bg-accent/5')}
          >
            <span className="w-12 shrink-0 pr-2 text-right text-ink-soft select-none">{index + 1}</span>
            <span className="min-w-0 flex-1 whitespace-pre text-ink">
              <GitTokenSpans tokens={line} text="" searchNeedle={searchNeedle} isActiveLine={isActive} />
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function gitDiffLineClass(kind: string, highlighted: boolean): string {
  return cn(
    'min-w-0 flex-1 overflow-hidden whitespace-pre',
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
}: {
  kind: string
  text: string
  tokens?: ThemedToken[]
  searchNeedle?: string
  isActiveLine?: boolean
}): ReactNode {
  const highlighted = Boolean(tokens && tokens.length > 0)
  return (
    <span className={gitDiffLineClass(kind, highlighted)}>
      <GitTokenSpans tokens={tokens} text={text} searchNeedle={searchNeedle} isActiveLine={isActiveLine} />
    </span>
  )
}
