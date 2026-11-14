import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { ROOT_PATH } from '@/constants/paths'
import type { BranchMark } from '@/lib/git/types'

const MARKS_DIR = path.join(ROOT_PATH, 'data', 'git-marks')

function marksFile(repo: string): string {
  const id = createHash('sha1').update(repo).digest('hex').slice(0, 16)
  return path.join(MARKS_DIR, `${id}.json`)
}

export function readBranchMarks(repo: string): Record<string, BranchMark> {
  try {
    const parsed = JSON.parse(fs.readFileSync(marksFile(repo), 'utf8')) as { branches?: Record<string, BranchMark> }
    const branches = parsed.branches
    if (!branches || typeof branches !== 'object') return {}
    return branches
  } catch {
    return {}
  }
}

export function writeBranchMark(repo: string, branch: string, mark: BranchMark): Record<string, BranchMark> {
  const branches = readBranchMarks(repo)
  const direction = mark.direction.trim()
  const destination = mark.destination.trim()
  if (!direction && !destination) delete branches[branch]
  else branches[branch] = { direction, destination }
  fs.mkdirSync(MARKS_DIR, { recursive: true })
  fs.writeFileSync(marksFile(repo), JSON.stringify({ repo, branches }, null, 2))
  return branches
}
