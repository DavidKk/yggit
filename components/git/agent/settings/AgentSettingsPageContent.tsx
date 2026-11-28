'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'
import { LuArrowLeft, LuCpu, LuInfo, LuMousePointerClick, LuNetwork, LuShieldCheck, LuSlidersHorizontal, LuSparkles } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { useInWorkspaceHeader, WorkspaceHeaderSlot } from '@/components/layout/WorkspaceHeaderContext'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { useGitDriver, useModeHref } from '@/lib/git/driver'
import { getLastGitUrl } from '@/lib/git/last-git-url'
import { stripLocalPrefix } from '@/lib/git/route-mode'

import { AboutSettingsSection } from './AboutSettingsSection'
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
  const { mode } = useGitDriver()
  const modeHref = useModeHref()

  const activeSection = section

  // Canonical path redirection: if accessed with legacy ?tab= query parameter, redirect to path route
  React.useEffect(() => {
    if (tabParam && ['models', 'skills', 'mcp', 'privacy', 'general', 'menus', 'about'].includes(tabParam)) {
      router.replace(modeHref(`/settings/${tabParam}`))
    }
  }, [tabParam, modeHref, router])

  const handleBack = () => {
    if (skillId) {
      router.replace(modeHref('/settings/skills'))
      return
    }
    if (mcpServerId) {
      router.replace(modeHref('/settings/mcp'))
      return
    }
    if (menuActionId) {
      router.replace(modeHref('/settings/menus'))
      return
    }
    const returnTo = searchParams.get('returnTo') || searchParams.get('from')
    if (returnTo && stripLocalPrefix(returnTo).startsWith('/git')) {
      router.push(modeHref(returnTo))
      return
    }
    // Directly exit settings and return to the active Git session
    const target = getLastGitUrl(mode)
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
      title: t('gitAgent.tabSkills') || 'Agent Skills',
      desc: t('gitAgent.skillsSectionDesc') || 'Import and manage external workflow specifications and guidelines (SKILL.md).',
      icon: <LuSparkles className="size-4 text-accent" aria-hidden="true" />,
    },
    mcp: {
      title: t('gitAgent.tabMcp') || 'MCP Tools',
      desc: t('gitAgent.mcpSectionDesc') || 'Configure and manage external HTTP MCP Server tool services.',
      icon: <LuNetwork className="size-4 text-accent" aria-hidden="true" />,
    },
    privacy: {
      title: t('gitAgent.tabPrivacy'),
      desc: t('gitAgent.privacySettingsDesc'),
      icon: <LuShieldCheck className="size-4 text-accent" aria-hidden="true" />,
    },
    general: {
      title: t('gitAgent.tabGeneral') || 'General Settings',
      desc: t('gitAgent.generalSectionDesc') || 'Manage appearance theme, language preference, Git view interactions, and execution mode.',
      icon: <LuSlidersHorizontal className="size-4 text-accent" aria-hidden="true" />,
    },
    menus: {
      title: t('gitAgent.menusSettingsTitle'),
      desc: t('gitAgent.menusSettingsDesc'),
      icon: <LuMousePointerClick className="size-4 text-accent" aria-hidden="true" />,
    },
    about: {
      title: t('gitAgent.tabAbout') || 'About',
      desc: t('gitAgent.aboutDesc') || 'Project overview, core features, open-source license, and developer diagnostics.',
      icon: <LuInfo className="size-4 text-accent" aria-hidden="true" />,
    },
  }

  const inWorkspace = useInWorkspaceHeader()

  const currentMeta = sectionMeta[activeSection]

  let displayTitle = currentMeta.title
  let displayDesc = currentMeta.desc

  if (activeSection === 'skills' && skillId) {
    displayTitle = skillId === 'new' ? 'New Skill' : 'Skill Details & Configuration'
    displayDesc = skillId === 'new' ? 'Import a local SKILL.md or link a Skill from a GitHub repository.' : 'View and manage skill instructions, source metadata, and status.'
  } else if (activeSection === 'mcp' && mcpServerId) {
    displayTitle = mcpServerId === 'new' ? 'Add HTTP MCP Server' : 'MCP Server Configuration & Tools'
    displayDesc =
      mcpServerId === 'new' ? 'Connect an external HTTP tool service following the Model Context Protocol.' : 'Check MCP Server connection status and manage tool permissions.'
  } else if (activeSection === 'menus' && menuActionId) {
    displayTitle = menuActionId === 'new' ? 'New Agent Menu Action' : 'Edit Agent Menu Action'
    displayDesc = menuActionId === 'new' ? 'Configure a custom context-menu Agent prompt.' : 'Edit the context-menu action name, description, and prompt.'
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
                title={skillId || mcpServerId || menuActionId ? t('gitAgent.backToModels') || 'Back' : t('gitAgent.backToGraph') || 'Back to Graph'}
              >
                <LuArrowLeft className="size-4" aria-hidden="true" />
                <span className="sr-only">{skillId || mcpServerId || menuActionId ? t('gitAgent.backToModels') || 'Back' : t('gitAgent.backToGraph') || 'Back to Graph'}</span>
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
              {activeSection === 'about' && (
                <div className="max-w-4xl">
                  <AboutSettingsSection />
                </div>
              )}
              {activeSection === 'menus' &&
                (menuActionId ? (
                  <div className="max-w-4xl">
                    <AgentMenuActionEditor key={menuActionId} actionId={menuActionId} />
                  </div>
                ) : (
                  <SettingsColumns className="max-w-[1400px] @min-[960px]/settings:grid-cols-[minmax(0,1fr)_360px]" tools={<ContextMenuPreviewToolbar />}>
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
