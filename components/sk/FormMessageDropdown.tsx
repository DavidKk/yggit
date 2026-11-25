'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Non-layout-displacing dropdown message anchored directly below a form control.
 */
export function FormMessageDropdown({ error, warn, className }: { error?: ReactNode; warn?: ReactNode; className?: string }) {
  const isError = Boolean(error)
  const content = error ?? warn
  if (!content) return null

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={cn(
        'pointer-events-none absolute top-full left-0 z-20 mt-1 max-w-full rounded-md border px-2 py-1 text-[11px] font-medium leading-snug shadow-sm backdrop-blur-md animate-in fade-in duration-150',
        isError ? 'border-fail/40 bg-panel/95 text-fail' : 'border-warn/40 bg-panel/95 text-warn',
        className
      )}
    >
      {content}
    </div>
  )
}
