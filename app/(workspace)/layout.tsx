import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader'
import { WorkspaceHeaderProvider } from '@/components/layout/WorkspaceHeaderContext'

export const metadata: Metadata = {
  title: 'Yggit',
  description: '世界树 Git 图谱与版本管理工作区',
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceHeaderProvider>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-paper text-ink">
        <WorkspaceHeader />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </WorkspaceHeaderProvider>
  )
}
