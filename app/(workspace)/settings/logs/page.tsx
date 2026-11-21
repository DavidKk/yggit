import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '诊断日志 — 设置 — Yggit',
  description: '收集 Agent 运行时、MCP、Skill 及 Git 驱动日志，支持一键生成 Issue 报告。',
}

export default function SettingsLogsPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="logs" />
    </Suspense>
  )
}
