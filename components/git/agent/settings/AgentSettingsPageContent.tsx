'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import React from 'react'
import { LuArrowLeft, LuCpu, LuMousePointerClick, LuShieldCheck, LuSlidersHorizontal } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { useInWorkspaceHeader, WorkspaceHeaderSlot } from '@/components/layout/WorkspaceHeaderContext'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'

import { AgentMenuActionEditor } from './AgentMenuActionEditor'
import { GeneralSettingsSection } from './GeneralSettingsSection'
import { MenuSettingsSection } from './MenuSettingsSection'
import { ModelChannelSection } from './ModelChannelSection'
import { PrivacyRedactSection } from './PrivacyRedactSection'
import { RuleDebugger } from './RuleDebugger'
import { SettingsColumns } from './SettingsColumns'
import { type SettingsSectionKey, SettingsSideNav } from './SettingsSideNav'

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
  section?: SettingsSectionKey
}

export function AgentSettingsPageContent({ section = 'models', menuActionId }: AgentSettingsPageContentProps = {}) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as SettingsSectionKey | null

  const activeSection = section

  // Canonical path redirection: if accessed with legacy ?tab= query parameter, redirect to path route
  React.useEffect(() => {
    if (tabParam && ['models', 'privacy', 'general', 'menus'].includes(tabParam)) {
      router.replace(`/settings/${tabParam}`)
    }
  }, [tabParam, router])

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back()
        return
      }
      if (document.referrer && document.referrer.startsWith(window.location.origin)) {
        window.location.href = document.referrer
        return
      }
      router.push('/git')
    }
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
                title="返回"
              >
                <LuArrowLeft className="size-4" aria-hidden="true" />
                <span className="sr-only">返回</span>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-xs font-bold text-ink">{currentMeta.title}</h1>
                <p className="mt-0.5 text-xs text-ink-soft leading-relaxed">{currentMeta.desc}</p>
              </div>
            </div>
          </div>

          {/* Content Body: Standard padding (No flush / No NOPADDING), Form Cards Container */}
          <div className="@container/settings flex-1 min-h-0 overflow-y-auto p-3 pb-24">
            <div className="grid w-full gap-3">
              {activeSection === 'models' && <ModelChannelSection />}
              {activeSection === 'privacy' && (
                <SettingsColumns tools={<RuleDebugger />}>
                  <PrivacyRedactSection />
                </SettingsColumns>
              )}
              {activeSection === 'general' && (
                <div className="max-w-4xl">
                  <GeneralSettingsSection />
                </div>
              )}
              {activeSection === 'menus' && (
                <div className="max-w-4xl">{menuActionId ? <AgentMenuActionEditor key={menuActionId} actionId={menuActionId} /> : <MenuSettingsSection />}</div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
