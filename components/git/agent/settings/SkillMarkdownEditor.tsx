'use client'

import Editor from '@monaco-editor/react'
import { marked } from 'marked'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { renderMarkdownWithHighlight } from '@/components/git/gitHighlight'
import { markdownBody } from '@/components/git/markdown'
import { installTableResizers } from '@/components/git/markdownTableResizer'
import { Spinner } from '@/components/sk'
import { useThemeMode } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

interface SkillMarkdownEditorProps {
  value: string
  onChange?: (next: string) => void
  readOnly?: boolean
  height?: number
  className?: string
}

function readMonacoTheme(): 'vs' | 'vs-dark' {
  if (typeof document === 'undefined') return 'vs-dark'
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'vs' : 'vs-dark'
}

/**
 * Syntax-highlighted Markdown editor (Monaco) for SKILL.md instructions.
 * Syncs automatically with `html[data-theme]`.
 */
export function SkillMarkdownEditor({ value, onChange, readOnly = false, height = 380, className }: SkillMarkdownEditorProps) {
  const [theme, setTheme] = useState<'vs' | 'vs-dark'>(readMonacoTheme)

  useEffect(() => {
    setTheme(readMonacoTheme())
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return
    const observer = new MutationObserver(() => {
      setTheme(readMonacoTheme())
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-surface-panel', className)} style={{ height }}>
      <Editor
        height={height}
        language="markdown"
        theme={theme}
        value={value}
        onChange={(next) => onChange?.(next ?? '')}
        loading={
          <div className="flex h-full items-center justify-center gap-2 text-xs text-ink-soft">
            <Spinner className="size-4" />
          </div>
        }
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 12,
          lineHeight: 20,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          padding: { top: 10, bottom: 10 },
          renderLineHighlight: readOnly ? 'none' : 'line',
          overviewRulerLanes: 0,
        }}
      />
    </div>
  )
}

function splitSkillFrontmatter(raw: string): { frontmatter: Array<{ key: string; value: string }>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { frontmatter: [], body: raw }
  const pairs: Array<{ key: string; value: string }> = []
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      const val = line
        .slice(idx + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
      if (key && val) pairs.push({ key, value: val })
    }
  }
  return { frontmatter: pairs, body: match[2] }
}

/**
 * Rendered Markdown preview for SKILL.md with syntax highlighting and frontmatter summary.
 */
export function SkillMarkdownPreview({ value, className }: { value: string; className?: string }) {
  const theme = useThemeMode()
  const containerRef = useRef<HTMLDivElement>(null)
  const { frontmatter, body } = useMemo(() => splitSkillFrontmatter(value), [value])

  const [html, setHtml] = useState<string>(() => {
    try {
      marked.setOptions({ gfm: true, breaks: false })
      return marked.parse(body, { async: false }) as string
    } catch {
      return ''
    }
  })

  useEffect(() => {
    let cancelled = false
    renderMarkdownWithHighlight(body, theme)
      .then((rendered) => {
        if (!cancelled) setHtml(rendered)
      })
      .catch(() => {
        if (!cancelled) {
          try {
            marked.setOptions({ gfm: true, breaks: false })
            setHtml(marked.parse(body, { async: false }) as string)
          } catch {
            // Keep existing html
          }
        }
      })
    return () => {
      cancelled = true
    }
  }, [body, theme])

  useEffect(() => {
    if (!containerRef.current) return
    return installTableResizers(containerRef.current)
  }, [html])

  return (
    <div className={cn('min-h-[240px] max-h-[520px] overflow-y-auto px-1 py-2', className)}>
      {frontmatter.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 pb-2.5 border-b border-line/50">
          {frontmatter.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1 rounded bg-paper-2 px-2 py-0.5 text-[11px] font-mono text-ink-soft">
              <span className="text-ink font-medium">{item.key}:</span>
              <span>{item.value}</span>
            </span>
          ))}
        </div>
      )}
      <article ref={containerRef} className={cn(markdownBody, 'text-xs')} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
