'use client'

import { type ReactNode, useEffect, useState } from 'react'
import type { ThemedToken } from 'shiki'

import { highlightGitCode, highlightGitLines } from '@/components/git/gitHighlight'
import { useThemeMode } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

type Props = {
  content: string
  path: string
}

export function GitTokenSpans({ tokens, text }: { tokens?: ThemedToken[]; text: string }) {
  if (!tokens || tokens.length === 0) return <>{text || ' '}</>
  return (
    <>
      {tokens.map((token, index) => (
        <span key={index} style={token.color ? { color: token.color } : undefined}>
          {token.content}
        </span>
      ))}
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
    if (lines.length === 0) {
      setTokens([])
      return
    }
    void highlightGitLines(lines, path)
      .then((next) => {
        if (!cancelled) setTokens(next)
      })
      .catch(() => {
        if (!cancelled) setTokens(null)
      })
    return () => {
      cancelled = true
    }
  }, [sourceKey, path, lines.length, theme])

  return tokens
}

function PlainLines({ content }: { content: string }) {
  const lines = content.replace(/\n$/, '').split('\n')
  return (
    <div className="font-mono text-xs leading-5">
      {lines.map((line, index) => (
        <div key={index} className="flex">
          <span className="w-12 shrink-0 pr-2 text-right text-ink-soft select-none">{index + 1}</span>
          <span className="min-w-0 flex-1 whitespace-pre text-ink">{line || ' '}</span>
        </div>
      ))}
    </div>
  )
}

export function GitHighlightedCode({ content, path }: Props) {
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

  if (!tokens) return <PlainLines content={content} />

  return (
    <div className="font-mono text-xs leading-5">
      {tokens.map((line, index) => (
        <div key={index} className="flex">
          <span className="w-12 shrink-0 pr-2 text-right text-ink-soft select-none">{index + 1}</span>
          <span className="min-w-0 flex-1 whitespace-pre text-ink">
            <GitTokenSpans tokens={line} text="" />
          </span>
        </div>
      ))}
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

export function GitDiffCodeText({ kind, text, tokens }: { kind: string; text: string; tokens?: ThemedToken[] }): ReactNode {
  const highlighted = Boolean(tokens && tokens.length > 0)
  return (
    <span className={gitDiffLineClass(kind, highlighted)}>
      <GitTokenSpans tokens={tokens} text={text} />
    </span>
  )
}
