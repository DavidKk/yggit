import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: 'MCP 工具 — 设置 — Yggit',
  description: '管理外部 HTTP MCP Server 工具接入与原生浏览器 WebMCP。',
}

export default function SettingsMcpPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="mcp" />
    </Suspense>
  )
}
