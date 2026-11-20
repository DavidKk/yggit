'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import {
  applyDocumentTheme,
  detectSystemTheme,
  isThemePreference,
  readStoredTheme,
  themeForPreference,
  type ThemeMode,
  type ThemePreference,
  writeResolvedTheme,
  writeStoredTheme,
} from '@/lib/theme'

type ThemeContextValue = {
  theme: ThemeMode
  preference: ThemePreference
  ready: boolean
  setTheme: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

type Props = {
  children: ReactNode
  initialTheme?: ThemeMode
  initialPreference?: ThemePreference
}

export function ThemeProvider({ children, initialTheme = 'dark', initialPreference = 'auto' }: Props) {
  const [preference, setPreference] = useState<ThemePreference>(initialPreference)
  // Hydration must start from the same snapshot as SSR.
  const [systemTheme, setSystemTheme] = useState<ThemeMode>(initialTheme)
  const [ready, setReady] = useState(false)
  const theme = themeForPreference(preference, systemTheme)

  useEffect(() => {
    const stored = readStoredTheme()
    setPreference(stored ?? initialPreference)
    setSystemTheme(detectSystemTheme(initialTheme))
    setReady(true)

    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => setSystemTheme(mq.matches ? 'dark' : 'light')
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      // Keep the resolved theme if media queries are unavailable.
    }
  }, [initialPreference, initialTheme])

  useEffect(() => {
    // Leave the pre-paint result intact until browser preferences are restored.
    if (!ready) return
    applyDocumentTheme(theme)
    writeStoredTheme(preference)
    writeResolvedTheme(theme)
  }, [theme, preference, ready])

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next)
    writeStoredTheme(next)
  }, [])

  useEffect(() => {
    function onThemeChange(e: Event) {
      const customEvent = e as CustomEvent<ThemePreference>
      if (customEvent.detail && isThemePreference(customEvent.detail)) {
        setTheme(customEvent.detail)
      }
    }
    window.addEventListener('yggit:set_theme', onThemeChange)
    return () => window.removeEventListener('yggit:set_theme', onThemeChange)
  }, [setTheme])

  const value = useMemo(() => ({ theme, preference, ready, setTheme }), [theme, preference, ready, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export function useThemeMode(): ThemeMode {
  return useContext(ThemeContext)?.theme ?? 'dark'
}
