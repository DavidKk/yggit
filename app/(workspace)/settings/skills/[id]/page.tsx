import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '技能详情与配置 — Yggit',
  description: '查看与配置 Agent 技能 (SKILL.md) 详细指令与来源。',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SkillDetailPage({ params }: PageProps) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="skills" skillId={decodeURIComponent(id)} />
    </Suspense>
  )
}
