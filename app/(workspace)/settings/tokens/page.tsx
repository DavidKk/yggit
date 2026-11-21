import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: 'Token 统计 — 设置 — Yggit',
  description: '统计 Agent 各模型 Prompt 传入、Completion 传出、缓存命中率及延迟消耗。',
}

export default function SettingsTokensPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="tokens" />
    </Suspense>
  )
}
