import { BUILTIN_REDACTION_RULES, isLikelyGitCommitHash } from '@/lib/agent/redact/rules'

const SECRET_RULES = BUILTIN_REDACTION_RULES.filter((rule) => rule.enabled && rule.category === 'secrets')

const EXTRA_TOKEN_PATTERNS: Array<{ pattern: RegExp; replace: (...args: string[]) => string }> = [
  // GitLab PATs, Google API keys, Slack tokens
  {
    pattern: /\b(?:glpat-[a-zA-Z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[0-9A-Za-z-]{10,})\b/g,
    replace: () => '[MASKED_TOKEN]',
  },
  // Generic Bearer / Basic authorization tokens (excluding already-masked placeholders)
  {
    pattern: /\b(Bearer\s+|Basic\s+)(?!\[MASKED)([A-Za-z0-9._~+/=-]{12,})/gi,
    replace: (_m, prefix) => `${prefix}[MASKED_TOKEN]`,
  },
  // HTTP/HTTPS URL basic-auth password portion
  {
    pattern: /(https?:\/\/[^:\s/@]+:)([^@\s/]+)(@)/gi,
    replace: (_m, before, _secret, after) => `${before}***${after}`,
  },
  // Inline token/apiKey/secret/password assignments across English, Chinese, and JSON key-value strings
  {
    pattern:
      /\b((?:access[_-]?token|refresh[_-]?token|api[_-]?key|secret[_-]?key|auth[_-]?token|bot[_-]?token|personal[_-]?token|client[_-]?secret|password|passwd|token)["'`]?\s*(?:=|:|是|为|\bis\b)\s*["'`]?)([^\s"'`,;)}\]]{8,})(["'`]?)/gi,
    replace: (match, prefix, secret, suffix) => {
      if (/^\[(?:MASKED|[A-Z_]+_\d+\]$)/.test(secret) || /^tr_[a-z0-9]+$/i.test(secret)) {
        return match
      }
      return `${prefix}[MASKED_TOKEN]${suffix}`
    },
  },
]

/**
 * Redact API keys, personal access tokens, bearer credentials, and inline secret assignments
 * before storing or rendering diagnostic logs and Agent traces.
 */
export function maskSensitiveTokens(text: string): string {
  if (!text) return ''
  let sanitized = text

  for (const rule of SECRET_RULES) {
    rule.pattern.lastIndex = 0
    sanitized = sanitized.replace(rule.pattern, (match) => {
      if (isLikelyGitCommitHash(match)) return match
      return `[MASKED_${rule.placeholderPrefix}]`
    })
  }

  for (const extra of EXTRA_TOKEN_PATTERNS) {
    extra.pattern.lastIndex = 0
    sanitized = sanitized.replace(extra.pattern, extra.replace)
  }

  return sanitized
}
