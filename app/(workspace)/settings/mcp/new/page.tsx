import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '添加 HTTP MCP Server — Yggit',
  description: '连接外部 HTTP MCP Server 服务与工具。',
}

export default function NewMcpPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="mcp" mcpServerId="new" />
    </Suspense>
  )
}
