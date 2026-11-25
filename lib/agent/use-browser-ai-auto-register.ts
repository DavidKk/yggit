'use client'

import { useEffect } from 'react'

import { getDriverMode } from '@/lib/git/driver'
import { isAllowedAgentPath } from '@/lib/security/agent-paths'

import { getBrowserAiAvailability } from './browser-ai'
import { type AgentModelProfile, DEFAULT_BROWSER_AI_PROFILE } from './model-profiles'

export const BROWSER_AI_DISMISSED_KEY = 'yggit.agent.browser-ai-dismissed.v1'

export function markBrowserAiDismissed(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BROWSER_AI_DISMISSED_KEY, '1')
    }
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Auto-registers a default Browser AI profile when Chrome Built-in AI is natively supported
 * and the user has not explicitly dismissed it.
 */
export function useBrowserAiAutoRegister({
  profilesLoaded,
  pathname,
  profiles,
  setProfiles,
}: {
  profilesLoaded: boolean
  pathname: string
  profiles: AgentModelProfile[]
  setProfiles: React.Dispatch<React.SetStateAction<AgentModelProfile[]>>
}): void {
  useEffect(() => {
    if (!profilesLoaded || typeof window === 'undefined' || !isAllowedAgentPath(pathname)) return
    if (profiles.some((p) => p.config.provider === 'browser-ai' || p.id === DEFAULT_BROWSER_AI_PROFILE.id)) return

    let dismissed = false
    try {
      dismissed = window.localStorage.getItem(BROWSER_AI_DISMISSED_KEY) === '1'
    } catch {
      // Ignore storage access errors
    }
    if (dismissed) return

    let cancelled = false
    void (async () => {
      const { status } = await getBrowserAiAvailability()
      if (cancelled || (status !== 'available' && status !== 'downloadable')) return

      setProfiles((prev) => {
        if (prev.some((p) => p.config.provider === 'browser-ai' || p.id === DEFAULT_BROWSER_AI_PROFILE.id)) {
          return prev
        }
        return [...prev, DEFAULT_BROWSER_AI_PROFILE]
      })

      if (getDriverMode() === 'local' && typeof fetch === 'function') {
        void fetch('/api/git/agent/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: DEFAULT_BROWSER_AI_PROFILE,
            clearApiKey: false,
            setActive: false,
          }),
        }).catch(() => {})
      }
    })()

    return () => {
      cancelled = true
    }
  }, [profilesLoaded, pathname, profiles, setProfiles])
}
