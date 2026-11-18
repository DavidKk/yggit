'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LuSearch } from 'react-icons/lu'

import { useGitFindPanel } from '@/components/git/gitFind'
import { GitFindBox } from '@/components/git/GitFindBox'
import { GitDiffCodeText, useGitLineTokens } from '@/components/git/GitHighlightedCode'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Spinner } from '@/components/sk'
import { cn } from '@/lib/utils'

export type CodePaneRow = { text: string; number?: number; kind?: 'context' | 'add' | 'del' }

export function GitCodePane({
  label,
  path,
  rows,
  loading,
  scrollTop,
  onScroll,
  targetLine,
  targetSequence,
}: {
  label: string
  path: string
  rows: CodePaneRow[]
  loading?: boolean
  scrollTop?: number
  onScroll?: (top: number) => void
  targetLine?: number
  targetSequence?: number
}) {
  const t = useT()
  const panelRef = useRef<HTMLElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  const [height, setHeight] = useState(400)
  const [showFind, setShowFind] = useState(false)
  useGitFindPanel(panelRef, findInputRef, () => setShowFind(true))
  const [query, setQuery] = useState('')
  const [match, setMatch] = useState(0)
  const needle = query.trim().toLowerCase()
  const lines = useMemo(() => rows.map((row) => row.text), [rows])
  const tokens = useGitLineTokens(lines, path)
  const matches = useMemo(() => (needle ? rows.flatMap((row, index) => (row.text.toLowerCase().includes(needle) ? [index] : [])) : []), [rows, needle])
  const jump = (line: number) => {
    const viewport = scroller.current?.clientHeight || 400
    const next = Math.min(Math.max(0, rows.length * 20 - viewport), Math.max(0, line * 20 - viewport / 3))
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
  useEffect(() => {
    setQuery('')
    setMatch(0)
    if (scroller.current) scroller.current.scrollTop = 0
    setTop(0)
  }, [path])
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const next = Math.min(el.scrollTop, Math.max(0, rows.length * 20 - height))
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
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-auto overscroll-none font-mono text-xs leading-5 select-text"
        onScroll={(event) => {
          setTop(event.currentTarget.scrollTop)
          onScroll?.(event.currentTarget.scrollTop)
        }}
      >
        {loading ? (
          <Spinner className="m-4 size-4" />
        ) : !rows.length ? (
          <p className="p-3 text-xs text-ink-soft">{t('git.diff.missingVersion')}</p>
        ) : (
          <div style={{ height: rows.length * 20, minWidth: '100%', width: 'max-content', position: 'relative' }}>
            <div style={{ position: 'absolute', top: start * 20, left: 0, right: 0 }}>
              {rows.slice(start, end).map((row, offset) => {
                const index = start + offset
                const active = Boolean(showFind && needle && matches[match] === index)
                return (
                  <div
                    key={index}
                    data-code-line={index}
                    className={cn(
                      'flex h-5 whitespace-pre',
                      active && 'bg-accent/20 ring-1 ring-inset ring-accent',
                      targetLine === index && targetSequence !== undefined && 'bg-warn/15 ring-1 ring-inset ring-warn'
                    )}
                  >
                    <span className="w-10 shrink-0 pr-2 text-right text-ink-soft select-none">{row.number}</span>
                    <GitDiffCodeText kind={row.kind ?? 'context'} text={row.text} tokens={tokens?.[index]} searchNeedle={needle} isActiveLine={active} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
