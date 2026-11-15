import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '设置 — Yggit',
  description: '配置模型接入、隐私脱敏及系统偏好',
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-paper" />}>
      <AgentSettingsPageContent />
    </Suspense>
  )
}
