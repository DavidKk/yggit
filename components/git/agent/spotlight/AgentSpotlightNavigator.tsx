'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LuChevronLeft, LuChevronRight, LuSparkles, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk'
import { useSpotlight } from '@/lib/agent/spotlight-context'
import { cn } from '@/lib/utils'

export function AgentSpotlightNavigator() {
  const t = useT()
  const { active, targets, currentIndex, currentTarget, nextTarget, prevTarget, focusTarget, clearSpotlight } = useSpotlight()

  const [isClosing, setIsClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleJumpToCommit = useCallback(
    (hash: string) => {
      focusTarget(hash)
      if (typeof document !== 'undefined') {
        const safeHash = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(hash) : hash.replace(/"/g, '\\"')
        const row = document.querySelector<HTMLElement>(`[data-git-commit-hash="${safeHash}"]`)
        if (row) {
          row.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
          row.focus?.({ preventScroll: true })
        }
      }
    },
    [focusTarget]
  )

  const handleClose = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setIsClosing(false)
      clearSpotlight()
    }, 400)
  }, [isClosing, clearSpotlight])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  // Global hotkey support for p / n / Esc when spotlight is active
  useEffect(() => {
    if (!active || isClosing) return

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is currently typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
        return
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        nextTarget()
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        prevTarget()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, isClosing, nextTarget, prevTarget, handleClose])

  if ((!active || targets.length === 0) && !isClosing) return null

  return (
    <>
      <style>{`
        @keyframes spotlight-pill-vanish {
          0% {
            width: min(94vw, 580px);
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
          40% {
            width: 86px;
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
          55% {
            width: 36px;
            transform: translateX(-50%) scale(0.85);
            opacity: 1;
          }
          85% {
            width: 36px;
            transform: translateX(-50%) scale(0.2);
            opacity: 0.8;
          }
          100% {
            width: 36px;
            transform: translateX(-50%) scale(0);
            opacity: 0;
          }
        }
      `}</style>
      <div
        role="region"
        aria-label="Agent Spotlight Stepper"
        style={
          isClosing
            ? {
                transformOrigin: 'center center',
                animation: 'spotlight-pill-vanish 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
              }
            : undefined
        }
        className={cn(
          'fixed top-14 left-1/2 -translate-x-1/2 z-40 flex w-[580px] max-w-[94vw] items-center gap-2 rounded-full border border-line/80 bg-panel/95 px-3 py-1.5 shadow-xl backdrop-blur-md select-none overflow-hidden',
          isClosing ? 'pointer-events-none' : 'animate-in fade-in slide-in-from-top-2 duration-200'
        )}
      >
        <div className={cn('flex w-full min-w-0 items-center gap-2 transition-opacity duration-150', isClosing ? 'opacity-0' : 'opacity-100')}>
          {/* Title tag */}
          <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-accent">
            <LuSparkles className="size-3.5 animate-pulse shrink-0" />
            <span className="whitespace-nowrap">{t('gitAgent.spotlightTitle') || 'Agent Spotlight'}</span>
          </div>

          <div className="h-3.5 w-px shrink-0 bg-line/60" />

          {/* Stepper info: Sleek, compact capsule matching the badge height */}
          <div className="flex h-5 shrink-0 items-center rounded-full bg-panel-2/80 border border-line/60 px-0.5 shadow-2xs">
            <Tooltip content={t('gitAgent.spotlightPrev') ? `${t('gitAgent.spotlightPrev')} (p)` : 'Previous spotlight commit (p)'} placement="bottom">
              <button
                type="button"
                onClick={prevTarget}
                style={{ cursor: 'pointer' }}
                className="flex size-4 items-center justify-center rounded-full text-ink-soft hover:bg-panel hover:text-ink active:scale-90 cursor-pointer transition-all"
                aria-label="Previous Spotlight Commit"
              >
                <LuChevronLeft className="size-3 pointer-events-none" />
              </button>
            </Tooltip>

            <span className="font-mono text-[10px] font-semibold px-1 tabular-nums text-ink select-none tracking-tight">
              {currentIndex + 1}
              <span className="text-ink-soft/50 mx-0.5 font-normal">/</span>
              {targets.length}
            </span>

            <Tooltip content={t('gitAgent.spotlightNext') ? `${t('gitAgent.spotlightNext')} (n)` : 'Next spotlight commit (n)'} placement="bottom">
              <button
                type="button"
                onClick={nextTarget}
                style={{ cursor: 'pointer' }}
                className="flex size-4 items-center justify-center rounded-full text-ink-soft hover:bg-panel hover:text-ink active:scale-90 cursor-pointer transition-all"
                aria-label="Next Spotlight Commit"
              >
                <LuChevronRight className="size-3 pointer-events-none" />
              </button>
            </Tooltip>
          </div>

          {currentTarget && (
            <>
              <div className="h-3.5 w-px shrink-0 bg-line/60" />
              <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
                <Tooltip content={t('gitAgent.spotlightJump') || 'Jump to commit'} placement="bottom">
                  <button
                    type="button"
                    onClick={() => handleJumpToCommit(currentTarget.hash)}
                    style={{ cursor: 'pointer' }}
                    className="h-5 shrink-0 inline-flex items-center rounded bg-panel-2 border border-line/60 px-1.5 font-mono text-[10px] text-ink-soft hover:bg-panel hover:text-accent hover:border-accent/40 active:scale-95 transition-all cursor-pointer"
                    aria-label={`Jump to commit ${currentTarget.shortHash || currentTarget.hash.slice(0, 7)}`}
                  >
                    {currentTarget.shortHash || currentTarget.hash.slice(0, 7)}
                  </button>
                </Tooltip>
                <span className="truncate text-ink-soft text-xs" title={currentTarget.subject || currentTarget.reason}>
                  {currentTarget.subject || currentTarget.reason}
                </span>
              </div>
            </>
          )}

          <div className="h-3.5 w-px shrink-0 bg-line/60" />

          {/* Exit Button: Icon only + Tooltip */}
          <Tooltip content={t('gitAgent.spotlightClear') ? `${t('gitAgent.spotlightClear')} (Esc)` : 'Exit spotlight (Esc)'} placement="bottom">
            <button
              type="button"
              onClick={handleClose}
              style={{ cursor: 'pointer' }}
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-panel-2 hover:text-ink active:scale-90 cursor-pointer transition-colors"
              aria-label={t('gitAgent.spotlightClear') || 'Exit spotlight (Esc)'}
            >
              <LuX className="size-3.5 pointer-events-none" />
            </button>
          </Tooltip>
        </div>
      </div>
    </>
  )
}
