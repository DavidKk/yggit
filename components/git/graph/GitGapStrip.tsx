'use client'

import { type RefObject, useId } from 'react'
import { LuArrowUp, LuEllipsis, LuLoader } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { type GapRail, laneColor, xAt } from '@/lib/git/graph-scene'

const GAP_HEIGHT = 40

interface GitGapStripProps {
  columns: string
  contentWidth: number
  hiddenCount: number
  upperRails?: GapRail[]
  lowerRails?: GapRail[]
  loadCount?: number
  loading?: boolean
  canJumpTop?: boolean
  sentinelRef?: RefObject<HTMLDivElement | null>
  onLoadPrev?: () => void
  onJumpTop?: () => void
}

/**
 * Lightweight inline fold separator across an unloaded commit range (`A -> Gap B -> C`).
 * Keeps branch/graph columns transparent with per-lane fading dashed rails aligned to adjacent segments,
 * and shows a rounded neutral pill with plain-text actions in the message column.
 */
export function GitGapStrip({
  columns,
  contentWidth,
  hiddenCount,
  upperRails = [],
  lowerRails = [],
  loadCount = 50,
  loading = false,
  canJumpTop = false,
  sentinelRef,
  onLoadPrev,
  onJumpTop,
}: GitGapStripProps) {
  const t = useT()
  const gradPrefix = useId().replace(/:/g, '')
  const nextBatch = Math.max(1, Math.min(loadCount, hiddenCount))

  const lowerLaneSet = new Set(lowerRails.map((r) => r.lane))
  const hasUpper = upperRails.length > 0
  const displayRails: Array<GapRail & { connectsBelow: boolean }> = hasUpper
    ? upperRails.map((rail) => ({ ...rail, connectsBelow: lowerLaneSet.has(rail.lane) }))
    : (lowerRails.length > 0 ? lowerRails : [{ lane: 0, color: 0 }]).map((rail) => ({
        ...rail,
        connectsBelow: true,
      }))

  return (
    <div
      ref={sentinelRef}
      data-git-history-gap
      className="group/gap relative grid min-h-[40px] w-full items-center bg-transparent text-xs text-ink-soft select-none"
      style={{ gridTemplateColumns: columns }}
      role="status"
      aria-live="polite"
    >
      <div className="h-full" aria-hidden />
      <div
        data-git-graph-pan
        className="pointer-events-none h-[40px] w-full min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-hidden
      >
        <div className="relative" style={{ width: contentWidth, height: GAP_HEIGHT }}>
          <svg width={contentWidth} height={GAP_HEIGHT} className="block overflow-visible">
            <defs>
              {displayRails.map((rail, idx) => {
                const color = laneColor(rail.color)
                const startOpacity = hasUpper ? 0.85 : 0.14
                const midOpacity = rail.connectsBelow ? 0.55 : 0.42
                const endOpacity = hasUpper ? (rail.connectsBelow ? 0.82 : 0.14) : 0.88
                return (
                  <linearGradient key={`${rail.lane}-${idx}`} id={`${gradPrefix}-rail-${idx}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={GAP_HEIGHT}>
                    <stop offset="0%" stopColor={color} stopOpacity={startOpacity} />
                    <stop offset="50%" stopColor={color} stopOpacity={midOpacity} />
                    <stop offset="100%" stopColor={color} stopOpacity={endOpacity} />
                  </linearGradient>
                )
              })}
            </defs>
            {displayRails.map((rail, idx) => {
              const x = xAt(rail.lane)
              return (
                <line
                  key={`${rail.lane}-${idx}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={GAP_HEIGHT}
                  stroke={`url(#${gradPrefix}-rail-${idx})`}
                  strokeWidth={rail.lane === 0 ? 2.4 : 1.8}
                  strokeDasharray="3 3"
                  strokeLinecap="round"
                />
              )
            })}
          </svg>
        </div>
      </div>
      <div className="flex min-w-0 items-center py-1 pl-2 pr-3">
        <div className="flex h-[30px] w-full min-w-0 items-center gap-2 rounded-md bg-[color-mix(in_oklab,var(--ink)_4.5%,transparent)] px-3 text-xs text-ink-soft">
          {loading ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-accent">
              <LuLoader className="size-3.5 shrink-0 animate-spin" aria-hidden />
              <span className="truncate">{t('git.history.loadingNewer')}</span>
            </span>
          ) : (
            <>
              <LuEllipsis className="size-3.5 shrink-0 opacity-65" aria-hidden />
              <span className="truncate">{t('git.history.gapCommits', { count: String(hiddenCount) })}</span>
              {onLoadPrev ? (
                <button
                  type="button"
                  onClick={onLoadPrev}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-0.5 font-medium text-ink transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)]"
                >
                  <LuArrowUp className="size-3 text-ink-soft" aria-hidden />
                  <span>{t('git.history.loadNewer', { count: String(nextBatch) })}</span>
                </button>
              ) : null}
              {canJumpTop && onJumpTop ? (
                <button
                  type="button"
                  onClick={onJumpTop}
                  className="ml-auto inline-flex shrink-0 cursor-pointer items-center rounded px-2 py-0.5 text-[11px] font-medium text-ink-soft opacity-65 transition-all group-hover/gap:opacity-100 hover:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:text-ink"
                >
                  <span>{t('git.history.jumpToTop')}</span>
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
