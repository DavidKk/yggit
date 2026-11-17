import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '隐私与脱敏 — 设置 — Yggit',
  description: '在客户端本地完成密钥、邮箱、拓扑与自定义敏感词的双向可逆掩盖，防范敏感资产外泄。',
}

export default function PrivacyPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="privacy" />
    </Suspense>
  )
}
