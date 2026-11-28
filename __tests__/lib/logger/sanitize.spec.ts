import { maskSensitiveTokens } from '@/lib/logger/sanitize'

describe('maskSensitiveTokens', () => {
  it('masks OpenAI, GitHub, GitLab, AWS, and Bearer tokens', () => {
    const sk = 'sk-' + 'abcdefghijklmnopqrstuvwxyz1234'
    const ghp = 'ghp_' + '1234567890abcdefghijklmnopqrstuvwxyz1234'
    const glpat = 'glpat-' + 'abcd1234efgh5678ijkl'

    expect(maskSensitiveTokens(`use ${sk}`)).toBe('use [MASKED_OPENAI_KEY]')
    expect(maskSensitiveTokens(`token=${ghp}`)).toBe('token=[MASKED_GH_TOKEN]')
    expect(maskSensitiveTokens(`gl: ${glpat}`)).toBe('gl: [MASKED_TOKEN]')
    expect(maskSensitiveTokens('Authorization: Bearer my_super_secret_token_9876')).toBe('Authorization: Bearer [MASKED_TOKEN]')
  })

  it('masks inline token assignments in user prompts and JSON', () => {
    expect(maskSensitiveTokens('我的 token 是 mysecretvalue123 请帮我查一下')).toBe('我的 token 是 [MASKED_TOKEN] 请帮我查一下')
    expect(maskSensitiveTokens('{"api_key":"secret_val_998877","branch":"main"}')).toBe('{"api_key":"[MASKED_TOKEN]","branch":"main"}')
  })

  it('preserves Git SHA hashes and Trace IDs', () => {
    const sha = '0dfe6b137e05a80a86010b536226a7a1b82d97bb'
    expect(maskSensitiveTokens(`commit ${sha} tr_abc123def456`)).toBe(`commit ${sha} tr_abc123def456`)
  })
})
