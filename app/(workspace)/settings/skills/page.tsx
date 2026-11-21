import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '技能库 — 设置 — Yggit',
  description: '管理 Agent 专业知识、工作流程规范与外部指导准则 (SKILL.md)。',
}

export default function SettingsSkillsPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="skills" />
    </Suspense>
  )
}
