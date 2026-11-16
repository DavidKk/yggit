import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader'
import { WorkspaceHeaderProvider } from '@/components/layout/WorkspaceHeaderContext'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'

export const metadata: Metadata = {
  title: 'Yggit',
  description: '世界树 Git 图谱与版本管理工作区',
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceHeaderProvider>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-paper text-ink">
        <WorkspaceHeader />
        <WorkspaceShell>{children}</WorkspaceShell>
      </div>
    </WorkspaceHeaderProvider>
  )
}
