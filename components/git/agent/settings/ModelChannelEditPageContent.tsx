'use client'

import { useRouter } from 'next/navigation'
import React from 'react'
import { LuArrowLeft } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { useInWorkspaceHeader, WorkspaceHeaderSlot } from '@/components/layout/WorkspaceHeaderContext'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { useAgent } from '@/lib/agent/agent-context'

import { ModelChannelEditor } from './ModelChannelEditor'
import { SettingsSideNav } from './SettingsSideNav'

interface Props {
  profileId?: string
  isNew?: boolean
}

export function ModelChannelEditPageContent({ profileId, isNew = false }: Props) {
  const t = useT()
  const router = useRouter()
  const inWorkspace = useInWorkspaceHeader()
  const { profiles } = useAgent()

  const profile = profileId ? profiles.find((p) => p.id === profileId) : undefined

  const title = isNew ? '新增模型接入项目' : profile ? `编辑模型：${profile.name || profile.config.model}` : '编辑模型接入项目'
  const desc = isNew ? '配置新模型渠道与黑白名单。' : `编辑渠道接口与黑白名单。`

  const handleBack = () => {
    router.replace('/settings/models')
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-paper text-ink select-text">
      {inWorkspace ? (
        <WorkspaceHeaderSlot>
          <span className="text-xs font-semibold text-ink">{t('gitAgent.settingsTitle')}</span>
        </WorkspaceHeaderSlot>
      ) : (
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

      {/* Main Workspace Split: Left Icon Rail + Right Content Hub */}
      <div className="flex min-h-0 flex-1 overflow-hidden bg-paper">
        {/* Left Sub-navigation Rail */}
        <SettingsSideNav activeSection="models" />

        {/* Right Configuration Page */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Header bar */}
          <div className="shrink-0 border-b border-line bg-paper-2 p-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-panel text-ink-soft hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 transition-all cursor-pointer"
                title="返回模型列表"
              >
                <LuArrowLeft className="size-4" aria-hidden="true" />
                <span className="sr-only">返回模型列表</span>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-xs font-bold text-ink">{title}</h1>
                <p className="mt-0.5 text-xs text-ink-soft leading-relaxed">{desc}</p>
              </div>
            </div>
          </div>

          {/* Content body - left aligned with standard padding */}
          <div className="@container/settings flex-1 min-h-0 overflow-y-auto p-3 pb-24">
            <div className="grid w-full gap-3">
              {profileId && !profile && !isNew ? (
                <div className="rounded-xl border border-line bg-panel p-6 text-center space-y-3">
                  <p className="text-xs text-ink-soft">未找到对应的模型配置，可能已被移除或尚未加载。</p>
                  <button type="button" onClick={handleBack} className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline cursor-pointer">
                    <LuArrowLeft className="size-3.5" />
                    返回模型列表
                  </button>
                </div>
              ) : (
                <ModelChannelEditor showTools profile={profile} isNew={isNew} onBack={handleBack} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
