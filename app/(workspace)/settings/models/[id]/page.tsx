import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ModelChannelEditPageContent } from '@/components/git/agent/settings/ModelChannelEditPageContent'

export const metadata: Metadata = {
  title: '编辑模型接入项目 — Yggit',
  description: '配置模型渠道与网关接入',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditModelPage({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <ModelChannelEditPageContent profileId={id} />
    </Suspense>
  )
}
