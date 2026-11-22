/**
 * Deterministic fingerprint and hash helpers for Workdesk Findings.
 * Pure JavaScript with no Node-specific dependencies to ensure universal bundle compatibility.
 */

export interface FingerprintPayload {
  repoIdentity: string
  kind: string
  ruleId?: string
  targetRef?: string
  sources?: string[]
  scenarioId?: string
}

/**
 * Deterministic JSON stringifier with sorted object keys
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalizeJson(item)).join(',')}]`
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort()
  const keyValPairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson((obj as Record<string, unknown>)[key])}`)
  return `{${keyValPairs.join(',')}}`
}

/**
 * Deterministic 64-character hex hash generator
 */
function stableHash64(input: string): string {
  let s1 = 0x6a09e667
  let s2 = 0xbb67ae85
  let s3 = 0x3c6ef372
  let s4 = 0xa54ff53a

  for (let idx = 0; idx < input.length; idx++) {
    const code = input.charCodeAt(idx)
    s1 = Math.imul(s1 ^ code, 0x1000193)
    s2 = Math.imul(s2 ^ (code << 5), 0x811c9dc5)
    s3 = (s3 + code) ^ (s1 >>> 7)
    s4 = (s4 ^ code) + ((s2 << 11) | (s2 >>> 21))
  }

  const toHex = (num: number) => (num >>> 0).toString(16).padStart(8, '0')
  const p1 = toHex(s1)
  const p2 = toHex(s2)
  const p3 = toHex(s3)
  const p4 = toHex(s4)
  const p5 = toHex(s1 ^ s3)
  const p6 = toHex(s2 ^ s4)
  const p7 = toHex(s1 + s2)
  const p8 = toHex(s3 + s4)

  return `${p1}${p2}${p3}${p4}${p5}${p6}${p7}${p8}`
}

/**
 * Generate a stable 64-char fingerprint hash for a finding.
 */
export function generateFindingFingerprint(payload: FingerprintPayload): string {
  const normalized = {
    repo: (payload.repoIdentity || '').trim().toLowerCase(),
    kind: (payload.kind || '').trim(),
    ruleId: (payload.ruleId || '').trim(),
    targetRef: (payload.targetRef || '').trim(),
    sources: (payload.sources || []).map((s) => s.trim()).sort(),
    scenarioId: (payload.scenarioId || '').trim(),
  }
  const canonicalString = canonicalizeJson(normalized)
  return stableHash64(canonicalString)
}

/**
 * Universal async digest helper using WebCrypto when available, or synchronous fallback
 */
export async function computeSha256Digest(content: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return stableHash64(content)
}
