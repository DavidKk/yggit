import { BUILTIN_REDACTION_RULES, isLikelyGitCommitHash } from './rules'
import type { RedactionOptions, RedactionResult, RedactionSession } from './types'

/**
 * Safely checks if a token matches a wildcard pattern (* or ?).
 * Bounded length and strictly escaped to guarantee prevention of ReDoS or infinite loops.
 */
export function matchesWildcard(text: string, pattern: string): boolean {
  const trimmed = pattern.trim()
  if (!trimmed) return false

  // Disallow patterns containing only wildcards (*, ?) to avoid accidentally matching everything
  const nonWildcards = trimmed.replace(/[*?]/g, '')
  if (nonWildcards.length === 0) return false

  try {
    const regexStr = trimmed
      .replace(/[-[\]{}()+.,\\^$|#\s]/g, '\\$&')
      .replace(/\*/g, '[^\\s]{0,128}')
      .replace(/\?/g, '[^\\s]')
    const regex = new RegExp(`^${regexStr}$`, 'i')
    return regex.test(text)
  } catch {
    return false
  }
}

/**
 * Checks whether an extracted token is explicitly exempt from redaction via the allowlist.
 * Supports exact matching and bounded wildcards.
 */
export function isAllowed(token: string, allowList?: string[]): boolean {
  if (!allowList || allowList.length === 0) return false
  const lowerToken = token.toLowerCase()

  for (const item of allowList) {
    const trimmed = item.trim()
    if (!trimmed) continue

    if (!trimmed.includes('*') && !trimmed.includes('?')) {
      if (lowerToken === trimmed.toLowerCase()) return true
    } else if (matchesWildcard(token, trimmed)) {
      return true
    }
  }

  return false
}

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
        if (isAllowed(match, this.options.allowList)) {
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

        let regex: RegExp | null = null
        const flag = item.caseSensitive ? 'g' : 'gi'

        if (word.includes('*') || word.includes('?')) {
          const nonWildcards = word.replace(/[*?]/g, '')
          // Require at least 2 non-wildcard chars to avoid matching everything and prevent ReDoS
          if (nonWildcards.length < 2) continue

          try {
            const escaped = word
              .replace(/[-[\]{}()+.,\\^$|#\s]/g, '\\$&')
              .replace(/\*/g, '[\\w.-]{0,80}')
              .replace(/\?/g, '[\\w.-]')
            regex = new RegExp(item.wholeWord ? `\\b${escaped}\\b` : escaped, flag)
          } catch {
            continue
          }
        } else {
          const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          regex = item.wholeWord ? new RegExp(`\\b${escaped}\\b`, flag) : new RegExp(escaped, flag)
        }

        if (!regex) continue

        sanitized = sanitized.replace(regex, (match) => {
          if (isAllowed(match, this.options.allowList)) {
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
