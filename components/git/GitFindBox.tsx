'use client'

import React, { useEffect, useRef } from 'react'
import { LuChevronDown, LuChevronUp, LuLoader, LuSearch, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button } from '@/components/sk'
import { cn } from '@/lib/utils'

export type GitFindBoxSize = 'wide' | 'medium' | 'narrow' | 'auto'

/**
 * Compact number formatting helper:
 * - < 1,000 → 123
 * - >= 1,000 → 1.2K
 * - >= 1,000,000 → 2.5M
 * - >= 1,000,000,000 → 1.1B
 */
export function formatCompactCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) {
    const val = (n / 1000).toFixed(1).replace(/\.0$/, '')
    return `${val}K`
  }
  if (n < 1_000_000_000) {
    const val = (n / 1_000_000).toFixed(1).replace(/\.0$/, '')
    return `${val}M`
  }
  const val = (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')
  return `${val}B`
}

export interface GitFindBoxProps {
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  current?: number
  total?: number
  placeholder?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
  className?: string
  ariaLabel?: string
  /**
   * Reference width variants:
   * - 'wide' ≈ 260px
   * - 'medium' ≈ 220px
   * - 'narrow' ≈ 180px
   * - 'auto' (default): 260px with container responsiveness
   */
  size?: GitFindBoxSize
  autoFocus?: boolean
  loading?: boolean
}

/**
 * Unified Two-tier (上下分层式 - 方案 A) Find Box widget for Git panels:
 * Top row: [ Search Icon | Search Input | Close (×) ]
 * Bottom row: [ Match count (e.g. 2 / 18 条, 1.2K 条) | Prev (^) | Next (v) ]
 * Supports 宽 (≈260px), 中 (≈220px), and 窄 (≈180px) adaptation without button clipping.
 */
