import fs from 'node:fs'
import path from 'node:path'

const SKIP = new Set([
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

function isGitRoot(dir: string): boolean {
  try {
    const git = path.join(dir, '.git')
    const stat = fs.lstatSync(git)
    return stat.isDirectory() || stat.isFile()
  } catch {
    return false
  }
}

function listChildren(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (!entry.isDirectory() || entry.isSymbolicLink()) return []
      if (SKIP.has(entry.name) || entry.name.startsWith('.')) return []
      return [path.join(dir, entry.name)]
    })
  } catch {
    return []
  }
}

/** Walk selected folders and return unique Git worktree roots (has `.git`). */
export function discoverGitRepos(roots: string[], options?: { maxDepth?: number; maxRepos?: number }): string[] {
  const maxDepth = options?.maxDepth ?? 5
  const maxRepos = options?.maxRepos ?? 80
  const found = new Set<string>()
  const queue: Array<{ dir: string; depth: number }> = []

  for (const root of roots) {
    const absolute = path.resolve(root.trim())
    if (!absolute) continue
    try {
      if (!fs.statSync(absolute).isDirectory()) continue
    } catch {
      continue
    }
    queue.push({ dir: absolute, depth: 0 })
  }

  while (queue.length > 0 && found.size < maxRepos) {
    const next = queue.shift()
    if (!next) break
    if (isGitRoot(next.dir)) {
      found.add(next.dir)
      continue
    }
    if (next.depth >= maxDepth) continue
    for (const child of listChildren(next.dir)) {
      if (found.size >= maxRepos) break
      queue.push({ dir: child, depth: next.depth + 1 })
    }
  }

  return [...found].sort((left, right) => left.localeCompare(right))
}
