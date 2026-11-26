'use client'

import React from 'react'
import { LuArrowUpRight, LuQuote, LuSparkles, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { useWorkdeskProactiveReminder } from '@/lib/agent/useWorkdeskProactiveReminder'
import type { GitProjectView } from '@/lib/git/types'
import { cn } from '@/lib/utils'

export interface GitAgentAssistiveReminderProps {
  variant?: 'floating' | 'embedded'
  className?: string
  projects?: GitProjectView[]
  barPosition?: { x: number; y: number } | null
  isBarExpanded?: boolean
}

export function GitAgentAssistiveReminder({ variant = 'floating', className, projects, barPosition, isBarExpanded = false }: GitAgentAssistiveReminderProps) {
  const t = useT()
  const { reminder, isProcessing } = useWorkdeskProactiveReminder(projects)

  if (!reminder) return null

  // Do not show floating popup when agent bar is expanded or busy processing
  if (variant === 'floating' && (isBarExpanded || isProcessing)) {
    return null
  }

  // Floating variant anchored directly above the bottom Agent bar (Compact Mode)
  if (variant === 'floating') {
    const isCustomPosition = barPosition && typeof barPosition.x === 'number' && typeof barPosition.y === 'number'
    const cardWidth = 460
    const floatingStyle: React.CSSProperties = isCustomPosition
      ? {
          position: 'fixed',
          left: `${Math.max(12, Math.min(window.innerWidth - cardWidth - 12, barPosition.x + 66 - cardWidth / 2))}px`,
          bottom: `${window.innerHeight - barPosition.y + 12}px`,
        }
      : {}

    return (
      <aside
        role="complementary"
        aria-label={reminder.title}
        style={floatingStyle}
        className={cn(
          'fixed z-40 w-[min(94vw,460px)] rounded-2xl border border-emerald-500/25 dark:border-emerald-500/35 bg-panel/95 px-4 pt-3 pb-3.5 shadow-xl backdrop-blur-md select-none',
          'animate-in fade-in slide-in-from-bottom-2 duration-250',
          !isCustomPosition && 'bottom-[72px] left-1/2 -translate-x-1/2',
          className
        )}
      >
        {/* Header Row: Yggi Badge + | + Title + Close Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 leading-none">Yggi</span>
            <span className="mx-0.5 text-xs text-ink-muted/40 font-light" aria-hidden>
              |
            </span>
            <span className="truncate text-xs font-normal text-ink-soft">{t('gitAgent.proactiveBadge') || 'Workspace Assistant'}</span>
          </div>
          <button
            type="button"
            onClick={reminder.dismiss}
            className="flex size-5 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-[var(--overlay-06)] hover:text-ink active:scale-90 transition-all cursor-pointer"
            aria-label={t('common.close') || 'Close'}
            title={t('gitAgent.proactiveDismiss') || 'Later'}
          >
            <LuX className="size-4" />
          </button>
        </div>

        {/* Message Body: Crisp compact typography */}
        <p className="mt-2 mb-3 text-[13px] leading-normal text-ink font-normal select-text">{reminder.message}</p>

        {/* Action Button Controls: Clean whitespace row without top border */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void reminder.accept()}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              <LuSparkles className="size-3.5" />
              <span>{reminder.actionLabel}</span>
            </button>
            <button
              type="button"
              onClick={reminder.quote}
              className="flex items-center gap-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-medium text-ink hover:border-accent/40 hover:bg-accent/10 hover:text-accent active:scale-95 transition-all cursor-pointer"
            >
              <LuQuote className="size-3.5" />
              <span>{t('gitAgent.proactiveActionQuote') || 'Ask Follow-up'}</span>
            </button>
            <button
              type="button"
              onClick={reminder.viewTask}
              className="group flex items-center gap-1 text-xs font-normal text-ink-soft hover:text-accent active:scale-95 transition-colors cursor-pointer select-none"
            >
              <span>{t('gitAgent.proactiveActionView') || 'View Tasks'}</span>
              <LuArrowUpRight className="size-3.5 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>
          <button type="button" onClick={reminder.dismiss} className="ml-auto text-xs text-ink-soft hover:text-ink font-normal px-2 py-1 rounded transition-colors cursor-pointer">
            {t('gitAgent.proactiveDismiss') || 'Later'}
          </button>
        </div>
      </aside>
    )
  }

  // Embedded variant (inside AgentWorkspace drawer)
  return (
    <aside
      role="complementary"
      aria-label={reminder.title}
      className={cn('rounded-lg border border-accent/35 bg-accent/5 p-2 text-xs text-ink space-y-1.5 select-none shadow-xs', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-accent text-[10px] leading-none">Yggi</span>
          <span className="text-[10px] text-ink-soft/40 font-light" aria-hidden>
            |
          </span>
          <span className="text-[11px] font-medium text-ink-soft">{t('gitAgent.proactiveBadge') || 'Workspace Assistant'}</span>
        </div>
        <button
          type="button"
          onClick={reminder.dismiss}
          className="flex size-4 items-center justify-center rounded text-ink-soft hover:text-ink cursor-pointer"
          aria-label={t('common.close') || 'Close'}
        >
          <LuX className="size-3" />
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-soft">{reminder.message}</p>

      <div className="flex items-center gap-2 pt-0.5 border-t border-line/30">
        <button
          type="button"
          onClick={() => void reminder.accept()}
          className="flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-xs"
        >
          <LuSparkles className="size-2.5" />
          <span>{reminder.actionLabel}</span>
        </button>
        <button
          type="button"
          onClick={reminder.quote}
          className="flex items-center gap-1 rounded border border-line bg-panel px-1.5 py-0.5 text-[11px] font-medium text-ink hover:border-accent/40 hover:bg-accent/10 hover:text-accent active:scale-95 transition-all cursor-pointer"
        >
          <LuQuote className="size-2.5" />
          <span>{t('gitAgent.proactiveActionQuote') || 'Ask Follow-up'}</span>
        </button>
        <button type="button" onClick={reminder.viewTask} className="group flex items-center gap-0.5 text-[11px] text-ink-soft hover:text-accent transition-colors cursor-pointer">
          <span>{t('gitAgent.proactiveActionView') || 'View Tasks'}</span>
          <LuArrowUpRight className="size-3 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
        <button type="button" onClick={reminder.dismiss} className="text-[10px] text-ink-soft hover:text-ink ml-auto px-1 py-0.5 cursor-pointer">
          {t('gitAgent.proactiveDismiss') || 'Later'}
        </button>
      </div>
    </aside>
  )
}
