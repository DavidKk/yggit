'use client'

import { type ReactNode } from 'react'

import { DebugMenu } from '@/components/debug/DebugMenu'
import { DebugMenuProvider } from '@/components/debug/registry'
import { pageShell } from '@/components/layoutClasses'

/** 全局壳：为 Yggit 提供顶层容器与开发模式调试浮球 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <DebugMenuProvider>
      <div className={pageShell}>
        {process.env.NODE_ENV === 'development' ? <DebugMenu /> : null}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </DebugMenuProvider>
  )
}

