'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { applyDocumentTheme, detectSystemTheme, readStoredTheme, themeForPreference, type ThemeMode, type ThemePreference, writeStoredTheme } from '@/lib/theme'

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
  // Client must match boot script / system immediately; SSR keeps cookie or dark default.
  const [systemTheme, setSystemTheme] = useState<ThemeMode>(() => (typeof window !== 'undefined' ? detectSystemTheme() : initialTheme))
  const theme = themeForPreference(preference, systemTheme)

  useEffect(() => {
    // Game overlay / no SSR seed: restore preference from storage.
    if (initialPreference === 'auto') {
      const stored = readStoredTheme()
      if (stored) setPreference(stored)
    }
    setSystemTheme(detectSystemTheme())

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemTheme(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [initialPreference])

  useEffect(() => {
    applyDocumentTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next)
    writeStoredTheme(next)
  }, [])

  const value = useMemo(() => ({ theme, preference, ready: true, setTheme }), [theme, preference, setTheme])

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
