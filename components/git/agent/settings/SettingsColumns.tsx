import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SettingsColumnsProps {
  children: ReactNode
  tools: ReactNode
  className?: string
}

export function SettingsColumns({ children, tools, className }: SettingsColumnsProps) {
  return (
    <div className={cn('grid w-full max-w-[1100px] min-w-0 items-start gap-3 @min-[960px]/settings:grid-cols-[minmax(0,680px)_340px]', className)}>
      <div className="grid min-w-0 gap-3">{children}</div>
      <aside className="min-w-0 @min-[960px]/settings:sticky @min-[960px]/settings:top-0">{tools}</aside>
    </div>
  )
}
