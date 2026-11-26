'use client'

import Link from 'next/link'
import React, { useState } from 'react'
import { LuArrowUpRight, LuMonitor, LuMoon, LuSun } from 'react-icons/lu'

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
    { value: 'auto', label: 'System', icon: LuMonitor },
    { value: 'light', label: 'Light', icon: LuSun },
    { value: 'dark', label: 'Dark', icon: LuMoon },
  ]

  const localeOptions: Array<{ value: LocalePreference; label: string }> = [
    { value: 'auto', label: 'System (Auto)' },
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
      <SettingsSectionCard title="Appearance & Preferences" description="Customize the application theme and display language.">
        <fieldset className="divide-y divide-line/60">
          {/* Row 1: Theme Mode */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 first:pt-0 items-center">
            <div className="md:col-span-5 min-w-0">
              <span className="text-xs font-semibold text-ink">Theme</span>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">Choose your preferred color mode or follow the OS setting.</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full">
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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
            <div className="md:col-span-5 min-w-0">
              <label htmlFor="general-locale-select" className="text-xs font-semibold text-ink">
                Display Language
              </label>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">Multi-language display preference.</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full">
              <Select id="general-locale-select" className="w-full" value={localePref} options={localeOptions} onChange={(val) => setLocale(val as LocalePreference)} />
            </div>
          </div>
        </fieldset>
      </SettingsSectionCard>

      {/* Card 2: Git Log & Graph Preferences */}
      <SettingsSectionCard title="Git View Preferences" description="Configure commit graph rendering and interaction behavior.">
        <fieldset className="divide-y divide-line/60">
          {/* Row 1: Branch Hover Spotlight */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 first:pt-0 items-center">
            <div className="md:col-span-5 min-w-0">
              <span className="text-xs font-semibold text-ink">Branch Hover Spotlight</span>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">Dim other nodes when hovering a branch pill to highlight the active branch.</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex items-center justify-end">
              <SwitchToggle checked={branchSpotlightEnabled} onCheckedChange={setBranchSpotlightEnabled} size="sm" aria-label="Branch Hover Spotlight" />
            </div>
          </div>

          {/* Row 2: Runtime Info */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
            <div className="md:col-span-5 min-w-0">
              <span className="text-xs font-semibold text-ink">Execution Mode</span>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">Underlying Git driver runtime.</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex items-center justify-end gap-2">
              <Badge tone={isEdge ? 'accent' : 'ok'}>{isEdge ? 'Edge / isomorphic-git' : 'Node.js Local Driver'}</Badge>
            </div>
          </div>
        </fieldset>
      </SettingsSectionCard>
      <StorageSettingsSection />

      <div className="flex items-center justify-between rounded-xl border border-line/70 bg-panel/60 px-4 py-2.5 text-xs text-ink-soft">
        <span>Developer Diagnostics: Inspect Agent context traces and operation error logs</span>
        <Link href="/dev/logs/context" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          <span>Open Diagnostics Log</span>
          <LuArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
