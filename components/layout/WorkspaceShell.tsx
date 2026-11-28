'use client'

import { usePathname } from 'next/navigation'
import React, { type ReactNode } from 'react'

import { AgentWorkspace } from '@/components/git/agent/AgentWorkspace'
import { GitAgentBar } from '@/components/git/agent/GitAgentBar'
import { AgentSpotlightNavigator } from '@/components/git/agent/spotlight/AgentSpotlightNavigator'
import { stripLocalPrefix } from '@/lib/git/route-mode'

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || ''
  const logicalPath = stripLocalPrefix(pathname)
  const hideAgent = logicalPath.startsWith('/dev/studio') || logicalPath.startsWith('/dev/logs')

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
        {!hideAgent && (
          <>
            <AgentSpotlightNavigator />
            <GitAgentBar />
          </>
        )}
      </div>
      {!hideAgent && <AgentWorkspace />}
    </div>
  )
}
