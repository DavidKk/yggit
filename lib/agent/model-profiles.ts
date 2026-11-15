import { AGENT_PRESETS, DEFAULT_AGENT_CONFIG, type EphemeralAgentConfig } from './types'

export interface AgentModelProfile {
  id: string
  name: string
  config: EphemeralAgentConfig
}

export const DEFAULT_MODEL_PROFILE: AgentModelProfile = {
  id: 'default',
  name: 'Vercel AI Gateway',
  config: DEFAULT_AGENT_CONFIG,
}

export const MODEL_PROFILES_STORAGE_KEY = 'yggit.agent.model-profiles.v1'

/** Credentials remain in memory; only connection metadata is persisted. */
export function serializeModelProfiles(profiles: AgentModelProfile[], activeId: string): string {
  return JSON.stringify({
    activeId,
    profiles: profiles.map(({ config, ...profile }) => {
      const { apiKey: _apiKey, ...metadata } = config
      return { ...profile, config: metadata }
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
      return { id: item.id, name: item.name, config: { ...config, apiKey: undefined } }
    })
    return { profiles, activeId: profiles.some((profile) => profile.id === data.activeId) ? data.activeId : profiles[0].id }
  } catch {
    return null
  }
}
