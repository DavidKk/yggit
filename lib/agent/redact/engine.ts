import { BUILTIN_REDACTION_RULES, isLikelyGitCommitHash } from './rules'
import type { RedactionOptions, RedactionResult, RedactionSession } from './types'

/**
 * Creates an empty in-memory redaction session.
 */
export function createRedactionSession(): RedactionSession {
  return {
    sessionId: Math.random().toString(36).slice(2, 10),
    placeholderToOriginal: new Map<string, string>(),
    originalToPlaceholder: new Map<string, string>(),
    counters: {},
  }
}

/**
 * Client-side Redaction Engine that scans and masks sensitive data with semantic placeholders.
 */
export class RedactionEngine {
  private session: RedactionSession
  private options: RedactionOptions

  constructor(options: RedactionOptions, session?: RedactionSession) {
    this.options = options
    this.session = session || createRedactionSession()
  }

  /**
   * Scans text and replaces sensitive tokens with structured placeholders.
   */
  public mask(text: string): RedactionResult {
    if (!this.options.enabled || !text) {
      return { sanitizedText: text, replacementsCount: 0 }
    }

    let sanitized = text
    let count = 0

    // 1. Scan built-in rules
    for (const rule of BUILTIN_REDACTION_RULES) {
      if (!rule.enabled || !this.options.categories[rule.category]) continue

      // Reset regex index before replacement
      rule.pattern.lastIndex = 0

      sanitized = sanitized.replace(rule.pattern, (match) => {
        // Protect Git commit hashes from false-positive secret masking
        if (rule.category === 'secrets' && isLikelyGitCommitHash(match)) {
          return match
        }

        // Check user allowlist
        if (this.options.allowList && this.options.allowList.includes(match)) {
          return match
        }

        count++
        return this.getOrCreatePlaceholder(rule.placeholderPrefix, match)
      })
    }

    // 2. Scan custom dictionary words
    if (this.options.categories.custom && this.options.customWords?.length > 0) {
      for (const item of this.options.customWords) {
        const word = item.word?.trim()
        if (!word) continue

        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const flag = item.caseSensitive ? 'g' : 'gi'
        const regex = item.wholeWord ? new RegExp(`\\b${escaped}\\b`, flag) : new RegExp(escaped, flag)

        sanitized = sanitized.replace(regex, (match) => {
          if (this.options.allowList && this.options.allowList.includes(match)) {
            return match
          }
          count++
          return this.getOrCreatePlaceholder('CUSTOM_TERM', match)
        })
      }
    }

    return {
      sanitizedText: sanitized,
      replacementsCount: count,
    }
  }

  /**
   * Gets or creates a stable placeholder for an original sensitive string.
   */
  private getOrCreatePlaceholder(prefix: string, original: string): string {
    if (this.session.originalToPlaceholder.has(original)) {
      return this.session.originalToPlaceholder.get(original)!
    }

    const currentCount = (this.session.counters[prefix] || 0) + 1
    this.session.counters[prefix] = currentCount
    const placeholder = `{{${prefix}_${currentCount}}}`

    this.session.placeholderToOriginal.set(placeholder, original)
    this.session.originalToPlaceholder.set(original, placeholder)
    return placeholder
  }

  /**
   * Returns the current redaction session.
   */
  public getSession(): RedactionSession {
    return this.session
  }
}
