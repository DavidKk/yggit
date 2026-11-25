import './globals.css'

import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import { AmbientBackground } from '@/components/AmbientBackground'
import { AppProviders } from '@/components/AppProviders'
import { AppShell } from '@/components/AppShell'
import { ButtonGlow } from '@/components/ButtonGlow'
import { PRODUCT_DISPLAY_NAME } from '@/constants/brand'
import { LOCALE_HTML_LANG } from '@/lib/i18n'
import { resolveRequestLocale } from '@/lib/i18n/server'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'
import { resolveRequestTheme } from '@/lib/theme/server'

/** Self-hosted fonts so CI / offline builds do not call fonts.google.com */
const display = localFont({
  src: './fonts/outfit-latin-wght-normal.woff2',
  variable: '--font-display',
  weight: '500 700',
  display: 'swap',
})

const body = localFont({
  src: './fonts/manrope-latin-wght-normal.woff2',
  variable: '--font-body',
  weight: '400 700',
  display: 'swap',
})

const mono = localFont({
  src: './fonts/jetbrains-mono-latin-wght-normal.woff2',
  variable: '--font-mono',
  weight: '400 500',
  display: 'swap',
})

export const metadata: Metadata = {
  title: PRODUCT_DISPLAY_NAME,
  description: '世界树 Git 图谱与版本管理工具',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const [{ locale, preference }, { theme, preference: themePreference }] = await Promise.all([resolveRequestLocale(), resolveRequestTheme()])

  return (
    // Extensions may inject root attributes before hydration; keep suppression scoped to html.
    <html
      suppressHydrationWarning
      lang={LOCALE_HTML_LANG[locale]}
      data-theme={theme}
      style={{ colorScheme: theme }}
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
    >
      <body className="h-full overflow-hidden">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <AmbientBackground />
        <ButtonGlow />
        <AppProviders locale={locale} preference={preference} theme={theme} themePreference={themePreference}>
          <AppShell>{children}</AppShell>
        </AppProviders>
        {process.env.VERCEL === '1' ? <Analytics /> : null}
      </body>
    </html>
  )
}
