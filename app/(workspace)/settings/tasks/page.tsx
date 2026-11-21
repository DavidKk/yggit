import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '任务追踪 — 设置 — Yggit',
  description: '查看 Agent 对话任务执行链路、调用工具明细与步骤产物。',
}

export default function SettingsTasksPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="tasks" />
    </Suspense>
  )
}
