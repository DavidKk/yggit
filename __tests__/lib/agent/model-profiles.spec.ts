import { DEFAULT_MODEL_PROFILE, parseModelProfiles, serializeModelProfiles } from '@/lib/agent/model-profiles'

it('persists multiple model profiles and the selection without credentials', () => {
  const profiles = [
    DEFAULT_MODEL_PROFILE,
    { id: 'custom', name: 'Custom', config: { provider: 'byop' as const, model: 'custom-model', baseUrl: 'https://example.com/v1', apiKey: 'test-secret' } },
  ]
  const raw = serializeModelProfiles(profiles, 'custom')
  expect(raw).not.toContain('test-secret')
  expect(raw).not.toContain('apiKey')
  const restored = parseModelProfiles(raw)!
  expect(restored.activeId).toBe('custom')
  expect(restored.profiles).toHaveLength(2)
  expect(restored.profiles[1].config.apiKey).toBeUndefined()
})

it('persists channel-specific whitelist and blacklist with each profile', () => {
  const profiles = [
    {
      ...DEFAULT_MODEL_PROFILE,
      filter: { whitelist: ['gpt-*'], blacklist: ['*-mini'] },
    },
    {
      id: 'magpie',
      name: 'Magpie Gateway',
      config: { provider: 'magpie' as const, model: 'codex/gpt-6.1-sol', baseUrl: 'https://magpie.corp.com/v1', modelsEndpoint: '/codex/models' },
      filter: { whitelist: ['codex/*', 'workbuddy/*'], blacklist: ['workbuddy/legacy-*'] },
    },
  ]
  const raw = serializeModelProfiles(profiles, 'magpie')
  const restored = parseModelProfiles(raw)!
  expect(restored.activeId).toBe('magpie')
  expect(restored.profiles[0].filter?.whitelist).toEqual(['gpt-*'])
  expect(restored.profiles[0].filter?.blacklist).toEqual(['*-mini'])
  expect(restored.profiles[1].filter?.whitelist).toEqual(['codex/*', 'workbuddy/*'])
  expect(restored.profiles[1].filter?.blacklist).toEqual(['workbuddy/legacy-*'])
  expect(restored.profiles[1].config.modelsEndpoint).toBe('/codex/models')
})

it('ignores credentials injected into stored metadata and recovers a missing selection', () => {
  const restored = parseModelProfiles(
    JSON.stringify({ activeId: 'missing', profiles: [{ ...DEFAULT_MODEL_PROFILE, config: { ...DEFAULT_MODEL_PROFILE.config, apiKey: 'injected' } }] })
  )!
  expect(restored.activeId).toBe('default')
  expect(restored.profiles[0].config.apiKey).toBeUndefined()
})

it.each([
  'invalid',
  '{}',
  '{"profiles":[]}',
  JSON.stringify({ profiles: [{ ...DEFAULT_MODEL_PROFILE, config: { provider: 'unsupported' } }] }),
  JSON.stringify({ profiles: [DEFAULT_MODEL_PROFILE, DEFAULT_MODEL_PROFILE] }),
])('rejects malformed model settings: %s', (raw) => {
  expect(parseModelProfiles(raw)).toBeNull()
})