export function GitFindBox({
  value,
  onChange,
  onClose,
  onPrev,
  onNext,
  current = 0,
  total,
  placeholder,
  inputRef: externalInputRef,
  className,
  ariaLabel,
  size = 'auto',
  autoFocus = true,
  loading = false,
}: GitFindBoxProps) {
  const t = useT()
  const localInputRef = useRef<HTMLInputElement | null>(null)
  const inputRef = externalInputRef || localInputRef
  const needle = value.trim()

  const resolvedPlaceholder = placeholder ?? (t('common.search') || '搜索…')
  const resolvedAriaLabel = ariaLabel ?? (t('common.search') || '搜索内容')

  useEffect(() => {
    if (autoFocus) {
      const doFocus = () => {
        if (inputRef.current) {
          inputRef.current.focus({ preventScroll: true })
          inputRef.current.select()
        }
      }
      doFocus()
      const t1 = setTimeout(doFocus, 0)
      const t2 = setTimeout(doFocus, 50)
      const t3 = setTimeout(doFocus, 150)
      const frame = window.requestAnimationFrame(doFocus)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
        window.cancelAnimationFrame(frame)
      }
    }
  }, [autoFocus, inputRef])

  const sizeClass = size === 'wide' ? 'w-[260px]' : size === 'medium' ? 'w-[220px]' : size === 'narrow' ? 'w-[180px]' : 'w-[260px] max-w-[min(100%-1rem,260px)]'

  const isNarrow = size === 'narrow'
  const hasNavigation = Boolean(onPrev && onNext)
  const hasTotal = total !== undefined

  // Match count text generation with K, M, B formatting
  let countDisplay: React.ReactNode = null
  if (!needle) {
    countDisplay = <span className="text-ink-soft/50">—</span>
  } else if (hasTotal) {
    if (total === 0) {
      countDisplay = <span className="font-semibold text-fail">{t('git.history.findZero') || '0 条'}</span>
    } else if (total > 999) {
      // Too many results: display compact total only with K, M, B
      countDisplay = (
        <span className="tabular-nums font-semibold text-ink" title={`${total} 条结果`}>
          {formatCompactCount(total)} 条
        </span>
      )
    } else {
      // Normal display: current / total
      countDisplay = (
        <span className="tabular-nums text-ink-soft">
          <span className="font-semibold text-ink">{(current >= 0 ? current : 0) + 1}</span>
          <span className="mx-0.5 opacity-60">/</span>
          <span>{total} 条</span>
        </span>
      )
    }
  }

  return (
    <div
      role="search"
      aria-label={resolvedAriaLabel}
      className={cn(
        '@container flex flex-col rounded-2xl border border-line/80 bg-panel/95 p-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150 select-none z-30',
        sizeClass,
        className
      )}
    >
      {/* Top tier: Input with search icon and close/clear (×) */}
      <div className="flex h-8 items-center gap-1.5 rounded-xl border border-accent/80 bg-panel px-2.5 transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 shadow-2xs">
        {loading ? (
          <LuLoader className="size-3.5 shrink-0 text-accent animate-spin" aria-hidden />
        ) : (
          <LuSearch className="size-3.5 shrink-0 text-ink-soft pointer-events-none" aria-hidden />
        )}
        <input
          ref={inputRef}
          type="text"
          autoFocus={autoFocus}
          value={value}
          placeholder={resolvedPlaceholder}
          aria-label={resolvedAriaLabel}
          className="min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-ink-soft/60 outline-none font-medium"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (e.shiftKey) {
                onPrev?.()
              } else {
                onNext?.()
              }
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label={t('common.clear') || 'Clear'}
            title={t('common.clear') || 'Clear'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onChange('')
              inputRef.current?.focus({ preventScroll: true })
            }}
            className="size-5 shrink-0 flex items-center justify-center rounded text-ink-soft hover:text-ink hover:bg-[var(--overlay-08)] active:scale-95 transition-all cursor-pointer"
          >
            <LuX className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Bottom tier: Results count on left, Prev & Next navigation on right */}
      {(hasTotal || hasNavigation) && (
        <div className="flex items-center justify-between gap-1.5 px-1 pt-1.5 min-h-[28px]">
          {/* Count indicator: hidden in narrow mode or when container width < 200px */}
          <div className={cn('min-w-0 flex-1 truncate text-[11px] font-mono leading-none transition-all', isNarrow ? 'hidden' : '@max-[199px]:hidden')} aria-live="polite">
            {countDisplay}
          </div>

          {/* Navigation buttons: Up (^) and Down (v) */}
          {hasNavigation && (
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <Button
                variant="plain"
                size="icon"
                className="size-7 shrink-0 rounded-lg border border-line/70 bg-panel-2/70 hover:bg-panel hover:text-ink text-ink-soft shadow-2xs flex items-center justify-center p-0 active:scale-95 transition-all disabled:opacity-35"
                aria-label={`${t('git.history.prev') || 'Previous'} (Shift+Enter)`}
                title={`${t('git.history.prev') || 'Previous'} (Shift+Enter)`}
                disabled={total === 0}
                onClick={onPrev}
              >
                <LuChevronUp className="size-3.5" aria-hidden />
              </Button>
              <Button
                variant="plain"
                size="icon"
                className="size-7 shrink-0 rounded-lg border border-line/70 bg-panel-2/70 hover:bg-panel hover:text-ink text-ink-soft shadow-2xs flex items-center justify-center p-0 active:scale-95 transition-all disabled:opacity-35"
                aria-label={`${t('git.history.next') || 'Next'} (Enter)`}
                title={`${t('git.history.next') || 'Next'} (Enter)`}
                disabled={total === 0}
                onClick={onNext}
              >
                <LuChevronDown className="size-3.5" aria-hidden />
              </Button>
              <Button
                variant="plain"
                size="icon"
                className="size-7 shrink-0 rounded-lg border border-line/70 bg-panel-2/70 hover:bg-panel hover:text-ink text-ink-soft shadow-2xs flex items-center justify-center p-0 active:scale-95 transition-all"
                aria-label={`${t('git.history.closeFind') || t('common.close') || 'Close'} (Esc)`}
                title={`${t('git.history.closeFind') || t('common.close') || 'Close'} (Esc)`}
                onClick={onClose}
              >
                <LuX className="size-3.5" aria-hidden />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
