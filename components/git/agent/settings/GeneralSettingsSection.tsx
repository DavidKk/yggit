'use client'

import React, { useState } from 'react'
import { LuMonitor, LuMoon, LuSun } from 'react-icons/lu'

import { useLocale } from '@/components/i18n/LocaleProvider'
import { Badge, Select, SwitchToggle } from '@/components/sk'
import { useTheme } from '@/components/theme/ThemeProvider'
import { getDriverMode } from '@/lib/git/driver'
import type { LocalePreference } from '@/lib/i18n'
import type { ThemePreference } from '@/lib/theme'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'
import { StorageSettingsSection } from './StorageSettingsSection'

export function GeneralSettingsSection() {
  const { preference: themePref, setTheme } = useTheme()
  const { preference: localePref, setLocale } = useLocale()
  const [branchSpotlightEnabled, setBranchSpotlightEnabled] = useState(true)

  const isEdge = getDriverMode() === 'edge'

  const themeOptions: Array<{ value: ThemePreference; label: string; icon: typeof LuMonitor }> = [
    { value: 'auto', label: '跟随系统', icon: LuMonitor },
    { value: 'light', label: '浅色模式', icon: LuSun },
    { value: 'dark', label: '深色模式', icon: LuMoon },
  ]

  const localeOptions: Array<{ value: LocalePreference; label: string }> = [
    { value: 'auto', label: '跟随系统 (Auto)' },
    { value: 'zh', label: '简体中文' },
    { value: 'en', label: 'English' },
    { value: 'cht', label: '繁體中文' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Card 1: Appearance & Locale */}
      <SettingsSectionCard title="界面与偏好" description="自定义应用程序的显示主题与系统语言。">
        <fieldset className="divide-y divide-line/60">
          {/* Row 1: Theme Mode */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 first:pt-0 items-start">
            <div className="md:col-span-5 min-w-0">
              <span className="text-xs font-semibold text-ink">主题外观</span>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">选择偏好的显示模式或跟随操作系统。</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px]">
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map((opt) => {
                  const selected = themePref === opt.value
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTheme(opt.value)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-md border py-2 px-2.5 text-xs font-medium transition-all cursor-pointer select-none',
                        selected
                          ? 'border-accent bg-accent/10 text-accent font-semibold shadow-xs'
                          : 'border-line bg-panel text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink'
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Locale */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
            <div className="md:col-span-5 min-w-0">
              <label htmlFor="general-locale-select" className="text-xs font-semibold text-ink">
                界面语言
              </label>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">多语言显示偏好。</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px]">
              <Select id="general-locale-select" className="w-full" value={localePref} options={localeOptions} onChange={(val) => setLocale(val as LocalePreference)} />
            </div>
          </div>
        </fieldset>
      </SettingsSectionCard>

      {/* Card 2: Git Log & Graph Preferences */}
      <SettingsSectionCard title="Git 视图首选项" description="设置提交图谱渲染与交互行为。">
        <fieldset className="divide-y divide-line/60">
          {/* Row 1: Branch Hover Spotlight */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 first:pt-0 items-center">
            <div className="md:col-span-5 min-w-0">
              <span className="text-xs font-semibold text-ink">分支悬浮高亮</span>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">鼠标悬停分支标签时，自动变暗其他节点，突出当前分支。</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex items-center justify-end">
              <SwitchToggle checked={branchSpotlightEnabled} onCheckedChange={setBranchSpotlightEnabled} aria-label="分支悬浮高亮" />
            </div>
          </div>

          {/* Row 2: Runtime Info */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
            <div className="md:col-span-5 min-w-0">
              <span className="text-xs font-semibold text-ink">当前执行模式</span>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">客户端底层 Git 驱动核心。</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex items-center justify-end gap-2">
              <Badge tone={isEdge ? 'accent' : 'ok'}>{isEdge ? 'Edge / isomorphic-git' : 'Node.js 本地驱动'}</Badge>
            </div>
          </div>
        </fieldset>
      </SettingsSectionCard>
      <StorageSettingsSection />
    </div>
  )
}
