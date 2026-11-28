'use client'

import type { RefObject } from 'react'
import { LuArrowUp, LuLoader } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { cn } from '@/lib/utils'

interface GitGapStripProps {
  columns: string
  hiddenCount: number
  loadCount?: number
  loading?: boolean
  canJumpTop?: boolean
  sentinelRef?: RefObject<HTMLDivElement | null>
  onLoadPrev?: () => void
  onJumpTop?: () => void
}

/**
 * Visual separator across an unloaded commit range (`A -> Gap B -> C`).
 * Renders dashed continuation cues aligned to the graph column alongside upward load and jump-to-top actions.
 */
export function GitGapStrip({ columns, hiddenCount, loadCount = 50, loading = false, canJumpTop = false, sentinelRef, onLoadPrev, onJumpTop }: GitGapStripProps) {
  const t = useT()
  const nextBatch = Math.max(1, Math.min(loadCount, hiddenCount))

  return (
    <div
      ref={sentinelRef}
      data-git-history-gap
      className={cn(
        'relative grid min-h-[40px] w-full items-center border-y border-dashed border-[color-mix(in_oklab,var(--ink)_14%,transparent)] bg-[color-mix(in_oklab,var(--panel-2,var(--panel))_65%,transparent)] text-xs text-ink-soft select-none'
      )}
      style={{ gridTemplateColumns: columns }}
      role="status"
      aria-live="polite"
    >
      <div className="flex h-full items-center justify-end pr-2 text-[11px] opacity-75">
        <span className="h-3 w-px border-l border-dashed border-[color-mix(in_oklab,var(--ink-soft)_35%,transparent)]" aria-hidden />
      </div>
      <div className="flex h-full items-center justify-start pl-[20px]" aria-hidden>
        <div className="flex items-center gap-4">
          <span className="h-9 w-0.5 rounded-full bg-[repeating-linear-gradient(to_bottom,color-mix(in_oklab,var(--wt-primary,var(--accent))_65%,transparent)_0_4px,transparent_4px_9px)] opacity-70" />
          <span className="h-9 w-px rounded-full bg-[repeating-linear-gradient(to_bottom,color-mix(in_oklab,var(--ink-soft)_40%,transparent)_0_3px,transparent_3px_8px)] opacity-50" />
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 px-2 py-1">
        {loading ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent">
            <LuLoader className="size-3.5 animate-spin" aria-hidden />
            <span>{t('git.history.loadingNewer')}</span>
          </span>
        ) : (
          <>
            <span className="truncate text-[11px] text-ink-soft">{t('git.history.gapCommits', { count: String(hiddenCount) })}</span>
            {onLoadPrev ? (
              <button
                type="button"
                onClick={onLoadPrev}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border border-line/80 bg-panel px-2 py-0.5 text-[11px] font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
              >
                <LuArrowUp className="size-3" aria-hidden />
                <span>{t('git.history.loadNewer', { count: String(nextBatch) })}</span>
              </button>
            ) : null}
            {canJumpTop && onJumpTop ? (
              <button
                type="button"
                onClick={onJumpTop}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-ink-soft transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] hover:text-ink"
              >
                <span>{t('git.history.jumpToTop')}</span>
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
