'use client'

import React from 'react'

import { WorkspaceHeaderSlot } from '@/components/layout/WorkspaceHeaderContext'
import { WorkdeskBoard } from '@/components/workdesk/WorkdeskBoard'
import { WorkdeskHeaderSwitcher } from '@/components/workdesk/WorkdeskHeaderSwitcher'

export default function WorkdeskPage() {
  return (
    <>
      <WorkspaceHeaderSlot>
        <WorkdeskHeaderSwitcher />
      </WorkspaceHeaderSlot>
      <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-paper select-text">
        <WorkdeskBoard />
      </div>
    </>
  )
}
