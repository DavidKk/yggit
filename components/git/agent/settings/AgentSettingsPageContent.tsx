'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useState } from 'react'
import { LuArrowLeft, LuCpu, LuShieldCheck } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { Badge } from '@/components/sk'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { useAgent } from '@/lib/agent/agent-context'

import { ModelChannelSection } from './ModelChannelSection'
import { PrivacyRedactSection } from './PrivacyRedactSection'
import { type SettingsSectionKey, SettingsSideNav } from './SettingsSideNav'

/**
 * Git Agent configuration page layout adhering to ticket-janitor / Calm Ops UI/UX standards.
 * Features:
 * - Top shell bar with brand, back action, locale and theme switches.
 * - Left icon sub-navigation rail.
 * - Distinct page content header (title, description, and status action slot).
 * - Scrollable body with standard padding (no flush / no unpadded margins).
 * - All controls, labels, helper texts, and buttons enclosed inside SettingsSectionCard cards.
 */
export function AgentSettingsPageContent() {
  const t = useT()
  const searchParams = useSearchParams()
  const repoParam = searchParams.get('repo') || ''
  const tabParam = searchParams.get('tab') as SettingsSectionKey | null

  const { config, redactionOptions } = useAgent()

  const [activeSection, setActiveSection] = useState<SettingsSectionKey>(tabParam && ['models', 'privacy'].includes(tabParam) ? tabParam : 'models')

  const backUrl = repoParam ? `/?repo=${encodeURIComponent(repoParam)}` : '/'

  const sectionMeta: Record<
    SettingsSectionKey,
    {
      title: string
      desc: string
      icon: React.ReactNode
      actionBadge: React.ReactNode
    }
  > = {
    models: {
      title: t('gitAgent.tabModels'),
      desc: '配置大模型推理服务渠道与接口协议，默认可使用 Vercel AI Gateway 提供的免凭证公共模型。',
      icon: <LuCpu className="size-4.5 text-accent" aria-hidden="true" />,
      actionBadge: (
        <Badge tone="neutral" className="font-mono text-xs">
          {config.provider === 'vercel-free' ? '公共免费渠道' : config.provider}
        </Badge>
      ),
    },
    privacy: {
      title: t('gitAgent.tabPrivacy'),
      desc: '在客户端本地完成密钥、邮箱、拓扑与自定义敏感词的双向可逆掩盖，防范敏感资产外泄。',
      icon: <LuShieldCheck className="size-4.5 text-accent" aria-hidden="true" />,
      actionBadge: (
        <Badge tone={redactionOptions.enabled ? 'ok' : 'neutral'} className="text-xs">
          {redactionOptions.enabled ? '脱敏已启用' : '脱敏已停用'}
        </Badge>
      ),
    },
  }

  const currentMeta = sectionMeta[activeSection]

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-paper text-ink select-text">
      {/* 1. Global Shell Top Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-paper-2 px-4">
        <div className="flex items-center gap-3">
          <Link
            href={backUrl}
            className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] hover:text-ink active:scale-95 transition-all"
            title="返回图谱"
          >
            <LuArrowLeft className="size-3.5" aria-hidden="true" />
            <span>返回图谱</span>
          </Link>

          <div className="h-4 w-px bg-line" aria-hidden="true" />

          <BrandLogo href="/" className="shrink-0" markClassName="size-6" wordmarkClassName="text-sm" />

          <div className="h-4 w-px bg-line" aria-hidden="true" />

          <span className="text-xs font-semibold text-ink">{t('gitAgent.settingsTitle')}</span>
        </div>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeSwitcher />
        </div>
      </header>

      {/* 2. Main Workspace Split: Left Icon Rail + Right Content Hub */}
      <div className="flex min-h-0 flex-1 overflow-hidden bg-paper">
        {/* Left Sub-navigation Rail */}
        <SettingsSideNav activeSection={activeSection} onSelectSection={setActiveSection} />

        {/* Right Configuration Page */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Content Header (PanelHeader pattern) */}
          <div className="shrink-0 border-b border-line bg-paper-2 px-4 py-3 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {currentMeta.icon}
                  <h1 className="text-sm font-semibold tracking-tight text-ink md:text-base">{currentMeta.title}</h1>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft leading-relaxed">{currentMeta.desc}</p>
              </div>
              <div className="shrink-0">{currentMeta.actionBadge}</div>
            </div>
          </div>

          {/* Content Body: Standard padding (No flush / No NOPADDING), Form Cards Container */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            <div className="grid w-full max-w-3xl gap-4">
              {activeSection === 'models' && <ModelChannelSection />}
              {activeSection === 'privacy' && <PrivacyRedactSection />}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
