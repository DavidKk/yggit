import { type Locale, LOCALES } from '@/lib/i18n/locales'
import { MESSAGES } from '@/lib/i18n/messages'

function collectLeafEntries(node: unknown, prefix = ''): Map<string, unknown> {
  const entries = new Map<string, unknown>()
  if (node == null || typeof node !== 'object' || Array.isArray(node)) {
    entries.set(prefix, node)
    return entries
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [childKey, childVal] of collectLeafEntries(v, path)) {
        entries.set(childKey, childVal)
      }
    } else {
      entries.set(path, v)
    }
  }
  return entries
}

function extractPlaceholders(value: string): string[] {
  const matches = value.match(/\{(\w+)\}/g) ?? []
  return [...new Set(matches)].sort()
}

const INTENTIONALLY_EMPTY_KEYS = new Set(['play.modeDynamicDesc', 'play.modeFixedDesc', 'play.modeTouchDesc', 'saves.auto.countUnit'])

const STATIC_EXAMPLE_PLACEHOLDER_KEYS = new Set(['translate.cacheOptimizeMissingHint'])

describe('i18n message completeness', () => {
  const referenceLocale: Locale = 'en'
  const referenceEntries = collectLeafEntries(MESSAGES[referenceLocale])
  const referenceKeys = [...referenceEntries.keys()].sort()

  it('all locales exist in MESSAGES', () => {
    for (const locale of LOCALES) {
      expect(MESSAGES[locale]).toBeDefined()
    }
  })

  it.each(LOCALES)('locale "%s" has the exact same keys as "en"', (locale) => {
    const entries = collectLeafEntries(MESSAGES[locale])
    const keys = [...entries.keys()].sort()

    const missingKeys = referenceKeys.filter((k) => !entries.has(k))
    const extraKeys = keys.filter((k) => !referenceEntries.has(k))

    expect({ missingKeys, extraKeys, count: keys.length, expectedCount: referenceKeys.length }).toEqual({
      missingKeys: [],
      extraKeys: [],
      count: referenceKeys.length,
      expectedCount: referenceKeys.length,
    })
  })

  it.each(LOCALES)('locale "%s" has non-empty string values and matching placeholders for all keys', (locale) => {
    const entries = collectLeafEntries(MESSAGES[locale])
    const emptyOrInvalidKeys: string[] = []
    const placeholderMismatches: Array<{ key: string; expected: string[]; actual: string[] }> = []

    for (const key of referenceKeys) {
      const value = entries.get(key)
      if (typeof value !== 'string') {
        emptyOrInvalidKeys.push(key)
        continue
      }
      if (value.trim().length === 0) {
        if (!INTENTIONALLY_EMPTY_KEYS.has(key)) {
          emptyOrInvalidKeys.push(key)
        }
        continue
      }
      if (STATIC_EXAMPLE_PLACEHOLDER_KEYS.has(key)) continue
      const refValue = referenceEntries.get(key)
      if (typeof refValue === 'string') {
        const expectedPlaceholders = extractPlaceholders(refValue)
        const actualPlaceholders = extractPlaceholders(value)
        if (JSON.stringify(expectedPlaceholders) !== JSON.stringify(actualPlaceholders)) {
          placeholderMismatches.push({
            key,
            expected: expectedPlaceholders,
            actual: actualPlaceholders,
          })
        }
      }
    }

    expect({ emptyOrInvalidKeys, placeholderMismatches }).toEqual({
      emptyOrInvalidKeys: [],
      placeholderMismatches: [],
    })
  })

  it.each(['zh', 'cht', 'ja', 'ko'] as const)('primary non-English locale "%s" has real localized landing translations', (locale) => {
    const entries = collectLeafEntries(MESSAGES[locale])
    const landingUntranslatedKeys: string[] = []

    const checkedPrefixes = ['landing.studio.', 'landing.hero.', 'landing.header.', 'landing.card.']
    for (const key of referenceKeys) {
      if (!checkedPrefixes.some((p) => key.startsWith(p))) continue
      const value = entries.get(key)
      const enValue = referenceEntries.get(key)
      if (typeof value === 'string' && typeof enValue === 'string') {
        if (/^(Git|Edge|Local|WebGL|60 FPS WebGL)$/i.test(enValue.trim())) continue
        if (value.trim() === enValue.trim()) {
          landingUntranslatedKeys.push(`${key} === "${enValue}"`)
        }
      }
    }

    expect(landingUntranslatedKeys).toEqual([])
  })
})
