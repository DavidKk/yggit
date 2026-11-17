import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '通用偏好 — 设置 — Yggit',
  description: '管理外观主题、语言偏好、Git 视图交互及底层执行模式。',
}

export default function SettingsGeneralPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="general" />
    </Suspense>
  )
}
