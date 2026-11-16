'use client'

import React, { type ReactNode } from 'react'

import { AgentWorkspace } from '@/components/git/agent/AgentWorkspace'
import { GitAgentBar } from '@/components/git/agent/GitAgentBar'
import { AgentSpotlightNavigator } from '@/components/git/agent/spotlight/AgentSpotlightNavigator'
import { useOptionalAgent } from '@/lib/agent/agent-context'
import { cn } from '@/lib/utils'

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const agent = useOptionalAgent()
  const dockMode = agent?.dockMode || 'collapsed'
  const isDockBottom = dockMode === 'dock-bottom'

  return (
    <div className={cn('relative flex min-h-0 min-w-0 flex-1 overflow-hidden', isDockBottom ? 'flex-col' : 'flex-row')}>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
        <AgentSpotlightNavigator />
        <GitAgentBar />
      </div>
      <AgentWorkspace />
    </div>
  )
}
