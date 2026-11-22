'use client'

import React from 'react'

import { WorkspaceHeaderSlot } from '@/components/layout/WorkspaceHeaderContext'
import { PortableCheckImportView } from '@/components/workdesk/PortableCheckImportView'
import { WorkdeskHeaderSwitcher } from '@/components/workdesk/WorkdeskHeaderSwitcher'

export default function PortableCheckImportPage() {
  return (
    <>
      <WorkspaceHeaderSlot>
        <WorkdeskHeaderSwitcher />
      </WorkspaceHeaderSlot>
      <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-paper select-text">
        <PortableCheckImportView />
      </div>
    </>
  )
}
