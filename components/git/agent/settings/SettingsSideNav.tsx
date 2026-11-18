'use client'

import Link from 'next/link'
import React from 'react'
import { LuCpu, LuMousePointerClick, LuShieldCheck, LuSlidersHorizontal } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk'
import { cn } from '@/lib/utils'

export type SettingsSectionKey = 'models' | 'privacy' | 'general' | 'menus'

interface Props {
  activeSection: SettingsSectionKey
  onSelectSection?: (section: SettingsSectionKey) => void
}

export function SettingsSideNav({ activeSection, onSelectSection }: Props) {
  const t = useT()

  const navItems = [
    {
      id: 'models' as const,
      label: t('gitAgent.tabModels'),
      href: '/settings/models',
      icon: <LuCpu className="h-4.5 w-4.5" aria-hidden="true" />,
    },
    {
      id: 'privacy' as const,
      label: t('gitAgent.tabPrivacy'),
      href: '/settings/privacy',
      icon: <LuShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />,
    },
    {
      id: 'general' as const,
      label: t('gitAgent.tabGeneral') || '通用设置',
      href: '/settings/general',
      icon: <LuSlidersHorizontal className="h-4.5 w-4.5" aria-hidden="true" />,
    },
    {
      id: 'menus' as const,
      label: '右键菜单',
      href: '/settings/menus',
      icon: <LuMousePointerClick className="h-4.5 w-4.5" aria-hidden="true" />,
    },
  ]

  return (
    <aside aria-label="Agent Settings Navigation" className="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-line bg-paper-2 py-3 md:w-14">
      <nav className="flex flex-col items-center gap-1">
        {navItems.map((item) => {
          const isActive = activeSection === item.id
          return (
            <Tooltip key={item.id} content={item.label} placement="right">
              <Link
                href={item.href}
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
    </aside>
  )
}
