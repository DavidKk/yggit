'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'
import { LuArrowLeft, LuCpu, LuMousePointerClick, LuNetwork, LuShieldCheck, LuSlidersHorizontal, LuSparkles } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { useInWorkspaceHeader, WorkspaceHeaderSlot } from '@/components/layout/WorkspaceHeaderContext'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { getLastGitUrl } from '@/lib/git/last-git-url'

import { AgentMenuActionEditor } from './AgentMenuActionEditor'
import { ContextMenuPreviewToolbar } from './ContextMenuPreviewToolbar'
import { GeneralSettingsSection } from './GeneralSettingsSection'
import { McpServerEditor } from './McpServerEditor'
import { McpSettingsSection } from './McpSettingsSection'
import { MenuSettingsSection } from './MenuSettingsSection'
import { ModelChannelSection } from './ModelChannelSection'
import { PrivacyRedactSection } from './PrivacyRedactSection'
import { SettingsColumns } from './SettingsColumns'
import { type SettingsSectionKey, SettingsSideNav } from './SettingsSideNav'
import { SkillEditor } from './SkillEditor'
import { SkillsSettingsSection } from './SkillsSettingsSection'

/**
 * Git Agent configuration page layout adhering to ticket-janitor / Calm Ops UI/UX standards.
 * Features:
 * - Top shell bar with brand, locale and theme switches.
 * - Left icon sub-navigation rail.
 * - Distinct page content header (back action, title, description).
 * - Scrollable body with standard padding (no flush / no unpadded margins).
 * - All controls, labels, helper texts, and buttons enclosed inside SettingsSectionCard cards.
 */
interface AgentSettingsPageContentProps {
  menuActionId?: string
  skillId?: string
  mcpServerId?: string
  section?: SettingsSectionKey
}

