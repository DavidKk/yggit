'use client'

import { useEffect, useMemo, useState } from 'react'
import { LuCornerDownRight, LuUser } from 'react-icons/lu'

import { GitDiffCodeText, useGitLineTokens } from '@/components/git/GitHighlightedCode'
import { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import { Spinner, Tooltip } from '@/components/sk'
import { getGitDriver } from '@/lib/git/driver'
import type { GitBlameLine } from '@/lib/git/driver/types'
import { formatCommitAgo } from '@/lib/git/format-commit-ago'
import { cn } from '@/lib/utils'

export function GitFileBlameView({
  repo,
  path,
  hash,
  wordWrap = false,
  searchNeedle = '',
  onTotalLinesChange,
  onLocateCommit,
}: {
  repo: string
  path: string
  hash?: string
  wordWrap?: boolean
  searchNeedle?: string
  onTotalLinesChange?: (lines: number) => void
  onLocateCommit?: (hash: string) => void
}) {
  const t = useT()
  const locale = useLocaleCode()

  const [content, setContent] = useState<string>('')
  const [blameMap, setBlameMap] = useState<Record<number, GitBlameLine>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hoveredLine, setHoveredLine] = useState<number | null>(null)

  // Fetch blob and blame concurrently
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setContent('')
    setBlameMap({})
    const driver = getGitDriver()

    Promise.all([
      driver.readBlob({ repo, path, hash: hash || 'HEAD' }).catch(() => ({ content: '', binary: false })),
      driver.readBlame({ repo, path, hash }).catch(() => ({}) as Record<number, GitBlameLine>),
    ])
      .then(([blobRes, blameRes]) => {
        if (cancelled) return
        setContent(blobRes.content)
        setBlameMap(blameRes || {})
        const total = blobRes.content ? blobRes.content.replace(/\n$/, '').split('\n').length : 0
        onTotalLinesChange?.(total)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('git.diff.loadingBlame') || '加载追溯失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [repo, path, hash, t, onTotalLinesChange])

  const lines = useMemo(() => {
    if (!content) return []
    return content.replace(/\n$/, '').split('\n')
  }, [content])

  const tokens = useGitLineTokens(lines, path)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-panel select-text font-mono text-xs">
      {loading ? (
        <div className="flex flex-1 items-center justify-center p-12 text-ink-soft">
          <Spinner className="mr-2 size-4" />
          <span>{t('git.diff.loadingBlame') || '正在加载追溯…'}</span>
        </div>
      ) : error ? (
        <div className="p-4 text-fail">{error}</div>
      ) : lines.length === 0 ? (
        <div className="p-8 text-center text-ink-soft">{t('git.diff.noChanges') || '文件为空'}</div>
      ) : (
        <div className="min-w-fit py-1">
          {lines.map((lineText, idx) => {
            const lineNo = idx + 1
            const blame = blameMap[lineNo]
            const prevBlame = idx > 0 ? blameMap[idx] : undefined
            const isSameAsPrevCommit = prevBlame && blame && prevBlame.hash === blame.hash
            const isHovered = hoveredLine === lineNo
            const isLineMatch = searchNeedle && lineText.toLowerCase().includes(searchNeedle.toLowerCase())

            return (
              <div
                key={lineNo}
                onMouseEnter={() => setHoveredLine(lineNo)}
                onMouseLeave={() => setHoveredLine(null)}
                className={cn(
                  'group/blamerow flex leading-5 transition-colors items-start',
                  isHovered ? 'bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]' : 'hover:bg-canvas/50',
                  isLineMatch && 'bg-accent/15'
                )}
              >
                {/* Blame Gutter Column */}
                <div className="flex shrink-0 items-center border-r border-line bg-canvas/30 text-[11px] select-none font-sans">
                  {/* Line Number */}
                  <span className="w-12 shrink-0 pr-2.5 text-right font-mono text-ink-soft/75">{lineNo}</span>

                  {/* Blame Metadata Gutter */}
                  <div
                    className={cn(
                      'flex w-72 shrink-0 items-center justify-between gap-1.5 px-2 font-mono transition-opacity',
                      isSameAsPrevCommit && !isHovered ? 'opacity-55 group-hover/blamerow:opacity-100' : 'opacity-90'
                    )}
                    title={blame ? `${blame.hash.slice(0, 8)} (${blame.author}): ${blame.summary}\n${blame.date}` : undefined}
                  >
                    {blame ? (
                      <>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => onLocateCommit?.(blame.hash)}
                            className="font-mono text-accent hover:underline cursor-pointer shrink-0"
                            title={t('git.diff.locateInGraph') || '在提交图中定位'}
                          >
                            {blame.hash.slice(0, 7)}
                          </button>
                          <span className="flex items-center gap-1 min-w-0 text-ink-soft group-hover/blamerow:text-ink">
                            <LuUser className="size-2.5 shrink-0 text-ink-soft/70" />
                            <span className="truncate max-w-[110px]" title={blame.author}>
                              {blame.author}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-ink-soft/70">{formatCommitAgo(blame.date, locale)}</span>
                          <Tooltip content={blame.summary}>
                            <button
                              type="button"
                              onClick={() => onLocateCommit?.(blame.hash)}
                              className="opacity-0 group-hover/blamerow:opacity-100 text-ink-soft hover:text-accent cursor-pointer transition-opacity"
                              aria-label={t('git.diff.locateInGraph') || '定位'}
                            >
                              <LuCornerDownRight className="size-3" />
                            </button>
                          </Tooltip>
                        </div>
                      </>
                    ) : (
                      <span className="text-ink-soft/40">-</span>
                    )}
                  </div>
                </div>

                {/* Code text */}
                <div className="min-w-0 flex-1 pl-3 font-mono">
                  <GitDiffCodeText kind="context" text={lineText} tokens={tokens?.[idx]} searchNeedle={searchNeedle} wrap={wordWrap} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
