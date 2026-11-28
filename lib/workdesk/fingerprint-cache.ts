import type { GitDriverMode } from '@/lib/git/driver'

export interface RepoProbeFingerprint {
  signature: string
  checkedAt: number
}

const STORAGE_KEY_PREFIX = 'yggit.workdesk.probe.v1.'
export const FINGERPRINT_FORCE_RECHECK_MS = 60 * 60 * 1000 // Force full check at most once per hour

export function loadProbeFingerprints(mode: GitDriverMode): Record<string, RepoProbeFingerprint> {
  if (typeof window === 'undefined' || !window.localStorage) return {}
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${mode}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, RepoProbeFingerprint>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveProbeFingerprints(mode: GitDriverMode, map: Record<string, RepoProbeFingerprint>): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${mode}`, JSON.stringify(map))
  } catch {
    // Ignore quota or storage errors
  }
}

async function readHandleModified(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  try {
    const fileHandle = await dir.getFileHandle(name)
    const file = await fileHandle.getFile()
    return `${name}:${file.lastModified}:${file.size}`
  } catch {
    return `${name}:0`
  }
}

/**
 * Compute a lightweight `.git/HEAD` + `.git/index` + `.git/packed-refs` signature for
 * an authorized Edge FileSystemDirectoryHandle without running isomorphic-git.
 */
export async function computeEdgeRepoSignature(repoId: string): Promise<string | null> {
  if (!repoId.startsWith('edge_')) return null
  try {
    const { getDirectoryHandle } = await import('@/lib/git/indexeddb-handles')
    const root = await getDirectoryHandle(repoId)
    if (!root) return null

    const gitDir = await root.getDirectoryHandle('.git')
    const parts = await Promise.all([readHandleModified(gitDir, 'HEAD'), readHandleModified(gitDir, 'index'), readHandleModified(gitDir, 'packed-refs')])

    try {
      const refsHeads = await gitDir.getDirectoryHandle('refs').then((r) => r.getDirectoryHandle('heads'))
      let refCount = 0
      let maxModified = 0
      const iter = (refsHeads as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()
      for await (const [, handle] of iter) {
        if (handle?.kind === 'file') {
          refCount += 1
          const f = await (handle as FileSystemFileHandle).getFile().catch(() => null)
          if (f && f.lastModified > maxModified) maxModified = f.lastModified
        }
        if (refCount >= 32) break
      }
      parts.push(`heads:${refCount}:${maxModified}`)
    } catch {
      parts.push('heads:0')
    }

    return parts.join('|')
  } catch {
    return null
  }
}
