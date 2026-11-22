/**
 * Portable Check (Recipe Sharing & URL Hash Protocol).
 * Adheres to docs/technical/yggit-workdesk-architecture.md §7
 */

import { gunzipSync, gzipSync } from 'fflate'

import { remoteIdentity } from '@/lib/git/project-access'
import type { GitProjectView } from '@/lib/git/types'
import { generateFindingFingerprint } from '@/lib/workdesk/fingerprint'
import type { CheckRecipe, RepoMatchResult } from '@/lib/workdesk/types'

const MAX_REPOSITORIES = 30
const MAX_CHECKS = 100

/**
 * Base64URL encode a Uint8Array
 */
function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Base64URL decode to Uint8Array
 */
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binary = typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Calculate SHA-256 identity digest for a remote URL using synchronous fingerprint
 */
export function computeRemoteIdentityDigest(url: string): string {
  const identity = remoteIdentity(url)
  if (!identity) return ''
  return generateFindingFingerprint({
    repoIdentity: identity,
    kind: 'repo-identity',
  })
}

/**
 * Validate recipe JSON against strict security rules
 */
export function validateCheckRecipe(data: unknown): CheckRecipe {
  if (!data || typeof data !== 'object') {
    throw new Error('配方数据必须为有效的 JSON 对象')
  }

  const recipe = data as Partial<CheckRecipe>
  if (recipe.version !== 1) {
    throw new Error('不支持的配方版本 (仅支持 version: 1)')
  }

  if (!Array.isArray(recipe.repositories) || recipe.repositories.length === 0) {
    throw new Error('配方必须包含至少一个仓库定义')
  }

  if (recipe.repositories.length > MAX_REPOSITORIES) {
    throw new Error(`仓库数量超过上限 (${recipe.repositories.length} > ${MAX_REPOSITORIES})`)
  }

  for (const repo of recipe.repositories) {
    if (!repo || typeof repo !== 'object' || typeof repo.identityDigest !== 'string') {
      throw new Error('仓库条目缺少 identityDigest 属性')
    }
  }

  if (!Array.isArray(recipe.checks) || recipe.checks.length === 0) {
    throw new Error('配方必须包含至少一个检查规则')
  }

  if (recipe.checks.length > MAX_CHECKS) {
    throw new Error(`检查规则数量超过上限 (${recipe.checks.length} > ${MAX_CHECKS})`)
  }

  const validTypes = new Set(['sync', 'merge', 'review'])
  for (const check of recipe.checks) {
    if (!check || typeof check !== 'object') {
      throw new Error('无效的检查条目')
    }
    if (typeof check.repoIdentityDigest !== 'string') {
      throw new Error('检查条目缺少 repoIdentityDigest 引用')
    }
    if (!validTypes.has(check.type)) {
      throw new Error(`不支持的检查类型: ${check.type}`)
    }
  }

  return recipe as CheckRecipe
}

/**
 * Encode CheckRecipe to compressed Base64URL string for URL hash (#data=...)
 */
export function encodeRecipeToUrlHash(recipe: CheckRecipe): string {
  const validated = validateCheckRecipe(recipe)
  const jsonStr = JSON.stringify(validated)
  const encodedBytes = new TextEncoder().encode(jsonStr)
  const compressed = gzipSync(encodedBytes)
  return uint8ArrayToBase64Url(compressed)
}

/**
 * Decode and validate URL hash (#data=...) or raw Base64URL payload back to CheckRecipe
 */
export function decodeRecipeFromUrlHash(hashOrString: string): CheckRecipe {
  let cleaned = hashOrString.trim()
  if (cleaned.startsWith('#')) {
    cleaned = cleaned.slice(1)
  }
  if (cleaned.startsWith('data=')) {
    cleaned = cleaned.slice(5)
  }
  if (!cleaned) {
    throw new Error('分享链接缺少检查配方载荷')
  }

  const compressed = base64UrlToUint8Array(cleaned)
  let decompressed: Uint8Array
  try {
    decompressed = gunzipSync(compressed)
  } catch {
    // If not gzipped, try raw JSON string
    decompressed = compressed
  }

  const jsonStr = new TextDecoder().decode(decompressed)
  const parsed = JSON.parse(jsonStr)
  return validateCheckRecipe(parsed)
}

/**
 * Match recipe repositories against local registered projects
 */
export function matchRecipeWithLocalProjects(recipe: CheckRecipe, localProjects: GitProjectView[]): RepoMatchResult[] {
  // Pre-calculate digests for each local project
  const projectWithDigests = localProjects.map((proj) => {
    // Try httpsUrl, remotes, or name
    const digests: string[] = []
    if (proj.httpsUrl) {
      const d = computeRemoteIdentityDigest(proj.httpsUrl)
      if (d) digests.push(d)
    }
    if (proj.remotes) {
      for (const r of proj.remotes) {
        if (r.url) {
          const d = computeRemoteIdentityDigest(r.url)
          if (d && !digests.includes(d)) digests.push(d)
        }
      }
    }
    return {
      project: {
        id: proj.id,
        name: proj.name,
        localPath: proj.localPath,
        httpsUrl: proj.httpsUrl,
      },
      digests,
    }
  })

  return recipe.repositories.map((repoReq, index) => {
    const targetDigest = repoReq.identityDigest
    const candidates = projectWithDigests.filter((p) => p.digests.includes(targetDigest)).map((p) => p.project)

    if (candidates.length === 1) {
      return {
        index,
        identityDigest: targetDigest,
        matchedProject: candidates[0],
        status: 'matched' as const,
      }
    }
    if (candidates.length > 1) {
      return {
        index,
        identityDigest: targetDigest,
        candidateProjects: candidates,
        status: 'multiple' as const,
      }
    }
    return {
      index,
      identityDigest: targetDigest,
      status: 'unmatched' as const,
    }
  })
}