export function AgentSettingsPageContent({ section = 'models', menuActionId, skillId, mcpServerId }: AgentSettingsPageContentProps = {}) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as SettingsSectionKey | null

  const activeSection = section

  // Canonical path redirection: if accessed with legacy ?tab= query parameter, redirect to path route
  React.useEffect(() => {
    if (tabParam && ['models', 'skills', 'mcp', 'privacy', 'general', 'menus'].includes(tabParam)) {
      router.replace(`/settings/${tabParam}`)
    }
  }, [tabParam, router])

  const handleBack = () => {
    if (skillId) {
      router.replace('/settings/skills')
      return
    }
    if (mcpServerId) {
      router.replace('/settings/mcp')
      return
    }
    if (menuActionId) {
      router.replace('/settings/menus')
      return
    }
    const returnTo = searchParams.get('returnTo') || searchParams.get('from')
    if (returnTo && returnTo.startsWith('/git')) {
      router.push(returnTo)
      return
    }
    // Directly exit settings and return to the active Git session
    const target = getLastGitUrl()
    router.push(target)
  }

  const sectionMeta: Record<
    SettingsSectionKey,
    {
      title: string
      desc: string
      icon: React.ReactNode
    }
  > = {
    models: {
      title: t('gitAgent.tabModels'),
      desc: t('gitAgent.modelListDesc'),
      icon: <LuCpu className="size-4 text-accent" aria-hidden="true" />,
    },
    skills: {
      title: 'Agent 技能库 (Skills)',
      desc: '导入与管理外部专业工作流规范与知识准则 (SKILL.md)。',
      icon: <LuSparkles className="size-4 text-accent" aria-hidden="true" />,
    },
    mcp: {
      title: 'MCP 工具管理',
      desc: '配置与管理外部 HTTP MCP Server 工具服务。',
      icon: <LuNetwork className="size-4 text-accent" aria-hidden="true" />,
    },
    privacy: {
      title: t('gitAgent.tabPrivacy'),
      desc: t('gitAgent.privacySettingsDesc'),
      icon: <LuShieldCheck className="size-4 text-accent" aria-hidden="true" />,
    },
    general: {
      title: t('gitAgent.tabGeneral') || '通用设置',
      desc: '管理外观主题、语言偏好、Git 视图交互及底层执行模式。',
      icon: <LuSlidersHorizontal className="size-4 text-accent" aria-hidden="true" />,
    },
    menus: {
      title: t('gitAgent.menusSettingsTitle'),
      desc: t('gitAgent.menusSettingsDesc'),
      icon: <LuMousePointerClick className="size-4 text-accent" aria-hidden="true" />,
    },
  }

  const inWorkspace = useInWorkspaceHeader()

  const currentMeta = sectionMeta[activeSection]

  let displayTitle = currentMeta.title
  let displayDesc = currentMeta.desc

  if (activeSection === 'skills' && skillId) {
    displayTitle = skillId === 'new' ? '新增技能' : '技能详情与配置'
    displayDesc = skillId === 'new' ? '导入本地 SKILL.md 或关联 GitHub 仓库中的 Skill 规范。' : '查看与管理技能的规范指令、来源信息与运行状态。'
  } else if (activeSection === 'mcp' && mcpServerId) {
    displayTitle = mcpServerId === 'new' ? '添加 HTTP MCP Server' : 'MCP Server 配置与工具'
    displayDesc = mcpServerId === 'new' ? '连接外部遵循 Model Context Protocol 的 HTTP 工具服务。' : '查看 MCP Server 连接状态并管理工具权限。'
  } else if (activeSection === 'menus' && menuActionId) {
    displayTitle = menuActionId === 'new' ? '新增 Agent 菜单动作' : '编辑 Agent 菜单动作'
    displayDesc = menuActionId === 'new' ? '配置自定义右键快捷 Agent 提示词。' : '修改右键菜单动作名称、描述与提示词。'
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-paper text-ink select-text">
      {inWorkspace ? (
        <WorkspaceHeaderSlot>
          <span className="text-xs font-semibold text-ink">{t('gitAgent.settingsTitle')}</span>
        </WorkspaceHeaderSlot>
      ) : (
        /* Standalone fallback header when not wrapped by workspace layout */
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-panel-2/60 px-3 py-1.5">
          <div className="flex items-center gap-3">
            <BrandLogo href="/" className="shrink-0" markClassName="size-7" wordmarkClassName="text-[0.95rem]" />
            <span className="h-4 w-px shrink-0 bg-[color-mix(in_oklab,var(--ink)_16%,transparent)]" aria-hidden="true" />
            <span className="text-xs font-semibold text-ink">{t('gitAgent.settingsTitle')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeSwitcher compact />
            <LocaleSwitcher compact />
          </div>
        </header>
      )}

      {/* 2. Main Workspace Split: Left Icon Rail + Right Content Hub */}
      <div className="flex min-h-0 flex-1 overflow-hidden bg-paper">
        {/* Left Sub-navigation Rail */}
        <SettingsSideNav activeSection={activeSection} />

        {/* Right Configuration Page */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Content Header (PanelHeader pattern) */}
          <div className="shrink-0 border-b border-line bg-paper-2 p-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-panel text-ink-soft hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 transition-all cursor-pointer"
                title={skillId || mcpServerId || menuActionId ? t('gitAgent.backToModels') || '返回' : t('gitAgent.backToGraph') || '返回图谱'}
              >
                <LuArrowLeft className="size-4" aria-hidden="true" />
                <span className="sr-only">{skillId || mcpServerId || menuActionId ? t('gitAgent.backToModels') || '返回' : t('gitAgent.backToGraph') || '返回图谱'}</span>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-xs font-bold text-ink">{displayTitle}</h1>
                <p className="mt-0.5 text-xs text-ink-soft leading-relaxed">{displayDesc}</p>
              </div>
            </div>
          </div>

          {/* Content Body: Standard padding (No flush / No NOPADDING), Form Cards Container */}
          <div className="@container/settings flex-1 min-h-0 overflow-y-auto p-3 pb-24">
            <div className="grid w-full gap-3">
              {activeSection === 'models' && <ModelChannelSection />}
              {activeSection === 'skills' && <div className="max-w-4xl">{skillId ? <SkillEditor skillId={skillId} /> : <SkillsSettingsSection />}</div>}
              {activeSection === 'mcp' && <div className="max-w-4xl">{mcpServerId ? <McpServerEditor serverId={mcpServerId} /> : <McpSettingsSection />}</div>}
              {activeSection === 'privacy' && <PrivacyRedactSection />}
              {activeSection === 'general' && (
                <div className="max-w-4xl">
                  <GeneralSettingsSection />
                </div>
              )}
              {activeSection === 'menus' &&
                (menuActionId ? (
                  <div className="max-w-4xl">
                    <AgentMenuActionEditor key={menuActionId} actionId={menuActionId} />
                  </div>
                ) : (
                  <SettingsColumns tools={<ContextMenuPreviewToolbar />}>
                    <MenuSettingsSection />
                  </SettingsColumns>
                ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
