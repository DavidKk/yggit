'use client'

import Link from 'next/link'
import React from 'react'
import { LuCpu, LuInfo, LuMousePointerClick, LuNetwork, LuShieldCheck, LuSlidersHorizontal, LuSparkles } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk'
import { useModeHref } from '@/lib/git/driver'
import { cn } from '@/lib/utils'

export type SettingsSectionKey = 'models' | 'skills' | 'mcp' | 'privacy' | 'general' | 'menus' | 'about'

interface Props {
  activeSection: SettingsSectionKey
  onSelectSection?: (section: SettingsSectionKey) => void
}

export function SettingsSideNav({ activeSection, onSelectSection }: Props) {
  const t = useT()
  const modeHref = useModeHref()

  const navItems = [
    {
      id: 'models' as const,
      label: t('gitAgent.tabModels'),
      href: modeHref('/settings/models'),
      icon: <LuCpu className="h-4.5 w-4.5" aria-hidden="true" />,
    },
    {
      id: 'skills' as const,
      label: t('gitAgent.tabSkills') || 'Skills',
      href: modeHref('/settings/skills'),
      icon: <LuSparkles className="h-4.5 w-4.5" aria-hidden="true" />,
    },
    {
      id: 'mcp' as const,
      label: t('gitAgent.tabMcp') || 'MCP Tools',
      href: modeHref('/settings/mcp'),
      icon: <LuNetwork className="h-4.5 w-4.5" aria-hidden="true" />,
    },
    {
      id: 'privacy' as const,
      label: t('gitAgent.tabPrivacy'),
      href: modeHref('/settings/privacy'),
      icon: <LuShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />,
    },
    {
      id: 'general' as const,
      label: t('gitAgent.tabGeneral') || 'General',
      href: modeHref('/settings/general'),
      icon: <LuSlidersHorizontal className="h-4.5 w-4.5" aria-hidden="true" />,
    },
    {
      id: 'menus' as const,
      label: t('gitAgent.menusSettingsTitle') || 'Context Menus',
      href: modeHref('/settings/menus'),
      icon: <LuMousePointerClick className="h-4.5 w-4.5" aria-hidden="true" />,
    },
  ]

  const isAboutActive = activeSection === 'about'

  return (
    <aside aria-label="Agent Settings Navigation" className="flex w-12 shrink-0 flex-col items-center justify-between border-r border-line bg-paper-2 py-3 md:w-14">
      <nav className="flex flex-col items-center gap-1">
        {navItems.map((item) => {
          const isActive = activeSection === item.id
          return (
            <Tooltip key={item.id} content={item.label} placement="right">
              <Link
                href={item.href}
                replace
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectSection?.(item.id)}
                className={cn(
                  'group relative flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
                  isActive ? 'bg-accent/15 text-accent shadow-xs' : 'text-ink-soft hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] hover:text-ink'
                )}
              >
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" aria-hidden="true" />}
                {item.icon}
              </Link>
            </Tooltip>
          )
        })}
      </nav>

      {/* Bottom About Us entry */}
      <div className="flex flex-col items-center border-t border-line/60 pt-2">
        <Tooltip content={t('gitAgent.tabAbout') || 'About'} placement="right">
          <Link
            href="/settings/about"
            replace
            aria-label={t('gitAgent.tabAbout') || 'About'}
            aria-current={isAboutActive ? 'page' : undefined}
            onClick={() => onSelectSection?.('about')}
            className={cn(
              'group relative flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
              isAboutActive ? 'bg-accent/15 text-accent shadow-xs' : 'text-ink-soft hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] hover:text-ink'
            )}
          >
            {isAboutActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" aria-hidden="true" />}
            <LuInfo className="h-4.5 w-4.5" aria-hidden="true" />
          </Link>
        </Tooltip>
      </div>
    </aside>
  )
}
