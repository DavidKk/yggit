'use client'

import React, { type ReactNode } from 'react'

import { AgentWorkspace } from '@/components/git/agent/AgentWorkspace'
import { GitAgentBar } from '@/components/git/agent/GitAgentBar'
import { AgentSpotlightNavigator } from '@/components/git/agent/spotlight/AgentSpotlightNavigator'

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
        <AgentSpotlightNavigator />
        <GitAgentBar />
      </div>
      <AgentWorkspace />
    </div>
  )
}
