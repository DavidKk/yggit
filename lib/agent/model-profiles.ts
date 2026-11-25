import type { ModelFilterOptions } from './model-filter'
import { AGENT_PRESETS, DEFAULT_AGENT_CONFIG, type EphemeralAgentConfig } from './types'

export interface AgentModelProfile {
  id: string
  name: string
  config: EphemeralAgentConfig
  filter?: ModelFilterOptions
  enabled?: boolean
}

export const DEFAULT_MODEL_PROFILE: AgentModelProfile = {
  id: 'default',
  name: 'Vercel AI Gateway',
  config: DEFAULT_AGENT_CONFIG,
}

export const DEFAULT_BROWSER_AI_PROFILE: AgentModelProfile = {
  id: 'browser-ai-default',
  name: 'Browser AI',
  config: {
    provider: 'browser-ai',
    model: 'gemini-nano',
    baseUrl: 'browser://language-model',
    temperature: 0.2,
    stream: true,
  },
}

export const MODEL_PROFILES_STORAGE_KEY = 'yggit.agent.model-profiles.v1'
export const MODEL_SESSION_KEYS_STORAGE_KEY = 'yggit.agent.session-keys.v1'

/** Reads ephemeral per-profile API keys from sessionStorage (cleared when the browser tab closes). */
export function readSessionApiKeys(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.sessionStorage.getItem(MODEL_SESSION_KEYS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [id, key] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key === 'string' && key.trim()) {
        out[id] = key
      }
    }
    return out
  } catch {
    return {}
  }
}

/** Stores ephemeral per-profile API keys in sessionStorage without ever writing credentials to localStorage. */
export function writeSessionApiKeys(profiles: AgentModelProfile[]): void {
  if (typeof window === 'undefined') return
  try {
    const map: Record<string, string> = {}
    for (const profile of profiles) {
      const key = profile.config.apiKey?.trim()
      if (key) {
        map[profile.id] = key
      }
    }
    if (Object.keys(map).length === 0) {
      window.sessionStorage.removeItem(MODEL_SESSION_KEYS_STORAGE_KEY)
    } else {
      window.sessionStorage.setItem(MODEL_SESSION_KEYS_STORAGE_KEY, JSON.stringify(map))
    }
  } catch {
    // Ignore when sessionStorage is unavailable
  }
}

/** Credentials remain in memory; only connection metadata and channel filters are persisted. */
export function serializeModelProfiles(profiles: AgentModelProfile[], activeId: string): string {
  return JSON.stringify({
    activeId,
    profiles: profiles.map(({ config, filter, ...profile }) => {
      const { apiKey: _apiKey, hasApiKey: _hasApiKey, ...metadata } = config
      return { ...profile, config: metadata, filter }
    }),
  })
}

export function parseModelProfiles(raw: string | null): { profiles: AgentModelProfile[]; activeId: string } | null {
  try {
    const data = JSON.parse(raw || 'null')
    if (!data || !Array.isArray(data.profiles) || !data.profiles.length) return null
    const ids = new Set<string>()
    const profiles: AgentModelProfile[] = data.profiles.map((item: AgentModelProfile) => {
      if (!item || typeof item.id !== 'string' || ids.has(item.id) || typeof item.name !== 'string') throw new Error('Invalid profile')
      ids.add(item.id)
      const config = item.config
      if (!config || !(config.provider in AGENT_PRESETS) || typeof config.model !== 'string') throw new Error('Invalid config')
      if (config.baseUrl !== undefined && typeof config.baseUrl !== 'string') throw new Error('Invalid endpoint')
      const filter =
        item.filter && Array.isArray(item.filter.whitelist) && Array.isArray(item.filter.blacklist)
          ? {
              whitelist: item.filter.whitelist.filter((s) => typeof s === 'string'),
              blacklist: item.filter.blacklist.filter((s) => typeof s === 'string'),
            }
          : undefined
      return {
        id: item.id,
        name: item.name,
        config: { ...config, apiKey: undefined, hasApiKey: false },
        filter,
        ...(typeof item.enabled === 'boolean' ? { enabled: item.enabled } : {}),
      }
    })
    return { profiles, activeId: profiles.some((profile) => profile.id === data.activeId) ? data.activeId : profiles[0].id }
  } catch {
    return null
  }
}
