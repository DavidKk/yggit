'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { LuSettings } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { GitModeSwitcher } from '@/components/git/GitModeSwitcher'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { useWorkspaceHeader } from '@/components/layout/WorkspaceHeaderContext'
import { Tooltip } from '@/components/sk'
import { dropdownTriggerClass } from '@/components/sk/dropdownMenu'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { getLastGitUrl, saveLastGitUrl } from '@/lib/git/last-git-url'
import { cn } from '@/lib/utils'

export function WorkspaceHeader() {
  const t = useT()
  const pathname = usePathname() || ''
  const ctx = useWorkspaceHeader()
  const isSettings = pathname.startsWith('/settings')

  React.useEffect(() => {
    if (typeof window !== 'undefined' && pathname.startsWith('/git')) {
      saveLastGitUrl(window.location.pathname + window.location.search)
    }
  }, [pathname])

  const homeHref = pathname.startsWith('/git') ? '/git' : isSettings ? getLastGitUrl() : '/'

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel-2/60 px-3 py-1.5">
      <BrandLogo href={homeHref} className="shrink-0" markClassName="size-7" wordmarkClassName="text-[0.95rem]" />

      <span className="h-4 w-px shrink-0 bg-[color-mix(in_oklab,var(--ink)_16%,transparent)]" aria-hidden="true" />

      {/* Page contextual slot (e.g. Git Project Switcher / Settings Title) */}
      <div ref={ctx?.setSlotNode} className="flex min-w-0 flex-1 items-center gap-2" />

      {/* Header Actions & Toolbars */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <div ref={ctx?.setActionsNode} className="flex items-center gap-1.5" />

        {/* Git Mode Switcher (Edge / Local) retained across both views */}
        <GitModeSwitcher />

        <span className="mx-0.5 h-3.5 w-px shrink-0 bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]" aria-hidden="true" />

        <ThemeSwitcher compact />
        <LocaleSwitcher compact />

        <Tooltip content={t('gitAgent.settingsTitle')} placement="bottom">
          <Link
            href="/settings/models"
            onClick={() => {
              if (pathname.startsWith('/git')) {
                saveLastGitUrl(window.location.pathname + window.location.search)
              }
            }}
            className={cn(dropdownTriggerClass, 'px-2', isSettings && 'bg-[color-mix(in_oklab,var(--ink)_9%,transparent)] font-semibold text-accent')}
            aria-label={t('gitAgent.settingsTitle')}
          >
            <LuSettings className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t('gitAgent.settingsTitle')}</span>
          </Link>
        </Tooltip>
      </div>
    </header>
  )
}
