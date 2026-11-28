'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { LuSettings } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { DownloadCenter } from '@/components/downloads/DownloadCenter'
import { AgentFairyIcon } from '@/components/git/agent/AgentFairyIcon'
import { GitModeSwitcher } from '@/components/git/GitModeSwitcher'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { useWorkspaceHeader } from '@/components/layout/WorkspaceHeaderContext'
import { Tooltip } from '@/components/sk'
import { dropdownTriggerClass } from '@/components/sk/dropdownMenu'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { useAgent } from '@/lib/agent/agent-context'
import { useGitDriver, useModeHref } from '@/lib/git/driver'
import { getLastGitUrl, saveLastGitUrl } from '@/lib/git/last-git-url'
import { stripLocalPrefix } from '@/lib/git/route-mode'
import { cn } from '@/lib/utils'

export function WorkspaceHeader() {
  const t = useT()
  const pathname = usePathname() || ''
  const logicalPath = stripLocalPrefix(pathname)
  const { mode } = useGitDriver()
  const modeHref = useModeHref()
  const ctx = useWorkspaceHeader()
  const { dockMode, setDockMode, isProcessing } = useAgent()
  const isSettings = logicalPath.startsWith('/settings')
  const isDev = logicalPath.startsWith('/dev')
  const hideAgent = logicalPath.startsWith('/dev/studio') || logicalPath.startsWith('/dev/logs')
  const isSidebarOpen = dockMode !== 'collapsed'
  const sidebarTooltip = isSidebarOpen ? t('gitAgent.collapseYggi') || 'Collapse Yggi' : t('gitAgent.wakeYggi') || 'Wake Yggi'
  const [lastGitHomeHref, setLastGitHomeHref] = React.useState(() => modeHref('/git'))

  React.useEffect(() => {
    if (typeof window !== 'undefined' && logicalPath.startsWith('/git')) {
      saveLastGitUrl(window.location.pathname + window.location.search)
    }
    if (isSettings || isDev) {
      setLastGitHomeHref(getLastGitUrl(mode))
    }
  }, [pathname, logicalPath, isSettings, isDev, mode])

  const homeHref = logicalPath.startsWith('/workdesk') ? modeHref('/workdesk') : logicalPath.startsWith('/git') ? modeHref('/git') : isSettings || isDev ? lastGitHomeHref : '/'

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel-2/60 px-3 py-1.5">
      <BrandLogo
        href={homeHref}
        className="shrink-0"
        markClassName="size-7"
        wordmarkClassName="text-[0.95rem]"
        onClick={(e) => {
          if (logicalPath.startsWith('/workdesk')) {
            const closeBtn = document.querySelector<HTMLButtonElement>('[data-testid="workdesk-detail-close-btn"]')
            if (closeBtn) {
              e.preventDefault()
              closeBtn.click()
            }
          }
        }}
      />

      <span className="h-4 w-px shrink-0 bg-[color-mix(in_oklab,var(--ink)_16%,transparent)]" aria-hidden="true" />

      {/* Page contextual slot (e.g. Git Project Switcher / Settings Title) */}
      <div ref={ctx?.setSlotNode} className="flex min-w-0 flex-1 items-center gap-2" />

      {/* Header Actions & Toolbars */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <div ref={ctx?.setActionsNode} className="flex items-center gap-1.5" />

        {/* Git Mode Switcher (Edge / Local) retained across development view (hidden in /dev pages) */}
        {!logicalPath.startsWith('/dev') && process.env.NODE_ENV === 'development' && (
          <>
            <GitModeSwitcher />
            <span className="mx-0.5 h-3.5 w-px shrink-0 bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]" aria-hidden="true" />
          </>
        )}

        <DownloadCenter />
        <ThemeSwitcher compact />
        <LocaleSwitcher compact />

        <Tooltip content={t('gitAgent.settingsTitle')} placement="bottom">
          <Link
            href={modeHref('/settings/models')}
            onClick={() => {
              if (logicalPath.startsWith('/git')) {
                saveLastGitUrl(window.location.pathname + window.location.search)
              }
            }}
            className={cn(dropdownTriggerClass, isSettings && 'border-accent/40 bg-accent/15 font-semibold text-accent shadow-xs')}
            aria-label={t('gitAgent.settingsTitle')}
          >
            <LuSettings className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t('gitAgent.settingsTitle')}</span>
          </Link>
        </Tooltip>

        {!hideAgent && (
          <Tooltip content={sidebarTooltip} placement="bottom">
            <button
              type="button"
              onClick={() => setDockMode(isSidebarOpen ? 'collapsed' : 'dock-right')}
              className={cn(dropdownTriggerClass, 'size-7 px-0 justify-center', isSidebarOpen && 'border-accent/40 bg-accent/15 font-semibold text-accent shadow-xs')}
              aria-label={sidebarTooltip}
              aria-pressed={isSidebarOpen}
            >
              <AgentFairyIcon className="size-5 shrink-0" active={isProcessing} />
            </button>
          </Tooltip>
        )}
      </div>
    </header>
  )
}
