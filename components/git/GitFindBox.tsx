'use client'

import React from 'react'
import { LuChevronDown, LuChevronUp, LuSearch, LuX } from 'react-icons/lu'

import { Button } from '@/components/sk'
import { cn } from '@/lib/utils'

export type GitFindBoxSize = 'wide' | 'medium' | 'narrow' | 'auto'

export interface GitFindBoxProps {
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  current: number
  total: number
  placeholder?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
  className?: string
  ariaLabel?: string
  /**
   * Reference width variants matching design specs:
   * - 'wide' ≈ 260px
   * - 'medium' ≈ 220px
   * - 'narrow' ≈ 180px (counter collapsed)
   * - 'auto' (default): 260px with container responsiveness
   */
  size?: GitFindBoxSize
}

/**
 * Two-tier (上下分层式 - 方案 A) Find Box widget for Git panels:
 * Top row: [ Search Icon | Search Input | Close (×) ]
 * Bottom row: [ Match count (e.g. 2 / 18 条) | Prev (^) | Next (v) ]
 * Supports 宽 (≈260px), 中 (≈220px), and 窄 (≈180px) adaptation without button clipping.
 */
export function GitFindBox({
  value,
  onChange,
  onClose,
  onPrev,
  onNext,
  current,
  total,
  placeholder = '搜索…',
  inputRef,
  className,
  ariaLabel = '搜索内容',
  size = 'auto',
}: GitFindBoxProps) {
  const needle = value.trim()

  const sizeClass = size === 'wide' ? 'w-[260px]' : size === 'medium' ? 'w-[220px]' : size === 'narrow' ? 'w-[180px]' : 'w-[260px] max-w-[min(100%-1rem,260px)]'

  const isNarrow = size === 'narrow'

  return (
    <div
      role="search"
      aria-label={ariaLabel}
      className={cn(
        '@container flex flex-col rounded-2xl border border-line/80 bg-panel/95 p-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150 select-none z-30',
        sizeClass,
        className
      )}
    >
      {/* Top tier: Input with search icon and close/clear (×) */}
      <div className="flex h-8 items-center gap-1.5 rounded-xl border border-accent/80 bg-panel px-2.5 transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 shadow-2xs">
        <LuSearch className="size-3.5 shrink-0 text-ink-soft pointer-events-none" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-ink-soft/60 outline-none font-medium"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (e.shiftKey) {
                onPrev()
              } else {
                onNext()
              }
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
        />
        <button
          type="button"
          aria-label="关闭搜索 (Esc)"
          title="关闭搜索 (Esc)"
          onClick={onClose}
          className="size-5 shrink-0 flex items-center justify-center rounded text-ink-soft hover:text-ink hover:bg-[var(--overlay-08)] active:scale-95 transition-all cursor-pointer"
        >
          <LuX className="size-3.5" aria-hidden />
        </button>
      </div>

      {/* Bottom tier: Results count on left, Prev & Next navigation on right (No bottom close icon) */}
      <div className="flex items-center justify-between gap-1.5 px-1 pt-1.5 min-h-[28px]">
        {/* Count indicator: hidden in narrow mode or when container width < 200px */}
        <div className={cn('min-w-0 flex-1 truncate text-[11px] font-mono leading-none transition-all', isNarrow ? 'hidden' : '@max-[199px]:hidden')} aria-live="polite">
          {!needle ? (
            <span className="text-ink-soft/50">—</span>
          ) : total === 0 ? (
            <span className="font-semibold text-fail">0 条</span>
          ) : (
            <span className="tabular-nums text-ink-soft">
              <span className="font-semibold text-ink">{(current >= 0 ? current : 0) + 1}</span>
              <span className="mx-0.5 opacity-60">/</span>
              <span>{total} 条</span>
            </span>
          )}
        </div>

        {/* Navigation buttons: Up (^) and Down (v) */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <Button
            variant="plain"
            size="icon"
            className="size-7 shrink-0 rounded-lg border border-line/70 bg-panel-2/70 hover:bg-panel hover:text-ink text-ink-soft shadow-2xs flex items-center justify-center p-0 active:scale-95 transition-all disabled:opacity-35"
            aria-label="上一个匹配 (Shift+Enter)"
            title="上一个匹配 (Shift+Enter)"
            disabled={total === 0}
            onClick={onPrev}
          >
            <LuChevronUp className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="plain"
            size="icon"
            className="size-7 shrink-0 rounded-lg border border-line/70 bg-panel-2/70 hover:bg-panel hover:text-ink text-ink-soft shadow-2xs flex items-center justify-center p-0 active:scale-95 transition-all disabled:opacity-35"
            aria-label="下一个匹配 (Enter)"
            title="下一个匹配 (Enter)"
            disabled={total === 0}
            onClick={onNext}
          >
            <LuChevronDown className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
