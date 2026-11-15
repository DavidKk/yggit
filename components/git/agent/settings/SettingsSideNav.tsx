'use client'

import React from 'react'
import { LuCpu, LuShieldCheck } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk'
import { cn } from '@/lib/utils'

export type SettingsSectionKey = 'models' | 'privacy'

interface Props {
  activeSection: SettingsSectionKey
  onSelectSection: (section: SettingsSectionKey) => void
}

export function SettingsSideNav({ activeSection, onSelectSection }: Props) {
  const t = useT()

  const navItems = [
    {
      id: 'models' as const,
      label: t('gitAgent.tabModels'),
      icon: <LuCpu className="h-5 w-5" />,
    },
    {
      id: 'privacy' as const,
      label: t('gitAgent.tabPrivacy'),
      icon: <LuShieldCheck className="h-5 w-5" />,
    },
  ]

  return (
    <nav aria-label="Agent Settings Navigation" className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-border/40 bg-muted/20 py-3">
      {navItems.map((item) => {
        const isActive = activeSection === item.id
        return (
          <Tooltip key={item.id} content={item.label} placement="right">
            <button
              type="button"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectSection(item.id)}
              className={cn(
                'group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                isActive ? 'bg-accent/20 text-accent font-semibold shadow-sm' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              )}
            >
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-accent" aria-hidden="true" />}
              {item.icon}
            </button>
          </Tooltip>
        )
      })}
    </nav>
  )
}
