import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: 'MCP Server 配置与工具 — Yggit',
  description: '查看 MCP Server 连接状态并管理工具权限。',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function McpDetailPage({ params }: PageProps) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="mcp" mcpServerId={decodeURIComponent(id)} />
    </Suspense>
  )
}
