import { getCliAdapterForProvider, resolveCliBinary } from '@/lib/agent/cli-runner'
import { AGENT_PRESETS } from '@/lib/agent/types'

describe('agent cli-runner', () => {
  it('exposes official CLI presets for Claude, Codex, Antigravity, Cursor, and Gemini', () => {
    expect(getCliAdapterForProvider('claude-cli')).toBe('claude')
    expect(getCliAdapterForProvider('codex-cli')).toBe('codex')
    expect(getCliAdapterForProvider('antigravity-cli')).toBe('antigravity')
    expect(getCliAdapterForProvider('cursor-cli')).toBe('cursor')
    expect(getCliAdapterForProvider('gemini-cli')).toBe('gemini')
    expect(getCliAdapterForProvider('openai')).toBeNull()

    expect(AGENT_PRESETS['claude-cli'].isCli).toBe(true)
    expect(AGENT_PRESETS['antigravity-cli'].requiresKey).toBe(false)
  })

  it('resolves explicit CLI command overrides safely', () => {
    expect(resolveCliBinary('claude', 'claude')).toEqual({ command: 'claude', detected: true })
    expect(resolveCliBinary('antigravity', '/nonexistent/path/to/agy')).toEqual({
      command: '/nonexistent/path/to/agy',
      detected: false,
    })
  })
})
