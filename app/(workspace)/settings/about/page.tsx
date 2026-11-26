import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '关于我们 — 设置 — Yggit',
  description: '项目简介、开源许可与开发者诊断日志入口。',
}

export default function SettingsAboutPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="about" />
    </Suspense>
  )
}
