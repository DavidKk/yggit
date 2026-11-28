import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { ROOT_PATH } from '@/constants/paths'
import { containsConflictMarkers, remergeHeaderPath } from '@/lib/git/conflict-regions'

const execFileAsync = promisify(execFile)
const CONFLICTS_DIR = path.join(ROOT_PATH, 'data', 'git-conflicts')

export interface MergeConflictRecord {
  hash: string
  hasConflict: boolean
  conflictCount?: number
  conflictFiles?: string[]
  unresolvedConflictFiles?: string[] | null
  conflictFileCounts?: Record<string, number | null>
  parent1?: string
  parent2?: string
  status: 'clean' | 'conflicted' | 'unsupported' | 'error'
  analyzedAt: number
}

function conflictsFile(repo: string): string {
  const id = createHash('sha1').update(repo).digest('hex').slice(0, 16)
  return path.join(CONFLICTS_DIR, `${id}.json`)
}

export function readCachedConflicts(repo: string): Record<string, MergeConflictRecord> {
  try {
    const file = conflictsFile(repo)
    if (!fs.existsSync(file)) return {}
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { repo?: string; conflicts?: Record<string, MergeConflictRecord> }
    return parsed?.conflicts && typeof parsed.conflicts === 'object' ? parsed.conflicts : {}
  } catch {
    return {}
  }
}

export function writeCachedConflicts(repo: string, conflicts: Record<string, MergeConflictRecord>): void {
  try {
    fs.mkdirSync(CONFLICTS_DIR, { recursive: true })
    const file = conflictsFile(repo)
    fs.writeFileSync(file, JSON.stringify({ repo, conflicts, updatedAt: Date.now() }), 'utf8')
  } catch {
    // Ignore cache write errors
  }
}

export function deleteCachedConflictsForRepo(repo: string): boolean {
  const target = repo.trim()
  if (!target) return false
  try {
    const file = conflictsFile(target)
    if (!fs.existsSync(file)) return false
    fs.unlinkSync(file)
    return true
  } catch {
    return false
  }
}

/**
 * Detects whether a historical merge commit encountered conflicts when originally merged.
 * Uses `git merge-tree --write-tree <p1> <p2>` in memory without modifying the working tree.
 */
export async function detectMergeConflict(repo: string, hash: string, parents: string[]): Promise<MergeConflictRecord> {
  if (!parents || parents.length < 2) {
    return {
      hash,
      hasConflict: false,
      status: 'clean',
      analyzedAt: Date.now(),
    }
  }

  const p1 = parents[0]
  const p2 = parents[1]

  try {
    // Modern Git >= 2.38
    await execFileAsync('git', ['-C', repo, '-c', 'core.quotePath=false', 'merge-tree', '--write-tree', p1, p2], {
      maxBuffer: 8 * 1024 * 1024,
      timeout: 10000,
      encoding: 'utf8',
    })

    // Exit code 0 means clean merge without conflicts
    return {
      hash,
      hasConflict: false,
      conflictFiles: [],
      conflictCount: 0,
      parent1: p1,
      parent2: p2,
      status: 'clean',
      analyzedAt: Date.now(),
    }
  } catch (error: unknown) {
    const err = error as { code?: number | string; stdout?: string; stderr?: string }
    const stdout = String(err?.stdout || '')
    const stderr = String(err?.stderr || '')
    const combined = `${stdout}\n${stderr}`

    // Parse conflicted file paths from git merge-tree output
    // Patterns include: "100644 <hash> <stage>\t<path>" and "CONFLICT (<type>): Merge conflict in <path>"
    const files = new Set<string>()
    for (const line of combined.split('\n')) {
      const matchTab = line.split('\t')
      if (matchTab.length >= 2 && /^\d{6}\s/.test(matchTab[0].trim())) {
        files.add(matchTab[1].trim())
      } else if (line.includes('冲突') && line.includes('于 ')) {
        const parts = line.split('于 ')
        if (parts.length >= 2) {
          files.add(parts[parts.length - 1].trim())
        }
      } else if (line.includes('CONFLICT (')) {
        const fileMatch = line.match(/in (.*?)$/)
        if (fileMatch?.[1]) files.add(fileMatch[1].trim())
      }
    }

    const conflictFiles = Array.from(files).filter(Boolean)
    const hasConflict = conflictFiles.length > 0
    const treeHash = stdout.split('\n')[0].trim()
    const conflictFileCounts: Record<string, number | null> = {}
    const unresolvedFiles: string[] = []
    let inspectionComplete = true
    // Conflict blobs contain one marker per textual conflict region. Structural
    // conflicts (binary, rename, deletion) count as one when no markers exist.
    for (const file of conflictFiles) {
      // Inspect the committed result, not the synthetic merge-tree conflict blob.
      try {
        const { stdout: entries } = await execFileAsync('git', ['-C', repo, 'ls-tree', '-z', hash, '--', file], { timeout: 10000 })
        if (entries) {
          const { stdout: content } = await execFileAsync('git', ['-C', repo, 'show', `${hash}:${file}`], {
            maxBuffer: 8 * 1024 * 1024,
            timeout: 10000,
            encoding: 'utf8',
          })
          if (containsConflictMarkers(content)) unresolvedFiles.push(file)
        }
      } catch {
        inspectionComplete = false
      }
      conflictFileCounts[file] = null
      if (!/^[a-f0-9]{40,64}$/.test(treeHash)) continue
      try {
        const { stdout: content } = await execFileAsync('git', ['-C', repo, 'show', `${treeHash}:${file}`], {
          maxBuffer: 8 * 1024 * 1024,
          timeout: 10000,
          encoding: 'utf8',
        })
        conflictFileCounts[file] = Math.max(1, content.match(/^<{7,} /gm)?.length ?? 0)
      } catch {
        // A deleted path has no blob in the merged tree; it is one structural conflict.
        try {
          await execFileAsync('git', ['-C', repo, 'cat-file', '-e', treeHash], { timeout: 10000 })
          const { stdout: entries } = await execFileAsync('git', ['-C', repo, 'ls-tree', '-z', treeHash, '--', file], { timeout: 10000 })
          if (!entries) conflictFileCounts[file] = 1
        } catch {
          // Leave unavailable counts unknown rather than inventing a region count.
        }
      }
    }

    return {
      hash,
      hasConflict,
      conflictFiles: conflictFiles.length > 0 ? conflictFiles : undefined,
      conflictCount: conflictFiles.length,
      conflictFileCounts,
      unresolvedConflictFiles: unresolvedFiles.length || inspectionComplete ? unresolvedFiles : null,
      parent1: p1,
      parent2: p2,
      status: hasConflict ? 'conflicted' : 'error',
      analyzedAt: Date.now(),
    }
  }
}

/**
 * Retrieves the remerge diff showing how conflicts were resolved by the author
 */
export async function getRemergeDiff(repo: string, hash: string): Promise<{ diff: string; files: string[] }> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repo, '-c', 'core.quotePath=false', 'show', '--format=', '--remerge-diff', '--patch', '--no-color', hash], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
      encoding: 'utf8',
    })

    const files: string[] = []
    const lines = stdout.split('\n')
    for (const line of lines) {
      const file = remergeHeaderPath(line)
      if (file && !files.includes(file)) files.push(file)
    }

    return { diff: stdout, files }
  } catch {
    return { diff: '', files: [] }
  }
}
