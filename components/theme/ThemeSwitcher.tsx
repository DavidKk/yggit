'use client'

import { Menu } from '@base-ui/react/menu'
import { useEffect, useRef, useState } from 'react'
import { IoCheckmark, IoMoonOutline, IoSunnyOutline } from 'react-icons/io5'
import { LuMonitor } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { dropdownItemClass, dropdownPopupClass, dropdownTriggerClass } from '@/components/sk/dropdownMenu'
import { useTheme } from '@/components/theme/ThemeProvider'
import { isThemePreference, type ThemePreference } from '@/lib/theme'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  compact?: boolean
}

/** Render the request theme immediately, including before client hydration. */
export function ThemeSwitcher({ className }: Props) {
  const t = useT()
  const { theme, preference, setTheme } = useTheme()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [container, setContainer] = useState<ShadowRoot>()

  useEffect(() => {
    const root = anchorRef.current?.getRootNode()
    if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) setContainer(root)
  }, [])

  const TriggerIcon = preference === 'auto' ? LuMonitor : theme === 'light' ? IoSunnyOutline : IoMoonOutline

  const options: Array<{ value: ThemePreference; label: string; Icon: typeof LuMonitor }> = [
    { value: 'auto', label: t('theme.auto') || '自动（跟随系统）', Icon: LuMonitor },
    { value: 'light', label: t('theme.light') || '浅色模式', Icon: IoSunnyOutline },
    { value: 'dark', label: t('theme.dark') || '深色模式', Icon: IoMoonOutline },
  ]

  const triggerLabel =
    preference === 'auto'
      ? t('theme.autoShort') || t('theme.auto') || '自动'
      : theme === 'light'
        ? t('theme.lightShort') || t('theme.light') || '浅色'
        : t('theme.darkShort') || t('theme.dark') || '深色'

  return (
    <span ref={anchorRef} className={cn('inline-flex', className)}>
      <Menu.Root>
        <Menu.Trigger aria-label={t('theme.switch')} className={dropdownTriggerClass}>
          <TriggerIcon size={15} aria-hidden className="shrink-0" />
          <span className="whitespace-nowrap">{triggerLabel}</span>
        </Menu.Trigger>
        <Menu.Portal container={container}>
          <Menu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} positionMethod="fixed" className="z-[70]">
            <Menu.Popup aria-label={t('theme.switch')} className={dropdownPopupClass}>
              <Menu.RadioGroup
                value={preference}
                onValueChange={(value: unknown) => {
                  if (isThemePreference(value)) setTheme(value)
                }}
              >
                {options.map((opt) => (
                  <Menu.RadioItem key={opt.value} value={opt.value} closeOnClick className={dropdownItemClass}>
                    <span className="inline-flex items-center gap-2">
                      <opt.Icon size={14} aria-hidden className="shrink-0 opacity-80" />
                      {opt.label}
                    </span>
                    <Menu.RadioItemIndicator keepMounted className="inline-flex shrink-0 data-[unchecked]:invisible">
                      <IoCheckmark size={14} aria-hidden />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </span>
  )
}
