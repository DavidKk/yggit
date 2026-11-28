'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getDriverMode, type GitDriverMode } from '@/lib/git/driver'
import { isAllowedAgentPath } from '@/lib/security/agent-paths'
import { deleteEdgeSecret, isWebCryptoVaultSupported, listEdgeSecretIds, sealEdgeSecret } from '@/lib/security/edge-vault'

import { DEFAULT_MODEL_FILTER, type ModelFilterOptions } from './model-filter'
import { type AgentModelProfile, DEFAULT_BROWSER_AI_PROFILE, MODEL_PROFILES_STORAGE_KEY, parseModelProfiles, serializeModelProfiles } from './model-profiles'
import { DEFAULT_AGENT_CONFIG } from './types'
import { markBrowserAiDismissed, useBrowserAiAutoRegister } from './use-browser-ai-auto-register'

/**
 * Manages Agent model profiles across Edge (IndexedDB/localStorage) and Local (encrypted file vault) modes.
 */
export function useAgentProfiles(pathname: string | null) {
  const [driverMode, setDriverMode] = useState<GitDriverMode>(() => getDriverMode())
  const [profiles, setProfiles] = useState<AgentModelProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState('')
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const loadedProfileScopeRef = useRef<string | null>(null)
  const config = (profiles.find((profile) => profile.id === activeProfileId) || profiles[0])?.config || DEFAULT_AGENT_CONFIG

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncMode = () => setDriverMode(getDriverMode())
    window.addEventListener('yggit:driver_mode_changed', syncMode)
    return () => window.removeEventListener('yggit:driver_mode_changed', syncMode)
  }, [])

  useEffect(() => {
    setDriverMode(getDriverMode())
  }, [pathname])

  useEffect(() => {
    let cancelled = false
    const useLocalServerStore = driverMode === 'local' && typeof fetch === 'function'
    const allowed = isAllowedAgentPath(pathname || '')
    const scopeKey = `${driverMode}:${allowed ? '1' : '0'}`
    if (loadedProfileScopeRef.current === scopeKey) {
      return
    }
    loadedProfileScopeRef.current = scopeKey

    if (useLocalServerStore) {
      let settled = false
      // Local mode is strictly isolated from Edge browser localStorage
      setProfiles([])
      setActiveProfileId('')
      setProfilesLoaded(false)

      if (!allowed) {
        return () => {
          cancelled = true
        }
      }

      void (async () => {
        try {
          const res = await fetch('/api/git/agent/profiles')
          if (!res.ok) return
          const data = (await res.json()) as { stored?: { profiles: AgentModelProfile[]; activeId: string } | null }
          if (!cancelled && data?.stored?.profiles?.length) {
            setProfiles(data.stored.profiles)
            setActiveProfileId(data.stored.activeId)
          }
        } catch {
          // Local backend vault unavailable
        } finally {
          settled = true
          if (!cancelled) setProfilesLoaded(true)
        }
      })()

      return () => {
        cancelled = true
        if (!settled && loadedProfileScopeRef.current === scopeKey) {
          loadedProfileScopeRef.current = null
        }
      }
    }

    // Edge mode (or test environment without fetch): strictly isolated browser storage + Edge IndexedDB vault
    try {
      const stored = parseModelProfiles(localStorage.getItem(MODEL_PROFILES_STORAGE_KEY))
      if (stored) {
        setProfiles(stored.profiles)
        setActiveProfileId(stored.activeId)
      } else {
        setProfiles([])
        setActiveProfileId('')
      }
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('yggit.agent.session-keys.v1')
      }
    } catch {
      // Keep the in-memory defaults when browser storage is unavailable.
    }
    setProfilesLoaded(true)

    if (!allowed) {
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      try {
        const secretIds = await listEdgeSecretIds()
        if (cancelled || secretIds.size === 0) return
        setProfiles((prev) => prev.map((p) => (secretIds.has(p.id) ? { ...p, config: { ...p.config, apiKey: undefined, hasApiKey: true } } : p)))
      } catch {
        // Edge Web Crypto vault unavailable
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pathname, driverMode])

  useEffect(() => {
    if (!profilesLoaded) return
    if (driverMode === 'local' && typeof fetch === 'function') return
    try {
      if (profiles.length === 0) {
        localStorage.removeItem(MODEL_PROFILES_STORAGE_KEY)
      } else {
        localStorage.setItem(MODEL_PROFILES_STORAGE_KEY, serializeModelProfiles(profiles, activeProfileId))
      }
    } catch {
      // Profiles remain usable for this session when browser storage is unavailable.
    }
  }, [profiles, activeProfileId, profilesLoaded, driverMode])

  useBrowserAiAutoRegister({ profilesLoaded, pathname: pathname ?? '', profiles, setProfiles })

  const selectProfile = useCallback((id: string) => {
    setActiveProfileId(id)
    if (getDriverMode() === 'local' && typeof fetch === 'function') {
      void fetch('/api/git/agent/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select', profileId: id }),
      }).catch(() => {})
    }
  }, [])

  const saveProfile = useCallback((profile: AgentModelProfile, options?: { clearApiKey?: boolean }) => {
    const mode = getDriverMode()
    const edgeVaultReady = mode === 'edge' && isWebCryptoVaultSupported()
    const hasApiKey = Boolean(profile.config.apiKey?.trim() || (profile.config.hasApiKey && !options?.clearApiKey))
    const trimmedKey = profile.config.apiKey?.trim()
    const normalized: AgentModelProfile = {
      ...profile,
      config: {
        ...profile.config,
        // Never retain plaintext apiKey in React state when sealed into Local or Edge encrypted vault
        ...(mode === 'local' && typeof fetch === 'function' ? { apiKey: undefined } : {}),
        ...(edgeVaultReady ? { apiKey: undefined } : {}),
        ...(hasApiKey ? { hasApiKey: true } : { hasApiKey: false }),
      },
    }
    setProfiles((previous) =>
      previous.some((item) => item.id === normalized.id) ? previous.map((item) => (item.id === normalized.id ? normalized : item)) : [...previous, normalized]
    )
    setActiveProfileId(normalized.id)

    if (mode === 'local') {
      if (typeof fetch === 'function') {
        void fetch('/api/git/agent/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: { ...normalized, config: { ...normalized.config, apiKey: trimmedKey } },
            clearApiKey: Boolean(options?.clearApiKey),
            setActive: true,
          }),
        }).catch(() => {})
      }
    } else {
      if (options?.clearApiKey) {
        void deleteEdgeSecret(normalized.id).catch(() => {})
      } else if (trimmedKey) {
        void sealEdgeSecret(normalized.id, trimmedKey).catch(() => {})
      }
    }
  }, [])

  const deleteProfile = useCallback(
    async (id: string) => {
      if (getDriverMode() === 'local' && typeof fetch === 'function') {
        const res = await fetch(`/api/git/agent/profiles?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || `Failed to delete model profile (${res.status})`)
        }
      } else {
        await deleteEdgeSecret(id)
      }
      setProfiles((previous) => {
        const target = previous.find((item) => item.id === id)
        if (target?.config.provider === 'browser-ai' || id === DEFAULT_BROWSER_AI_PROFILE.id) {
          markBrowserAiDismissed()
        }
        const next = previous.filter((item) => item.id !== id)
        if (activeProfileId === id) {
          setActiveProfileId(next.length > 0 ? next[0].id : '')
        }
        return next
      })
    },
    [activeProfileId]
  )

  const toggleProfileEnabled = useCallback(
    (id: string, enabled: boolean) => {
      let updatedProfile: AgentModelProfile | null = null
      setProfiles((previous) => {
        const next = previous.map((item) => {
          if (item.id !== id) return item
          updatedProfile = { ...item, enabled }
          return updatedProfile
        })
        if (!enabled && activeProfileId === id) {
          const fallback = next.find((item) => item.enabled !== false) || next[0]
          if (fallback) setActiveProfileId(fallback.id)
        }
        return next
      })
      if (updatedProfile && getDriverMode() === 'local' && typeof fetch === 'function') {
        void fetch('/api/git/agent/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: updatedProfile,
            clearApiKey: false,
            setActive: false,
          }),
        }).catch(() => {})
      }
    },
    [activeProfileId]
  )

  const activeProfile = useMemo(() => profiles.find((p) => p.id === activeProfileId) || profiles[0], [profiles, activeProfileId])
  const modelFilter = activeProfile?.filter || DEFAULT_MODEL_FILTER

  const setModelFilter = useCallback(
    (action: React.SetStateAction<ModelFilterOptions>) => {
      setProfiles((previous) =>
        previous.map((item) => {
          if (item.id === activeProfileId) {
            const currentFilter = item.filter || DEFAULT_MODEL_FILTER
            const nextFilter = typeof action === 'function' ? action(currentFilter) : action
            return { ...item, filter: nextFilter }
          }
          return item
        })
      )
    },
    [activeProfileId]
  )

  return {
    config,
    profiles,
    activeProfile,
    activeProfileId,
    profilesLoaded,
    modelFilter,
    setModelFilter,
    selectProfile,
    saveProfile,
    deleteProfile,
    toggleProfileEnabled,
  }
}
