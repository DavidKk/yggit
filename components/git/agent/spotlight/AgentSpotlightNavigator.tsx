'use client'

import React, { useEffect } from 'react'
import { LuChevronLeft, LuChevronRight, LuSparkles, LuX } from 'react-icons/lu'

import { useSpotlight } from '@/lib/agent/spotlight-context'

export function AgentSpotlightNavigator() {
  const { active, targets, currentIndex, currentTarget, nextTarget, prevTarget, clearSpotlight } = useSpotlight()

  // Global hotkey support for p / n / Esc when spotlight is active
  useEffect(() => {
    if (!active) return

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
        clearSpotlight()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, nextTarget, prevTarget, clearSpotlight])

  if (!active || targets.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Agent Spotlight Stepper"
      className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 rounded-full border border-border/80 bg-background/90 px-3.5 py-1.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
        <LuSparkles className="h-3.5 w-3.5 animate-pulse" />
        <span>Agent 聚焦巡检</span>
      </div>

      <div className="h-3.5 w-px bg-border/60" />

      {/* Stepper info */}
      <div className="flex items-center gap-1 text-xs">
        <button
          type="button"
          onClick={prevTarget}
          title="上一个聚焦提交 (快捷键: p)"
          className="rounded p-1 text-muted-foreground hover:bg-muted/30 hover:text-foreground active:scale-95"
          aria-label="Previous Spotlight Commit"
        >
          <LuChevronLeft className="h-4 w-4" />
        </button>

        <span className="font-mono text-xs font-medium px-1 text-foreground">
          {currentIndex + 1} / {targets.length}
        </span>

        <button
          type="button"
          onClick={nextTarget}
          title="下一个聚焦提交 (快捷键: n)"
          className="rounded p-1 text-muted-foreground hover:bg-muted/30 hover:text-foreground active:scale-95"
          aria-label="Next Spotlight Commit"
        >
          <LuChevronRight className="h-4 w-4" />
        </button>
      </div>

      {currentTarget && (
        <>
          <div className="h-3.5 w-px bg-border/60" />
          <div className="flex items-center gap-1.5 max-w-[280px] truncate text-xs">
            <span className="rounded bg-muted/30 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">{currentTarget.shortHash || currentTarget.hash.slice(0, 7)}</span>
            <span className="truncate text-muted-foreground" title={currentTarget.subject || currentTarget.reason}>
              {currentTarget.subject || currentTarget.reason}
            </span>
          </div>
        </>
      )}

      <div className="h-3.5 w-px bg-border/60" />

      {/* Exit Button */}
      <button
        type="button"
        onClick={clearSpotlight}
        title="退出高亮聚焦 (快捷键: Esc)"
        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground active:scale-95"
        aria-label="Exit Spotlight"
      >
        <LuX className="h-3.5 w-3.5" />
        <span>退出</span>
      </button>
    </div>
  )
}
