import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function getTempRoots(): string[] {
  const candidates = [os.tmpdir()]
  if (process.platform !== 'win32') {
    candidates.push('/tmp')
  }

  const roots = new Set<string>()
  for (const dir of candidates) {
    const resolved = path.resolve(dir)
    roots.add(resolved)
    try {
      roots.add(fs.realpathSync(resolved))
    } catch {
      // Ignore inaccessible candidate paths
    }
  }
  return Array.from(roots)
}

function isWithinRoot(target: string, root: string): boolean {
  return target === root || target.startsWith(`${root}${path.sep}`)
}

/**
 * Returns true when `repoPath` points inside the OS temporary directory.
 * Ephemeral E2E/test repos live under `os.tmpdir()` and must not be persisted
 * to the user's workspace catalog or conflict disk cache.
 */
export function isEphemeralRepoPath(repoPath?: string | null): boolean {
  const trimmed = repoPath?.trim()
  if (!trimmed) return false

  const tempRoots = getTempRoots()
  const resolved = path.resolve(trimmed)
  if (tempRoots.some((root) => isWithinRoot(resolved, root))) {
    return true
  }

  try {
    const real = fs.realpathSync(resolved)
    return tempRoots.some((root) => isWithinRoot(real, root))
  } catch {
    return false
  }
}
