import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { resolveGitRepo } from './read'

const execFileAsync = promisify(execFile)

async function git(repo: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repo, ...args], {
    maxBuffer: 16 * 1024 * 1024,
    timeout: 20000,
    encoding: 'utf8',
  })
  return stdout
}

export interface GitBlameLine {
  line: number
  hash: string
  author: string
  authorMail: string
  date: string
  summary: string
}

/**
 * Parses `git blame --line-porcelain` output into a map of line number to commit & author metadata.
 */
export function parseGitBlame(text: string): Record<number, GitBlameLine> {
  const map: Record<number, GitBlameLine> = {}
  if (!text) return map

  const lines = text.split('\n')
  let currentHash = ''
  let currentFinalLine = 0
  let currentAuthor = ''
  let currentMail = ''
  let currentTime = 0
  let currentSummary = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    // Start of a blame block: <hash> <orig-line> <final-line> [num-lines]
    if (/^[0-9a-f]{40}\s+\d+\s+\d+/.test(line)) {
      const parts = line.split(/\s+/)
      currentHash = parts[0]
      currentFinalLine = Number(parts[2]) || 0
      continue
    }

    if (line.startsWith('author ')) {
      currentAuthor = line.slice(7).trim()
    } else if (line.startsWith('author-mail ')) {
      currentMail = line.slice(12).replace(/[<>]/g, '').trim()
    } else if (line.startsWith('author-time ')) {
      currentTime = Number(line.slice(12).trim()) || 0
    } else if (line.startsWith('summary ')) {
      currentSummary = line.slice(8).trim()
    } else if (line.startsWith('\t')) {
      // Line content line ends the porcelain block for this line
      if (currentFinalLine > 0) {
        const dateStr = currentTime > 0 ? new Date(currentTime * 1000).toISOString() : ''
        map[currentFinalLine] = {
          line: currentFinalLine,
          hash: currentHash,
          author: currentAuthor || 'Unknown',
          authorMail: currentMail,
          date: dateStr,
          summary: currentSummary,
        }
      }
    }
  }

  return map
}

export async function readGitBlame(input: { repo?: string; path: string; hash?: string }): Promise<Record<number, GitBlameLine>> {
  const repo = await resolveGitRepo(input.repo)
  const filePath = input.path.trim()
  if (!filePath) return {}

  const hash = input.hash?.trim()
  const args = ['blame', '--line-porcelain']

  // If hash is specified and not WORKTREE, blame at that revision
  if (hash && hash !== 'WORKTREE' && hash !== 'HEAD') {
    args.push(hash, '--', filePath)
  } else {
    // For worktree / HEAD, blame current working copy or HEAD
    args.push('--', filePath)
  }

  try {
    const raw = await git(repo, args)
    return parseGitBlame(raw)
  } catch {
    // If working copy blame fails (e.g. untracked file), try HEAD fallback
    if (!hash || hash === 'WORKTREE') {
      try {
        const raw = await git(repo, ['blame', '--line-porcelain', 'HEAD', '--', filePath])
        return parseGitBlame(raw)
      } catch {
        return {}
      }
    }
    return {}
  }
}
