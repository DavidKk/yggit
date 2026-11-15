'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useState } from 'react'
import { LuArrowLeft, LuCpu, LuShieldCheck } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'

import { ModelChannelSection } from './ModelChannelSection'
import { PrivacyRedactSection } from './PrivacyRedactSection'
import { type SettingsSectionKey, SettingsSideNav } from './SettingsSideNav'

export function AgentSettingsPageContent() {
  const t = useT()
  const searchParams = useSearchParams()
  const repoParam = searchParams.get('repo') || ''
  const tabParam = searchParams.get('tab') as SettingsSectionKey | null

  const [activeSection, setActiveSection] = useState<SettingsSectionKey>(tabParam && ['models', 'privacy'].includes(tabParam) ? tabParam : 'models')

  const backUrl = repoParam ? `/?repo=${encodeURIComponent(repoParam)}` : '/'

  const sectionTitles: Record<SettingsSectionKey, { title: string; desc: string; icon: React.ReactNode }> = {
    models: {
      title: t('gitAgent.tabModels'),
      desc: '配置大模型推理服务渠道，默认可使用 Vercel AI Gateway 提供的免凭证免费模型。',
      icon: <LuCpu className="h-5 w-5 text-accent" />,
    },
    privacy: {
      title: t('gitAgent.tabPrivacy'),
      desc: '在客户端本地完成密钥、邮箱、拓扑与自定义敏感词的双向可逆掩盖，防范敏感资产外泄。',
      icon: <LuShieldCheck className="h-5 w-5 text-accent" />,
    },
  }

  const currentMeta = sectionTitles[activeSection]

  return (
    <div className="flex h-screen w-screen flex-col bg-paper text-ink overflow-hidden select-text">
      {/* 1. Page Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-panel-2/70 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href={backUrl}
            className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground active:scale-95 transition-all"
            title="返回图谱"
          >
            <LuArrowLeft className="h-3.5 w-3.5" />
            <span>返回图谱</span>
          </Link>

          <div className="h-4 w-px bg-border/50" />

          <BrandLogo href="/" className="shrink-0" markClassName="size-6" wordmarkClassName="text-sm" />

          <div className="h-4 w-px bg-border/50" />

          <span className="text-xs font-semibold text-foreground">{t('gitAgent.settingsTitle')}</span>
        </div>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeSwitcher />
        </div>
      </header>

      {/* 2. Page Body: Left Rail Sub-navigation + Right Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-panel/60">
        {/* Left Sub-nav */}
        <SettingsSideNav activeSection={activeSection} onSelectSection={setActiveSection} />

        {/* Right Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-3xl space-y-6">
            {/* Section Header */}
            <div className="border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                {currentMeta.icon}
                <h2 className="text-lg font-semibold tracking-tight text-foreground">{currentMeta.title}</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{currentMeta.desc}</p>
            </div>

            {/* Section Form Component (Left-aligned) */}
            <div className="pt-2">
              {activeSection === 'models' && <ModelChannelSection />}
              {activeSection === 'privacy' && <PrivacyRedactSection />}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
