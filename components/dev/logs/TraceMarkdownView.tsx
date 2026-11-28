'use client'

import { marked } from 'marked'
import React, { useEffect, useRef, useState } from 'react'

import { highlightGitCodeHtml, renderMarkdownWithHighlight } from '@/components/git/gitHighlight'
import { markdownBody } from '@/components/git/markdown'
import { installTableResizers } from '@/components/git/markdownTableResizer'
import { ScrollArea } from '@/components/sk'
import { useThemeMode } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

interface TraceMarkdownViewProps {
  content: string
  className?: string
}

const COMPACT_TRACE_MARKDOWN = cn(
  markdownBody,
  'text-xs leading-[1.6] break-words',
  '[&_h1]:mt-2 [&_h1]:mb-2 [&_h1]:text-sm',
  '[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-[13px]',
  '[&_h3]:mt-2.5 [&_h3]:mb-1.5 [&_h3]:text-xs',
  '[&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:text-xs',
  '[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
  '[&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5',
  '[&_hr]:my-3',
  '[&_pre]:my-2 [&_pre]:p-2.5 [&_pre]:text-[11px] [&_pre]:leading-[1.55]',
  '[&_.git-code-block]:my-2 [&_.git-code-block]:shadow-none [&_.git-code-block>div:last-child]:p-2.5 [&_.git-code-block>div:last-child]:text-[11px]',
  '[&_blockquote]:my-2 [&_blockquote]:py-1.5 [&_blockquote]:px-3'
)

/**
 * Compact syntax-highlighted Markdown preview for Agent trace outputs and request messages.
 */
export function TraceMarkdownView({ content, className }: TraceMarkdownViewProps) {
  const theme = useThemeMode()
  const containerRef = useRef<HTMLDivElement>(null)
  const source = content || '_(empty)_'

  const [html, setHtml] = useState<string>(() => {
    try {
      marked.setOptions({ gfm: true, breaks: true })
      return marked.parse(source, { async: false }) as string
    } catch {
      return ''
    }
  })

  useEffect(() => {
    let cancelled = false
    renderMarkdownWithHighlight(source, theme)
      .then((rendered) => {
        if (!cancelled) setHtml(rendered)
      })
      .catch(() => {
        if (!cancelled) {
          try {
            marked.setOptions({ gfm: true, breaks: true })
            setHtml(marked.parse(source, { async: false }) as string)
          } catch {
            // Keep existing fallback html
          }
        }
      })
    return () => {
      cancelled = true
    }
  }, [source, theme])

  useEffect(() => {
    if (!containerRef.current) return
    return installTableResizers(containerRef.current)
  }, [html])

  return <article ref={containerRef} className={cn(COMPACT_TRACE_MARKDOWN, className)} dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * Compact, scrollable Shiki-highlighted JSON/code block for Tool args and outputs.
 */
export function TraceJsonView({ code, lang = 'json', className }: { code: string; lang?: string; className?: string }) {
  const theme = useThemeMode()
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setHighlightedHtml(null)
    highlightGitCodeHtml(code, lang, theme)
      .then((html) => {
        if (!cancelled) setHighlightedHtml(html)
      })
      .catch(() => {
        // Fallback to plain pre text below
      })
    return () => {
      cancelled = true
    }
  }, [code, lang, theme])

  const contentClass = cn(
    'px-2.5 py-2 font-mono text-[11px] leading-relaxed text-ink',
    '[&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:font-mono [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:font-mono'
  )

  return (
    <ScrollArea indicator="both" className={cn('max-h-44 rounded-md bg-paper/55', className)} scrollClassName={contentClass}>
      {highlightedHtml ? (
        <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      ) : (
        <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink">
          <code>{code}</code>
        </pre>
      )}
    </ScrollArea>
  )
}
