'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import React, { useState } from 'react'
import { LuCpu, LuShieldCheck, LuSlidersHorizontal } from 'react-icons/lu'
import { MdOutlineExitToApp } from 'react-icons/md'

import { BrandLogo } from '@/components/BrandLogo'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'

import { GeneralSettingsSection } from './GeneralSettingsSection'
import { ModelChannelSection } from './ModelChannelSection'
import { PrivacyRedactSection } from './PrivacyRedactSection'
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
export function AgentSettingsPageContent() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as SettingsSectionKey | null

  const [activeSection, setActiveSection] = useState<SettingsSectionKey>(tabParam && ['models', 'privacy', 'general'].includes(tabParam) ? tabParam : 'models')

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
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
      desc: '在客户端本地完成密钥、邮箱、拓扑与自定义敏感词的双向可逆掩盖，防范敏感资产外泄。',
      icon: <LuShieldCheck className="size-4 text-accent" aria-hidden="true" />,
    },
    general: {
      title: t('gitAgent.tabGeneral') || '通用设置',
      desc: '管理外观主题、语言偏好、Git 视图交互及底层执行模式。',
      icon: <LuSlidersHorizontal className="size-4 text-accent" aria-hidden="true" />,
    },
  }

  const currentMeta = sectionMeta[activeSection]

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-paper text-ink select-text">
      {/* 1. Global Shell Top Bar matching main header */}
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

      {/* 2. Main Workspace Split: Left Icon Rail + Right Content Hub */}
      <div className="flex min-h-0 flex-1 overflow-hidden bg-paper">
        {/* Left Sub-navigation Rail */}
        <SettingsSideNav activeSection={activeSection} onSelectSection={setActiveSection} />

        {/* Right Configuration Page */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Content Header (PanelHeader pattern) */}
          <div className="shrink-0 border-b border-line bg-paper-2 p-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-panel text-ink-soft hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 transition-all cursor-pointer"
                title={t('gitAgent.backToGraph')}
              >
                <MdOutlineExitToApp className="size-4 -scale-x-100" aria-hidden="true" />
                <span className="sr-only">{t('gitAgent.backToGraph')}</span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {currentMeta.icon}
                  <h1 className="text-xs font-bold text-ink">{currentMeta.title}</h1>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft leading-relaxed">{currentMeta.desc}</p>
              </div>
            </div>
          </div>

          {/* Content Body: Standard padding (No flush / No NOPADDING), Form Cards Container */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <div className="grid w-full max-w-4xl gap-3">
              {activeSection === 'models' && <ModelChannelSection />}
              {activeSection === 'privacy' && <PrivacyRedactSection />}
              {activeSection === 'general' && <GeneralSettingsSection />}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
