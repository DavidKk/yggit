import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '模型接入 — 设置 — Yggit',
  description: '配置模型服务渠道、网关地址、默认模型及黑白名单规则。',
}

export default function SettingsModelsPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="models" />
    </Suspense>
  )
}
