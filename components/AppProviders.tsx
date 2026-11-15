'use client'

import { type ReactNode } from 'react'

import { ConfirmProvider } from '@/components/confirm/ConfirmProvider'
import { UnsavedChangesProvider } from '@/components/confirm/UnsavedChangesProvider'
import { LocaleProvider } from '@/components/i18n/LocaleProvider'
import { NotificationProvider } from '@/components/notification/NotificationProvider'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { AgentProvider } from '@/lib/agent/agent-context'
import { SpotlightProvider } from '@/lib/agent/spotlight-context'
import type { Locale, LocalePreference } from '@/lib/i18n'
import type { ThemeMode, ThemePreference } from '@/lib/theme'

export function AppProviders({
  children,
  locale,
  preference,
  theme,
  themePreference,
}: {
  children: ReactNode
  locale: Locale
  preference: LocalePreference
  theme: ThemeMode
  themePreference: ThemePreference
}) {
  return (
    <LocaleProvider initialLocale={locale} initialPreference={preference}>
      <ThemeProvider initialTheme={theme} initialPreference={themePreference}>
        <NotificationProvider>
          <ConfirmProvider>
            <UnsavedChangesProvider>
              <SpotlightProvider>
                <AgentProvider>{children}</AgentProvider>
              </SpotlightProvider>
            </UnsavedChangesProvider>
          </ConfirmProvider>
        </NotificationProvider>
      </ThemeProvider>
    </LocaleProvider>
  )
}
