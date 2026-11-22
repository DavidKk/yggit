'use client'

import React from 'react'

import { WorkspaceHeaderSlot } from '@/components/layout/WorkspaceHeaderContext'
import { WorkdeskHeaderSwitcher } from '@/components/workdesk/WorkdeskHeaderSwitcher'
import { WorkdeskTaskDetailView } from '@/components/workdesk/WorkdeskTaskDetailView'

interface Props {
  params: Promise<{ taskId: string; itemId: string }>
}

export default function WorkdeskTaskItemPage({ params }: Props) {
  const { taskId, itemId } = React.use(params)

  return (
    <>
      <WorkspaceHeaderSlot>
        <WorkdeskHeaderSwitcher />
      </WorkspaceHeaderSlot>
      <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-paper select-text">
        <WorkdeskTaskDetailView taskId={decodeURIComponent(taskId)} initialItemId={decodeURIComponent(itemId)} />
      </div>
    </>
  )
}
