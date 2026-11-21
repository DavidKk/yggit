import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '新增技能 — 技能库 — Yggit',
  description: '导入本地 SKILL.md 或关联 GitHub 仓库中的 Skill 知识库。',
}

export default function NewSkillPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="skills" skillId="new" />
    </Suspense>
  )
}
