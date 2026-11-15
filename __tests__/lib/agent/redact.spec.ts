import { createRedactionSession, RedactionEngine, StreamingUnmasker, unmaskText, unmaskToolArguments } from '@/lib/agent/redact'

describe('RedactionEngine and Unmasker', () => {
  const defaultOptions = {
    enabled: true,
    categories: {
      secrets: true,
      pii: true,
      network: true,
      custom: true,
    },
    customWords: [
      { word: 'ProjectTitanium', caseSensitive: true, wholeWord: true },
      { word: 'acme-corp', caseSensitive: false, wholeWord: false },
    ],
    allowList: ['public@example.com'],
  }

  it('masks API keys, DB connection strings, emails and private IPs', () => {
    const session = createRedactionSession()
    const engine = new RedactionEngine(defaultOptions, session)

    const raw = `
      Found OpenAI key: sk-abc123456789012345678901234567890
      GitHub: ghp_111122223333444455556666777788889999
      AWS: AKIAIOSFODNN7EXAMPLE
      Database: postgres://root:supersecret@10.0.1.5:5432/production
      Author: developer@internal.corp and allowed: public@example.com
      Codename: ProjectTitanium and acme-corp-client
    `

    const { sanitizedText, replacementsCount } = engine.mask(raw)

    expect(replacementsCount).toBeGreaterThanOrEqual(7)
    expect(sanitizedText).not.toContain('sk-abc1234567890')
    expect(sanitizedText).not.toContain('ghp_11112222')
    expect(sanitizedText).not.toContain('AKIAIOSFODNN7EXAMPLE')
    expect(sanitizedText).not.toContain('postgres://root:supersecret')
    expect(sanitizedText).not.toContain('developer@internal.corp')
    expect(sanitizedText).toContain('public@example.com') // Allowlist preserved
    expect(sanitizedText).not.toContain('ProjectTitanium')
    expect(sanitizedText).not.toContain('acme-corp')

    expect(sanitizedText).toContain('{{OPENAI_KEY_1}}')
    expect(sanitizedText).toContain('{{GH_TOKEN_1}}')
    expect(sanitizedText).toContain('{{AWS_KEY_1}}')
    expect(sanitizedText).toContain('{{DB_URI_1}}')
    expect(sanitizedText).toContain('{{USER_EMAIL_1}}')
    expect(sanitizedText).toContain('{{CUSTOM_TERM_1}}')

    // Test round-trip unmasking
    const unmasked = unmaskText(sanitizedText, session)
    expect(unmasked).toBe(raw)
  })

  it('protects Git commit hashes from false-positive secret masking', () => {
    const session = createRedactionSession()
    const engine = new RedactionEngine(defaultOptions, session)

    const commitHashes = 'Commit 7a88b1f and full sha 00c97f4f0dddd131472f815c36885b59a81cf8dc are unchanged'
    const { sanitizedText, replacementsCount } = engine.mask(commitHashes)

    expect(replacementsCount).toBe(0)
    expect(sanitizedText).toContain('7a88b1f')
    expect(sanitizedText).toContain('00c97f4f0dddd131472f815c36885b59a81cf8dc')
  })

  it('unmasks streaming chunks correctly when placeholder is split across boundaries', () => {
    const session = createRedactionSession()
    const engine = new RedactionEngine(defaultOptions, session)

    const input = 'Secret is sk-secret12345678901234567890'
    const { sanitizedText } = engine.mask(input)
    expect(sanitizedText).toBe('Secret is {{OPENAI_KEY_1}}')

    const unmasker = new StreamingUnmasker(session)

    // Simulate chunk 1 cutting right in the middle of "{{OPENAI_KEY_1}}"
    const chunk1 = 'Secret is {{OPENAI_'
    const chunk2 = 'KEY_1}} and done.'

    const out1 = unmasker.feed(chunk1)
    expect(out1).toBe('Secret is ') // Buffer holds incomplete placeholder

    const out2 = unmasker.feed(chunk2)
    expect(out2).toBe('sk-secret12345678901234567890 and done.')

    const final = unmasker.flush()
    expect(final).toBe('')
  })

  it('unmasks tool arguments recursively before local execution', () => {
    const session = createRedactionSession()
    const engine = new RedactionEngine(defaultOptions, session)

    const secretDb = 'postgres://admin:pass123@10.0.0.1:5432/db'
    const { sanitizedText } = engine.mask(secretDb)
    expect(sanitizedText).toBe('{{DB_URI_1}}')

    const maskedToolArgs = {
      query: '{{DB_URI_1}}',
      filters: {
        pattern: 'check {{DB_URI_1}}',
        targets: ['clean', '{{DB_URI_1}}'],
      },
      limit: 10,
    }

    const unmaskedArgs = unmaskToolArguments(maskedToolArgs, session)

    expect(unmaskedArgs.query).toBe(secretDb)
    expect((unmaskedArgs.filters as { pattern: string }).pattern).toBe(`check ${secretDb}`)
    expect((unmaskedArgs.filters as { targets: string[] }).targets[1]).toBe(secretDb)
    expect(unmaskedArgs.limit).toBe(10)
  })
})
