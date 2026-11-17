import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ModelChannelEditPageContent } from '@/components/git/agent/settings/ModelChannelEditPageContent'

export const metadata: Metadata = {
  title: '新增模型接入项目 — Yggit',
  description: '配置新的模型渠道与网关接入',
}

export default function NewModelPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <ModelChannelEditPageContent isNew />
    </Suspense>
  )
}
