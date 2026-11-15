import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: 'Git Agent 设置 — Yggit',
  description: '配置 Git Agent 模型接入、隐私脱敏及全局快捷键',
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-paper" />}>
      <AgentSettingsPageContent />
    </Suspense>
  )
}
