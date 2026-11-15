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
