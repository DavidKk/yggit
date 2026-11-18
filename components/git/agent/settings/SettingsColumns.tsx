import type { ReactNode } from 'react'

export function SettingsColumns({ children, tools }: { children: ReactNode; tools: ReactNode }) {
  return (
    <div className="grid w-full max-w-[1400px] min-w-0 items-start gap-3 @min-[960px]/settings:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-3">{children}</div>
      <aside className="min-w-0 @min-[960px]/settings:sticky @min-[960px]/settings:top-0">{tools}</aside>
    </div>
  )
}
