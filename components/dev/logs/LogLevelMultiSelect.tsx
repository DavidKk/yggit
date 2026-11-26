'use client'

import { type RefObject, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoCheckmark, IoChevronDown } from 'react-icons/io5'

import { useT } from '@/components/i18n/LocaleProvider'
import { logBadgeClass } from '@/components/layoutClasses'
import { controlDisabled, formControlChrome } from '@/components/sk/control'
import { useFloatingPanel } from '@/components/sk/useFloatingPanel'
import type { LogLevel } from '@/lib/logger'
import { cn } from '@/lib/utils'

export const LOG_LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'debug']

export type LogLevelMultiSelectProps = {
  value: ReadonlySet<LogLevel>
  onChange: (next: ReadonlySet<LogLevel>) => void
  className?: string
  disabled?: boolean
}

function toggleLevel(current: ReadonlySet<LogLevel>, level: LogLevel): Set<LogLevel> {
  const next = new Set(current)
  if (next.has(level)) next.delete(level)
  else next.add(level)
  return next
}

/** Measure how many colored level badges fit cleanly inside the trigger without clipping. */
function useVisibleTagCount(selected: readonly LogLevel[], tagsRef: RefObject<HTMLSpanElement | null>, measureRef: RefObject<HTMLSpanElement | null>) {
  const [visibleCount, setVisibleCount] = useState(selected.length)

  useLayoutEffect(() => {
    const tagsEl = tagsRef.current
    const measureEl = measureRef.current
    if (!tagsEl || !measureEl || selected.length === 0) {
      setVisibleCount(0)
      return
    }

    const measure = () => {
      const avail = tagsEl.clientWidth
      if (avail <= 0) {
        setVisibleCount(selected.length)
        return
      }

      const badgeEls = measureEl.querySelectorAll<HTMLElement>('[data-level-tag]')
      const moreEl = measureEl.querySelector<HTMLElement>('[data-level-more]')
      const moreW = moreEl?.offsetWidth ?? 12
      const styles = getComputedStyle(measureEl)
      const gap = Number.parseFloat(styles.columnGap || styles.gap || '4') || 4

      let total = 0
      for (let i = 0; i < badgeEls.length; i++) {
        total += badgeEls[i].offsetWidth + (i > 0 ? gap : 0)
      }
      if (total <= avail + 0.5) {
        setVisibleCount(badgeEls.length)
        return
      }

      let used = 0
      let fit = 0
      for (let i = 0; i < badgeEls.length; i++) {
        const w = badgeEls[i].offsetWidth
        const nextUsed = fit === 0 ? w : used + gap + w
        if (nextUsed + gap + moreW > avail + 0.5) break
        used = nextUsed
        fit += 1
      }

      setVisibleCount(fit)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(tagsEl)
    return () => ro.disconnect()
  }, [measureRef, selected, tagsRef])

  return visibleCount
}

/** Multi-select dropdown for log levels with colored badge tags inside the trigger. */
export function LogLevelMultiSelect({ value, onChange, className, disabled = false }: LogLevelMultiSelectProps) {
  const t = useT()
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const tagsRef = useRef<HTMLSpanElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const selected = LOG_LEVELS.filter((level) => value.has(level))
  const visibleCount = useVisibleTagCount(selected, tagsRef, measureRef)
  const truncated = selected.length > 0 && visibleCount < selected.length
  const shown = truncated ? selected.slice(0, Math.max(visibleCount, 1)) : selected
  const levelLabel = t('gitAgent.devLogsColLevel') || 'Level'
  const emptyLabel = t('gitAgent.devLogsAllLevels') || 'All Levels'
  const title = selected.join(', ') || emptyLabel

  const panelStyle = useFloatingPanel({
    open,
    anchorRef: rootRef,
    panelRef,
    maxHeight: 220,
    widthMode: 'content',
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      const path = event.composedPath()
      const root = rootRef.current
      const panel = panelRef.current
      if ((root && path.includes(root)) || (panel && path.includes(panel))) return
      close()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [close, open])

  const rootNode = rootRef.current?.getRootNode()
  const portalContainer = typeof document === 'undefined' ? null : typeof ShadowRoot !== 'undefined' && rootNode instanceof ShadowRoot ? rootNode : document.body

  const panel =
    mounted && open && portalContainer
      ? createPortal(
          <div
            ref={panelRef}
            id={listboxId}
            className="fixed z-[60] flex w-max min-w-[7.5rem] flex-col overflow-hidden rounded-md border border-line bg-[var(--panel-2)] shadow-[0_12px_32px_rgb(0_0_0_/_0.35)]"
            style={panelStyle}
            role="presentation"
          >
            <ul className="m-0 list-none p-1" role="listbox" aria-label={levelLabel} aria-multiselectable="true">
              {LOG_LEVELS.map((level) => {
                const checked = value.has(level)
                return (
                  <li key={level} className="m-0" role="option" aria-selected={checked}>
                    <button
                      type="button"
                      className={cn(
                        'm-0 flex w-full appearance-none cursor-pointer items-center gap-2 rounded border-none bg-transparent px-2 py-1.5 text-left font-inherit text-ink',
                        'hover:bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]',
                        checked && 'bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]'
                      )}
                      onClick={() => onChange(toggleLevel(value, level))}
                    >
                      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-accent" aria-hidden>
                        <IoCheckmark className={cn(!checked && 'invisible')} size={14} />
                      </span>
                      <span className={cn(logBadgeClass(level), 'px-1.5 py-0.5 text-[10px]')}>{level}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>,
          portalContainer
        )
      : null

  return (
    <div ref={rootRef} className={cn('relative inline-block w-44 min-w-[8.5rem] shrink-0', className)}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          formControlChrome,
          'relative flex w-full cursor-pointer items-center justify-between gap-1.5 px-2.5 py-0',
          'hover:enabled:border-ink-soft/40',
          open && 'border-accent',
          controlDisabled
        )}
        aria-label={levelLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        title={title}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
        }}
      >
        <span ref={measureRef} className="pointer-events-none absolute top-0 left-0 flex flex-nowrap items-center gap-1 whitespace-nowrap invisible" aria-hidden>
          {selected.map((level) => (
            <span key={level} data-level-tag className={cn(logBadgeClass(level), 'px-1.5 py-0.5 text-[10px]')}>
              {level}
            </span>
          ))}
          <span data-level-more className="shrink-0 select-none text-xs leading-none text-ink-soft">
            …
          </span>
        </span>
        <span ref={tagsRef} className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden">
          {selected.length === 0 ? (
            <span className="truncate text-xs text-ink-soft">{emptyLabel}</span>
          ) : (
            <>
              {shown.map((level) => (
                <span key={level} className={cn(logBadgeClass(level), 'px-1.5 py-0.5 text-[10px]')}>
                  {level}
                </span>
              ))}
              {truncated ? (
                <span className="shrink-0 select-none text-xs leading-none text-ink-soft" aria-hidden>
                  …
                </span>
              ) : null}
            </>
          )}
        </span>
        <IoChevronDown className={cn('shrink-0 text-ink-soft transition-transform', open && 'rotate-180')} size={13} aria-hidden />
      </button>
      {panel}
    </div>
  )
}
