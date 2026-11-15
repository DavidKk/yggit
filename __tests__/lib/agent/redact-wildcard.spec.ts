import { createRedactionSession, isAllowed, matchesWildcard, RedactionEngine, unmaskText } from '@/lib/agent/redact'

describe('Wildcard and ReDoS safety for Redaction', () => {
  describe('matchesWildcard', () => {
    it('matches valid wildcards safely', () => {
      expect(matchesWildcard('api.internal.net', '*.internal.net')).toBe(true)
      expect(matchesWildcard('db.sub.internal.net', '*.internal.net')).toBe(true)
      expect(matchesWildcard('external.com', '*.internal.net')).toBe(false)
      expect(matchesWildcard('test-1', 'test-?')).toBe(true)
      expect(matchesWildcard('test-12', 'test-?')).toBe(false)
    })

    it('rejects bare wildcard patterns to prevent unintended matching of all text', () => {
      expect(matchesWildcard('anything', '*')).toBe(false)
      expect(matchesWildcard('anything', '**')).toBe(false)
      expect(matchesWildcard('anything', '?')).toBe(false)
      expect(matchesWildcard('anything', '')).toBe(false)
    })
  })

  describe('isAllowed with wildcards', () => {
    it('allows tokens matching wildcard allowlist entries', () => {
      const allowList = ['public@example.com', '*.public.corp', 'safe-*']
      expect(isAllowed('public@example.com', allowList)).toBe(true)
      expect(isAllowed('api.public.corp', allowList)).toBe(true)
      expect(isAllowed('safe-key', allowList)).toBe(true)
      expect(isAllowed('danger-key', allowList)).toBe(false)
    })
  })

  describe('RedactionEngine with wildcard custom terms', () => {
    it('masks tokens matching wildcard custom terms and restores them via unmask', () => {
      const session = createRedactionSession()
      const engine = new RedactionEngine(
        {
          enabled: true,
          categories: { secrets: false, pii: false, network: false, custom: true },
          customWords: [
            { word: 'PROJ_*', caseSensitive: false, wholeWord: true },
            { word: 'secret_??', caseSensitive: false, wholeWord: true },
          ],
          allowList: ['PROJ_PUBLIC'],
        },
        session
      )

      const input = 'We are working on PROJ_TITANIUM and PROJ_ALPHA, but PROJ_PUBLIC is safe. Also secret_42 is hidden.'
      const { sanitizedText, replacementsCount } = engine.mask(input)

      expect(replacementsCount).toBe(3)
      expect(sanitizedText).not.toContain('PROJ_TITANIUM')
      expect(sanitizedText).not.toContain('PROJ_ALPHA')
      expect(sanitizedText).toContain('PROJ_PUBLIC') // exempt by allowlist
      expect(sanitizedText).not.toContain('secret_42')
      expect(sanitizedText).toContain('{{CUSTOM_TERM_1}}')
      expect(sanitizedText).toContain('{{CUSTOM_TERM_2}}')
      expect(sanitizedText).toContain('{{CUSTOM_TERM_3}}')

      const unmasked = unmaskText(sanitizedText, session)
      expect(unmasked).toBe(input)
    })

    it('ignores dangerously short wildcard patterns without crashing or looping', () => {
      const session = createRedactionSession()
      const engine = new RedactionEngine(
        {
          enabled: true,
          categories: { secrets: false, pii: false, network: false, custom: true },
          customWords: [
            { word: '*', caseSensitive: false, wholeWord: true },
            { word: 'a*', caseSensitive: false, wholeWord: true },
          ],
          allowList: [],
        },
        session
      )

      const input = 'Normal text without crashes'
      const { sanitizedText, replacementsCount } = engine.mask(input)
      expect(replacementsCount).toBe(0)
      expect(sanitizedText).toBe(input)
    })
  })
})
