'use client'

import React, { useState } from 'react'

import { cn } from '@/lib/utils'
import type { SpotlightTarget } from '@/services/git/agent-impact'

import { AnnotationPopover } from './AnnotationPopover'

interface Props {
  target: SpotlightTarget
  className?: string
}

export function AnnotationBadge({ target, className }: Props) {
  const [open, setOpen] = useState(false)

  const gradeColors = {
    Fact: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Derived: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    Hypothesis: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  }

  const roleLabels = {
    primary: 'Primary',
    related: 'Related',
    candidate: 'Candidate',
  }

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label={`Agent Annotation: ${target.role} (${target.evidenceGrade})`}
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border transition-transform hover:scale-105 active:scale-95',
          gradeColors[target.evidenceGrade] || 'bg-muted/30 text-muted-foreground border-border/40'
        )}
      >
        <span>{roleLabels[target.role] || target.role}</span>
        <span className="opacity-70">·</span>
        <span>{target.evidenceGrade}</span>
      </button>

      {open && <AnnotationPopover target={target} onClose={() => setOpen(false)} />}
    </div>
  )
}
