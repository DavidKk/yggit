import type { Metadata } from 'next'
import { Suspense } from 'react'

import { AgentSettingsPageContent } from '@/components/git/agent/settings/AgentSettingsPageContent'

export const metadata: Metadata = {
  title: '右键菜单设置 — 设置 — Yggit',
  description: '自定义主菜单快捷区、二级子菜单分组归类、操作安全防护与 Agent 智能扩展能力。',
}

export default function SettingsMenusPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-paper" />}>
      <AgentSettingsPageContent section="menus" />
    </Suspense>
  )
}
