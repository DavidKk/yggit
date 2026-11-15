'use client'

import React, { type ReactNode } from 'react'
import { FiHelpCircle } from 'react-icons/fi'

import { Tooltip } from '@/components/sk'
import { cn } from '@/lib/utils'

export interface SettingsSectionCardProps {
  /** Card title; can be string or ReactNode with icon */
  title: ReactNode
  /** Card description text beneath title */
  description?: string
  /** Tooltip content for description help trigger */
  descriptionTooltip?: string
  /** Right-aligned header action or badge */
  titleAction?: ReactNode
  /** High-density mode */
  compact?: boolean
  className?: string
  children: ReactNode
}

/**
 * Standard configuration section card matching ticket-janitor / Calm Ops layout.
 * Encloses all form controls, helper text, and action buttons in a structured boundary.
 */
export function SettingsSectionCard({ title, description, descriptionTooltip, titleAction, compact = false, className, children }: SettingsSectionCardProps) {
  return (
    <section
      data-settings-card=""
      className={cn('grid w-full min-w-0 rounded-lg border border-line bg-panel shadow-sm [&>*]:min-w-0', compact ? 'gap-3 p-3' : 'gap-4 p-4', className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line/50 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
            <span>{title}</span>
            {descriptionTooltip ? (
              <Tooltip content={descriptionTooltip} placement="bottom">
                <button
                  type="button"
                  className="inline-flex shrink-0 rounded text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  aria-label={typeof title === 'string' ? `${title} 说明` : '说明'}
                >
                  <FiHelpCircle className="size-3.5" aria-hidden="true" />
                </button>
              </Tooltip>
            ) : null}
          </div>
          {description ? <p className="mt-0.5 text-xs text-ink-soft leading-relaxed">{description}</p> : null}
        </div>
        {titleAction ? <div className="shrink-0">{titleAction}</div> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}
