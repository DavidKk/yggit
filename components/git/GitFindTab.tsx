'use client'

import React from 'react'

import { cn } from '@/lib/utils'

interface GitFindTabProps {
  current: number
  total: number
  zeroText?: string
  className?: string
}

/**
 * Inverted trapezoid counter tab seamlessly fused to the bottom edge of a find/search bar.
 */
export function GitFindTab({ current, total, zeroText = '未找到', className }: GitFindTabProps) {
  const isZero = total === 0

  return (
    <div
      className={cn(
        'relative -mt-[1px] z-30 h-[18px] min-w-[76px] px-2.5 self-end flex items-center justify-center select-none animate-in fade-in slide-in-from-top-1 duration-150',
        className
      )}
      aria-live="polite"
    >
      {/* SVG inverted trapezoid container (wider at top, narrower at bottom) */}
      <svg className="absolute inset-0 size-full overflow-visible pointer-events-none drop-shadow-xs" preserveAspectRatio="none" viewBox="0 0 80 18">
        <polygon points="0,0 80,0 72,18 8,18" className="fill-panel" />
        <path d="M 0 0 L 8 18 L 72 18 L 80 0" fill="none" className="stroke-accent/60" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Mask seam with the search bar above */}
      <div className="absolute -top-[1px] left-[1px] right-[1px] h-[2px] bg-panel pointer-events-none" />

      {/* Counter text */}
      <div className="relative z-10 flex items-center justify-center text-[10px] font-mono leading-none tracking-tight tabular-nums">
        {isZero ? (
          <span className="font-medium text-fail">{zeroText}</span>
        ) : (
          <span>
            <span className="font-semibold text-ink">{current + 1}</span>
            <span className="mx-0.5 opacity-50">/</span>
            <span className="text-ink-soft">{total}</span>
          </span>
        )}
      </div>
    </div>
  )
}
