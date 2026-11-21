'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LuBot, LuSearch, LuX } from 'react-icons/lu'

import { useGitFindPanel } from '@/components/git/gitFind'
import { GitFindBox } from '@/components/git/GitFindBox'
import { GitDiffCodeText, useGitLineTokens } from '@/components/git/GitHighlightedCode'
import { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import { Button, ScrollArea, Spinner } from '@/components/sk'
import { useOptionalSpotlight } from '@/lib/agent/spotlight-context'
import type { GitBlameLine } from '@/lib/git/driver/types'
import { formatCommitAgo } from '@/lib/git/format-commit-ago'
import { cn } from '@/lib/utils'

export type CodePaneRow = {
  text: string
  number?: number
  kind?: 'context' | 'add' | 'del'
  diffRanges?: Array<[number, number]>
}

export function GitCodePane({
  label,
  path,
  rows,
  loading,
  scrollTop,
  onScroll,
  targetLine,
  targetSequence,
  wordWrap = false,
  blameMap,
}: {
  label: string
  path: string
  rows: CodePaneRow[]
  loading?: boolean
  scrollTop?: number
  onScroll?: (top: number) => void
  targetLine?: number
  targetSequence?: number
  wordWrap?: boolean
  blameMap?: Record<number, GitBlameLine>
}) {
  const t = useT()
  const locale = useLocaleCode()
  const spotlight = useOptionalSpotlight()
  const codeAnnotation = spotlight?.codeAnnotation
  const annotationFile = codeAnnotation?.file
  const isMatchingFile = useMemo(() => {
    if (!annotationFile || !path) return false
    const cleanA = annotationFile.replace(/\\/g, '/').toLowerCase()
    const cleanB = path.replace(/\\/g, '/').toLowerCase()
    return cleanA === cleanB || cleanA.endsWith('/' + cleanB) || cleanB.endsWith('/' + cleanA)
  }, [annotationFile, path])
  const panelRef = useRef<HTMLElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  const [height, setHeight] = useState(400)
  const [showFind, setShowFind] = useState(false)
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null)
  useGitFindPanel(panelRef, findInputRef, () => setShowFind(true))
  const [query, setQuery] = useState('')
  const [match, setMatch] = useState(0)
  const needle = query.trim().toLowerCase()
  const lines = useMemo(() => rows.map((row) => row.text), [rows])
  const tokens = useGitLineTokens(lines, path)
  const matches = useMemo(() => (needle ? rows.flatMap((row, index) => (row.text.toLowerCase().includes(needle) ? [index] : [])) : []), [rows, needle])
  const jump = (line: number) => {
    if (wordWrap) {
      const el = scroller.current?.querySelector(`[data-code-line="${line}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
    }
    const viewport = scroller.current?.clientHeight || 400
    const bottomExtraSpace = rows.length > 0 ? Math.max(0, viewport - 20) : 0
    const maxScroll = Math.max(0, rows.length * 20 + bottomExtraSpace - viewport)
    const next = Math.min(maxScroll, Math.max(0, line * 20 - viewport / 3))
    if (scroller.current) scroller.current.scrollTop = next
    setTop(next)
    onScroll?.(next)
  }
  useEffect(() => {
    setMatch(0)
    if (matches.length) jump(matches[0])
  }, [matches]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (targetLine !== undefined) jump(targetLine)
  }, [targetLine, targetSequence]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isMatchingFile && codeAnnotation?.startLine !== undefined) {
      const targetIdx = rows.findIndex((r) => r.number === codeAnnotation.startLine)
      if (targetIdx >= 0) {
        jump(targetIdx)
      } else {
        jump(Math.max(0, codeAnnotation.startLine - 1))
      }
    }
  }, [isMatchingFile, codeAnnotation?.startLine, rows]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (scrollTop !== undefined && scroller.current && Math.abs(scroller.current.scrollTop - scrollTop) > 1) {
      scroller.current.scrollTop = scrollTop
      setTop(scroller.current.scrollTop)
    }
  }, [scrollTop])
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => setHeight(el.clientHeight || 400)
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(el)
    return () => observer?.disconnect()
  }, [])
  const hasBlame = Boolean(blameMap && Object.keys(blameMap).length > 0)
  const maxLineLength = useMemo(() => {
    let max = 0
    for (let i = 0; i < rows.length; i++) {
      const lineNum = rows[i].number
      const lineLen = rows[i].text.length + (hasBlame && lineNum !== undefined && blameMap?.[lineNum] ? 45 : 0)
      if (lineLen > max) max = lineLen
    }
    return max
  }, [rows, hasBlame, blameMap])

  useEffect(() => {
    setQuery('')
    setMatch(0)
    if (scroller.current) scroller.current.scrollTop = 0
    setTop(0)
  }, [path])
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const bottomExtraSpace = rows.length > 0 ? Math.max(0, height - 20) : 0
    const maxScroll = Math.max(0, rows.length * 20 + bottomExtraSpace - height)
    const next = Math.min(el.scrollTop, maxScroll)
    if (el.scrollTop !== next) {
      el.scrollTop = next
      onScroll?.(next)
    }
    setTop(next)
  }, [rows.length, height, onScroll])
  const step = (delta: number) => {
    if (!matches.length) return
    const next = (match + delta + matches.length) % matches.length
    setMatch(next)
    jump(matches[next])
  }
  const start = Math.max(0, Math.floor(top / 20) - 15)
  const end = Math.min(rows.length, Math.ceil((top + height) / 20) + 15)
  return (
    <section
      tabIndex={0}
      aria-label={label}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-panel outline-none"
      ref={panelRef}
      data-git-find="code"
      onPointerDown={(event) => {
        if (!(event.target as Element).closest('button,input,textarea,a')) panelRef.current?.focus({ preventScroll: true })
      }}
    >
      <header className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-line px-2 text-xs text-ink-soft">
        <span className="min-w-0 truncate">{label}</span>
        <Button variant="plain" size="mini" aria-label={`${t('git.diff.searchContent')} · ${label}`} onClick={() => setShowFind((value) => !value)}>
          <LuSearch className="size-3.5" />
        </Button>
      </header>
      {showFind && (
        <GitFindBox
          inputRef={findInputRef}
          className="absolute right-2 top-9"
          value={query}
          onChange={setQuery}
          onClose={() => {
            setShowFind(false)
            setQuery('')
          }}
          current={match}
          total={matches.length}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          ariaLabel={`${t('git.diff.searchContent')} · ${label}`}
          placeholder={t('git.diff.searchPlaceholder')}
        />
      )}
      {isMatchingFile && codeAnnotation && (
        <div className="flex shrink-0 items-center justify-between border-b border-violet-500/30 bg-violet-950/70 px-3 py-1.5 text-xs text-violet-100 backdrop-blur z-20">
          <div className="flex items-center gap-2 min-w-0">
            <LuBot className="size-4 shrink-0 text-violet-300" />
            <span className="truncate">
              <strong className="font-semibold text-violet-200">{codeAnnotation.title || 'Git Agent 研发提示'}</strong>
              <span className="ml-1 text-violet-300">
                (第 {codeAnnotation.startLine}
                {codeAnnotation.endLine && codeAnnotation.endLine !== codeAnnotation.startLine ? ` - ${codeAnnotation.endLine}` : ''} 行)
              </span>
              : {codeAnnotation.message}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <Button
              variant="ghost"
              size="xs"
              className="h-6 px-2 text-xs text-violet-200 hover:bg-violet-800/50 hover:text-white"
              onClick={() => {
                const targetIdx = rows.findIndex((r) => r.number === codeAnnotation.startLine)
                if (targetIdx >= 0) jump(targetIdx)
                else jump(Math.max(0, codeAnnotation.startLine - 1))
              }}
            >
              跳转定位
            </Button>
            <button type="button" title="关闭标记" onClick={() => spotlight?.clearCodeAnnotation()} className="cursor-pointer rounded p-0.5 text-violet-400 hover:text-white">
              <LuX className="size-3.5" />
            </button>
          </div>
        </div>
      )}
      <ScrollArea
        className="min-h-0 flex-1"
        scrollClassName="min-h-0 flex-1 overscroll-none font-mono text-xs leading-5 select-text"
        indicator={wordWrap ? 'vertical' : 'both'}
        reserveGutter={false}
        scrollRef={scroller}
        scrollProps={{
          onScroll: (event) => {
            setTop(event.currentTarget.scrollTop)
            onScroll?.(event.currentTarget.scrollTop)
          },
        }}
      >
        {loading ? (
          <Spinner className="m-4 size-4" />
        ) : !rows.length ? (
          <p className="p-3 text-xs text-ink-soft">{t('git.diff.missingVersion')}</p>
        ) : wordWrap ? (
          <div className="min-w-0 w-full" style={{ paddingBottom: rows.length > 0 ? Math.max(0, height - 20) : 0 }} onMouseLeave={() => setHoveredLineIndex(null)}>
            {rows.map((row, index) => {
              const active = Boolean(showFind && needle && matches[match] === index)
              const isHovered = hoveredLineIndex === index
              const blame = row.number ? blameMap?.[row.number] : undefined
              const isAgentLine = Boolean(
                isMatchingFile && codeAnnotation && row.number && row.number >= codeAnnotation.startLine && row.number <= (codeAnnotation.endLine ?? codeAnnotation.startLine)
              )
              return (
                <div
                  key={index}
                  data-code-line={index}
                  onMouseEnter={() => setHoveredLineIndex(index)}
                  className={cn(
                    'group/coderow relative flex w-full min-w-full transition-colors leading-5 items-start',
                    row.kind === 'add' && 'bg-[#ecfdf5]/85 text-[#064e3b] dark:bg-[#064e3b]/22 dark:text-ink border-l-2 border-emerald-500/70',
                    row.kind === 'del' && 'bg-[#fff1f2]/85 text-[#881337] dark:bg-[#881337]/22 dark:text-ink border-l-2 border-rose-500/70',
                    active && 'bg-accent/20 ring-1 ring-inset ring-accent',
                    targetLine === index && targetSequence !== undefined && 'bg-warn/15 ring-1 ring-inset ring-warn',
                    isAgentLine && 'bg-violet-500/20 ring-1 ring-inset ring-violet-500 border-l-2 border-violet-500 text-violet-100',
                    isHovered && !active && !isAgentLine && (row.kind ? 'brightness-95' : 'bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]')
                  )}
                >
                  <span className="w-10 shrink-0 pr-2 text-right text-ink-soft select-none font-mono">{row.number}</span>
                  <GitDiffCodeText
                    kind={row.kind ?? 'context'}
                    text={row.text}
                    tokens={tokens?.[index]}
                    searchNeedle={needle}
                    isActiveLine={active}
                    wrap={true}
                    diffRanges={row.diffRanges}
                  />
                  {isAgentLine && codeAnnotation && row.number === codeAnnotation.startLine && (
                    <span className="ml-auto mr-2 inline-flex shrink-0 items-center gap-1.5 rounded bg-violet-600/90 px-2 py-0.5 text-[11px] font-sans font-medium text-white shadow-xs z-10 self-start">
                      <LuBot className="size-3 shrink-0" />
                      <span className="max-w-[280px] truncate" title={codeAnnotation.message}>
                        {codeAnnotation.title ? `${codeAnnotation.title}: ` : ''}
                        {codeAnnotation.message}
                      </span>
                      <button
                        type="button"
                        title="清除标记"
                        onClick={(e) => {
                          e.stopPropagation()
                          spotlight?.clearCodeAnnotation()
                        }}
                        className="cursor-pointer hover:text-violet-200"
                      >
                        <LuX className="size-3" />
                      </button>
                    </span>
                  )}
                  {blame && !isAgentLine && (
                    <span
                      className={cn(
                        'ml-4 pl-1 pr-3 text-[11px] text-ink-soft/75 select-none font-sans shrink-0 max-w-[45%] pointer-events-none truncate italic self-start leading-5 transition-opacity duration-150',
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
        ) : (
          <div
            className="w-full min-w-full"
            style={{
              minWidth: '100%',
              width: maxLineLength > 0 ? `max(100%, calc(${maxLineLength + 6}ch + 1.5rem))` : '100%',
            }}
            onMouseLeave={() => setHoveredLineIndex(null)}
          >
            <div
              className="w-full min-w-full"
              style={{
                paddingTop: start * 20,
                paddingBottom: Math.max(0, (rows.length - end) * 20) + (rows.length > 0 ? Math.max(0, height - 20) : 0),
              }}
            >
              {rows.slice(start, end).map((row, offset) => {
                const index = start + offset
                const active = Boolean(showFind && needle && matches[match] === index)
                const isHovered = hoveredLineIndex === index
                const blame = row.number ? blameMap?.[row.number] : undefined
                const isAgentLine = Boolean(
                  isMatchingFile && codeAnnotation && row.number && row.number >= codeAnnotation.startLine && row.number <= (codeAnnotation.endLine ?? codeAnnotation.startLine)
                )
                return (
                  <div
                    key={index}
                    data-code-line={index}
                    onMouseEnter={() => setHoveredLineIndex(index)}
                    className={cn(
                      'group/coderow relative flex h-5 min-w-full w-max whitespace-pre transition-colors leading-5 items-center',
                      row.kind === 'add' && 'bg-[#ecfdf5]/85 text-[#064e3b] dark:bg-[#064e3b]/22 dark:text-ink border-l-2 border-emerald-500/70',
                      row.kind === 'del' && 'bg-[#fff1f2]/85 text-[#881337] dark:bg-[#881337]/22 dark:text-ink border-l-2 border-rose-500/70',
                      active && 'bg-accent/20 ring-1 ring-accent ring-inset',
                      targetLine === index && targetSequence !== undefined && 'bg-warn/15 ring-1 ring-inset ring-warn',
                      isAgentLine && 'bg-violet-500/20 ring-1 ring-inset ring-violet-500 border-l-2 border-violet-500 text-violet-100',
                      isHovered && !active && !isAgentLine && (row.kind ? 'brightness-95' : 'bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]')
                    )}
                  >
                    <span className="w-10 shrink-0 pr-2 text-right text-ink-soft select-none font-mono">{row.number}</span>
                    <GitDiffCodeText
                      kind={row.kind ?? 'context'}
                      text={row.text}
                      tokens={tokens?.[index]}
                      searchNeedle={needle}
                      isActiveLine={active}
                      wrap={false}
                      diffRanges={row.diffRanges}
                    />
                    {isAgentLine && codeAnnotation && row.number === codeAnnotation.startLine && (
                      <span className="ml-auto mr-2 inline-flex shrink-0 items-center gap-1.5 rounded bg-violet-600/90 px-2 py-0.5 text-[11px] font-sans font-medium text-white shadow-xs z-10">
                        <LuBot className="size-3 shrink-0" />
                        <span className="max-w-[280px] truncate" title={codeAnnotation.message}>
                          {codeAnnotation.title ? `${codeAnnotation.title}: ` : ''}
                          {codeAnnotation.message}
                        </span>
                        <button
                          type="button"
                          title="清除标记"
                          onClick={(e) => {
                            e.stopPropagation()
                            spotlight?.clearCodeAnnotation()
                          }}
                          className="cursor-pointer hover:text-violet-200"
                        >
                          <LuX className="size-3" />
                        </button>
                      </span>
                    )}
                    {blame && !isAgentLine && (
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
          </div>
        )}
      </ScrollArea>
    </section>
  )
}
