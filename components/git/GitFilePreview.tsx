'use client'

import { marked } from 'marked'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LuFileCode, LuFileX2, LuImageOff } from 'react-icons/lu'

import { gitBlobUrl, type GitFileKind } from '@/components/git/fileKind'
import { renderMarkdownWithHighlight } from '@/components/git/gitHighlight'
import { GitHighlightedCode } from '@/components/git/GitHighlightedCode'
import { markdownBody } from '@/components/git/markdown'
import { installTableResizers } from '@/components/git/markdownTableResizer'
import { useGitBlame } from '@/components/git/useGitBlame'
import { useT } from '@/components/i18n/LocaleProvider'
import { EmptyState, ScrollArea } from '@/components/sk'
import { useThemeMode } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

export type GitFilePane = 'code' | 'preview'

type Props = {
  kind: GitFileKind
  repo: string
  hash: string
  path: string
  content?: string
  missing?: boolean
  binary?: boolean
  truncated?: boolean
  /** For svg / markdown: preview vs source. Owned by the parent header. */
  pane?: GitFilePane
  searchNeedle?: string
  activeLineIndex?: number
}

function ImagePreview({ repo, hash, path }: { repo: string; hash: string; path: string }) {
  const t = useT()
  const src = gitBlobUrl(repo, hash, path)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (failed) {
    return (
      <EmptyState
        density="panel"
        className="flex-1 h-full min-h-0"
        icon={<LuImageOff className="size-8 stroke-[1.5] text-ink-soft/40" aria-hidden="true" />}
        title={t('git.preview.imageFailed')}
        message={t('git.preview.imageFailedMsg')}
      />
    )
  }
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
      <div
        className="inline-flex max-h-full max-w-full items-center justify-center rounded-md border border-line p-2"
        style={{
          backgroundImage:
            'linear-gradient(45deg, color-mix(in oklab, var(--ink) 8%, transparent) 25%, transparent 25%), linear-gradient(-45deg, color-mix(in oklab, var(--ink) 8%, transparent) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, color-mix(in oklab, var(--ink) 8%, transparent) 75%), linear-gradient(-45deg, transparent 75%, color-mix(in oklab, var(--ink) 8%, transparent) 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={path} className="max-h-[min(70vh,720px)] max-w-full object-contain" onError={() => setFailed(true)} />
      </div>
    </div>
  )
}

function SvgPreview({ content, repo, hash, path }: { content?: string; repo: string; hash: string; path: string }) {
  const src = useMemo(() => {
    if (content) {
      const blob = new Blob([content], { type: 'image/svg+xml' })
      return URL.createObjectURL(blob)
    }
    return gitBlobUrl(repo, hash, path)
  }, [content, repo, hash, path])
  useEffect(() => {
    if (!content) return
    return () => URL.revokeObjectURL(src)
  }, [content, src])
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={path} className="max-h-[min(70vh,720px)] max-w-full object-contain" />
    </div>
  )
}

function MarkdownPreview({ content }: { content: string }) {
  const theme = useThemeMode()
  const containerRef = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState<string>(() => {
    try {
      marked.setOptions({ gfm: true, breaks: false })
      return marked.parse(content, { async: false }) as string
    } catch {
      return ''
    }
  })

  useEffect(() => {
    let cancelled = false
    void renderMarkdownWithHighlight(content, theme)
      .then((rendered: string) => {
        if (!cancelled) setHtml(rendered)
      })
      .catch(() => {
        if (!cancelled) {
          try {
            marked.setOptions({ gfm: true, breaks: false })
            setHtml(marked.parse(content, { async: false }) as string)
          } catch {
            // Keep existing html
          }
        }
      })
    return () => {
      cancelled = true
    }
  }, [content, theme])

  useLayoutEffect(() => {
    if (!containerRef.current) return
    return installTableResizers(containerRef.current)
  }, [html])

  return (
    <div className="mx-auto w-full max-w-[1100px] px-8 py-7 pb-[calc(100vh-140px)] font-sans">
      <article ref={containerRef} className={cn(markdownBody)} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

export function GitFilePreview({ kind, repo, hash, path, content, missing, binary, truncated, pane = 'preview', searchNeedle, activeLineIndex }: Props) {
  const t = useT()
  const blameMap = useGitBlame(repo, path, hash)
  if (missing) {
    return (
      <EmptyState
        density="panel"
        className="flex-1 h-full min-h-0"
        icon={<LuFileX2 className="size-8 stroke-[1.5] text-ink-soft/40" aria-hidden="true" />}
        title={t('git.preview.fileGone')}
        message={t('git.preview.fileGoneMsg')}
      />
    )
  }

  if (kind === 'image') {
    return <ImagePreview repo={repo} hash={hash} path={path} />
  }

  if (kind === 'binary') {
    return (
      <EmptyState
        density="panel"
        className="flex-1 h-full min-h-0"
        icon={<LuFileCode className="size-8 stroke-[1.5] text-ink-soft/40" aria-hidden="true" />}
        title={t('git.preview.cannotPreview')}
        message={t('git.preview.binary')}
      />
    )
  }

  if (kind === 'svg' || kind === 'markdown') {
    const source = content || ''
    return (
      <ScrollArea className="min-h-0 flex-1" indicator="both" reserveGutter={false}>
        {pane === 'preview' ? (
          kind === 'svg' ? (
            <SvgPreview content={source || undefined} repo={repo} hash={hash} path={path} />
          ) : (
            <MarkdownPreview content={source} />
          )
        ) : (
          <GitHighlightedCode content={source} path={path} searchNeedle={searchNeedle} activeIndex={activeLineIndex} blameMap={blameMap} />
        )}
        {truncated && pane === 'code' ? <p className="m-0 px-3 py-2 font-sans text-xs text-ink-soft">{t('git.preview.truncated')}</p> : null}
      </ScrollArea>
    )
  }

  if (binary) {
    return (
      <EmptyState
        density="panel"
        className="flex-1 h-full min-h-0"
        icon={<LuFileCode className="size-8 stroke-[1.5] text-ink-soft/40" aria-hidden="true" />}
        title={t('git.preview.cannotPreview')}
        message={t('git.preview.binary')}
      />
    )
  }

  return (
    <ScrollArea className="min-h-0 flex-1" indicator="both" reserveGutter={false}>
      <GitHighlightedCode content={content || ''} path={path} searchNeedle={searchNeedle} activeIndex={activeLineIndex} blameMap={blameMap} />
      {truncated ? <p className="m-0 px-3 py-2 font-sans text-xs text-ink-soft">{t('git.preview.truncated')}</p> : null}
    </ScrollArea>
  )
}
