const SKIP_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '.next',
  '.turbo',
  '.cache',
  'dist',
  'build',
  'out',
  'vendor',
  'target',
  'Pods',
  'DerivedData',
  '__pycache__',
  '.venv',
  'venv',
  'coverage',
  'Coverage',
])

export interface DiscoveredEdgeRepo {
  handle: FileSystemDirectoryHandle
  name: string
  relativePath: string
}

async function isGitDirectoryHandle(dirHandle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await dirHandle.getDirectoryHandle('.git')
    return true
  } catch {
    // Also support git worktree / submodule `.git` file
    try {
      await dirHandle.getFileHandle('.git')
      return true
    } catch {
      return false
    }
  }
}

/**
 * Recursively scan a picked FileSystemDirectoryHandle to discover all Git repository roots inside it.
 * If the picked directory itself is a Git repository, returns it directly without recursing into it.
 */
export async function discoverEdgeGitRepos(rootHandle: FileSystemDirectoryHandle, options?: { maxDepth?: number; maxRepos?: number }): Promise<DiscoveredEdgeRepo[]> {
  const maxDepth = options?.maxDepth ?? 5
  const maxRepos = options?.maxRepos ?? 80
  const found: DiscoveredEdgeRepo[] = []
  const queue: Array<{ handle: FileSystemDirectoryHandle; relPath: string; depth: number }> = [{ handle: rootHandle, relPath: rootHandle.name, depth: 0 }]

  while (queue.length > 0 && found.length < maxRepos) {
    const next = queue.shift()
    if (!next) break

    if (await isGitDirectoryHandle(next.handle)) {
      found.push({
        handle: next.handle,
        name: next.handle.name,
        relativePath: next.relPath,
      })
      continue
    }

    if (next.depth >= maxDepth) continue

    try {
      const iterable = next.handle as unknown as {
        values?: () => AsyncIterable<FileSystemHandle>
      }
      if (typeof iterable.values !== 'function') continue

      const children: Array<{ handle: FileSystemDirectoryHandle; name: string }> = []
      for await (const entry of iterable.values()) {
        if (entry.kind !== 'directory') continue
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        children.push({ handle: entry as FileSystemDirectoryHandle, name: entry.name })
      }
      children.sort((a, b) => a.name.localeCompare(b.name))

      for (const child of children) {
        if (found.length + queue.length >= maxRepos * 2) break
        queue.push({
          handle: child.handle,
          relPath: `${next.relPath}/${child.name}`,
          depth: next.depth + 1,
        })
      }
    } catch {
      // Ignore permission or read errors on individual subdirectories
    }
  }

  return found
}
