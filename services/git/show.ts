import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { GIT_WORKTREE_HASH, type GitCommitChanges, type GitFileChange } from '@/lib/git/types'

import { resolveGitRepo } from './read'

const execFileAsync = promisify(execFile)
const HASH = /^[0-9a-f]{7,64}$/i
const PATCH_LIMIT = 180_000
const STATUS = new Set(['A', 'M', 'D', 'R', 'C', 'T', 'U'])
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|avif)$/i

function gitFailure(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') return '未找到 git'
  const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: string }).stderr || '') : ''
  const message = (stderr || (error instanceof Error ? error.message : '')).trim()
  if (/bad object|bad revision|unknown revision|ambiguous argument/i.test(message)) return '找不到这次提交'
  return message || 'git 失败'
}

async function git(repo: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repo, ...args], {
    maxBuffer: 12 * 1024 * 1024,
    timeout: 20000,
    encoding: 'utf8',
  })
  return stdout
}

async function gitBuffer(repo: string, args: string[]): Promise<Buffer> {
  const { stdout } = await execFileAsync('git', ['-C', repo, ...args], {
    maxBuffer: 12 * 1024 * 1024,
    timeout: 20000,
    encoding: 'buffer',
  })
  return stdout as Buffer
}

function looksBinary(buf: Buffer): boolean {
  if (buf.includes(0)) return true
  const n = Math.min(buf.length, 8000)
  if (n === 0) return false
  let weird = 0
  for (let i = 0; i < n; i += 1) {
    const code = buf[i]
    if (code === 9 || code === 10 || code === 13) continue
    if (code < 32 || code === 127) weird += 1
  }
  return weird / n > 0.12
}

function parseNameStatus(text: string): GitFileChange[] {
  const files: GitFileChange[] = []
  for (const line of text.split('\n')) {
    if (!line.includes('\t')) continue
    const parts = line.split('\t')
    const code = parts[0]?.[0] || ''
    if (!STATUS.has(code) || !parts[1]) continue
    if ((code === 'R' || code === 'C') && parts[2]) files.push({ status: code, path: parts[2], oldPath: parts[1] })
    else files.push({ status: code, path: parts[1], oldPath: '' })
  }
  return files
}

function assertFilePath(input: string): string {
  const filePath = input.trim()
  if (!filePath || filePath.startsWith('-') || filePath.startsWith('/') || filePath.includes('\0') || filePath.split('/').includes('..')) {
    throw new Error('无效的文件')
  }
  return filePath
}

function parsePorcelain(text: string): GitFileChange[] {
  const files: GitFileChange[] = []
  const seen = new Set<string>()
  for (const raw of text.split('\n')) {
    if (raw.length < 4) continue
    const xy = raw.slice(0, 2)
    const rest = raw.slice(3)
    let oldPath = ''
    let filePath = rest
    if (rest.includes(' -> ')) {
      const parts = rest.split(' -> ')
      oldPath = parts[0] || ''
      filePath = parts[1] || parts[0] || ''
    }
    filePath = filePath.replace(/^"|"$/g, '').replace(/\\"/g, '"')
    oldPath = oldPath.replace(/^"|"$/g, '').replace(/\\"/g, '"')
    // Directory paths end with '/' (folders are not file changes)
    if (!filePath || filePath.endsWith('/') || seen.has(filePath)) continue
    seen.add(filePath)
    const isConflict = xy === 'UU' || xy === 'AA' || xy === 'DD' || xy === 'AU' || xy === 'UD' || xy === 'UA' || xy === 'DU'
    let status = 'M'
    if (isConflict) status = 'U'
    else if (xy === '??' || xy === 'A ' || xy === 'AM' || xy[0] === 'A' || xy[1] === 'A') status = 'A'
    else if (xy[0] === 'D' || xy[1] === 'D') status = 'D'
    else if (xy[0] === 'R' || xy[1] === 'R') status = 'R'
    else if (xy[0] === 'C' || xy[1] === 'C') status = 'C'

    const staged = !isConflict && xy[0] !== ' ' && xy[0] !== '?'
    const unstaged = isConflict || xy[1] !== ' ' || xy === '??'

    files.push({
      status,
      path: filePath,
      oldPath: status === 'R' || status === 'C' ? oldPath : '',
      staged,
      unstaged,
      conflict: isConflict,
    })
  }
  files.sort((left, right) => left.path.localeCompare(right.path))
  return files
}

async function readWorktreeChanges(repo: string, filesOnly: boolean, filePath: string, allFiles: boolean): Promise<GitCommitChanges> {
  const porcelain = await git(repo, ['status', '--porcelain', '-uall'])
  const changed = parsePorcelain(porcelain)
  const picked = filePath ? assertFilePath(filePath) : ''
  if (picked) {
    const entry = changed.find((file) => file.path === picked)
    const isUntracked = entry?.status === 'A' && !entry.oldPath
    const abs = path.join(repo, picked)
    const [patchText, disk] = await Promise.all([
      isUntracked ? Promise.resolve('') : git(repo, ['diff', 'HEAD', '--', picked]).catch(() => ''),
      readFile(abs)
        .then((buffer) => ({ buffer, missing: false as const }))
        .catch(() => ({ buffer: Buffer.alloc(0), missing: true as const })),
    ])
    let patch = patchText
    if (!patch && !disk.missing && entry?.status === 'A') {
      const text = looksBinary(disk.buffer) || IMAGE_EXT.test(picked) ? '' : disk.buffer.toString('utf8')
      if (text) {
        const lines = text.split('\n')
        patch = [
          `diff --git a/${picked} b/${picked}`,
          'new file mode 100644',
          `--- /dev/null`,
          `+++ b/${picked}`,
          `@@ -0,0 +1,${lines.length} @@`,
          ...lines.map((line) => `+${line}`),
        ].join('\n')
      }
    }
    const truncated = patch.length > PATCH_LIMIT
    const forceBinary = IMAGE_EXT.test(picked)
    const binary = disk.missing ? false : forceBinary || looksBinary(disk.buffer)
    const text = binary || disk.missing ? '' : disk.buffer.toString('utf8')
    const contentTruncated = !disk.missing && !binary && text.length > PATCH_LIMIT
    return {
      hash: GIT_WORKTREE_HASH,
      files: [],
      patch: truncated ? patch.slice(0, PATCH_LIMIT) : patch,
      truncated,
      content: disk.missing || binary ? undefined : contentTruncated ? text.slice(0, PATCH_LIMIT) : text,
      contentMissing: disk.missing,
      contentBinary: binary,
      contentTruncated,
    }
  }
  if (filesOnly) {
    if (!allFiles) return { hash: GIT_WORKTREE_HASH, files: changed, patch: '', truncated: false }
    // Working tree "all files" = changed set only (no full ls-files dump for dirty WIP).
    return { hash: GIT_WORKTREE_HASH, files: changed, patch: '', truncated: false }
  }
  return { hash: GIT_WORKTREE_HASH, files: changed, patch: '', truncated: false }
}

const commitChangesCache = new Map<string, GitCommitChanges>()
const inFlightCommitChanges = new Map<string, Promise<GitCommitChanges>>()
const MAX_SERVER_CACHE_SIZE = 300

export async function readCommitChanges(repoInput: string | undefined, hash: string, filesOnly = false, filePath = '', allFiles = false): Promise<GitCommitChanges> {
  const revision = hash.trim()
  const repo = await resolveGitRepo(repoInput)
  if (revision === GIT_WORKTREE_HASH) {
    try {
      return await readWorktreeChanges(repo, filesOnly, filePath, allFiles)
    } catch (error) {
      throw new Error(gitFailure(error))
    }
  }
  if (!HASH.test(revision)) throw new Error('无效的提交')
  const picked = filePath ? assertFilePath(filePath) : ''

  const cacheKey = `${repo}:${revision}:${filesOnly ? 1 : 0}:${picked}:${allFiles ? 1 : 0}`
  const cached = commitChangesCache.get(cacheKey)
  if (cached) return cached

  const inFlight = inFlightCommitChanges.get(cacheKey)
  if (inFlight) return inFlight

  const statusArgs = ['diff-tree', '--root', '--diff-merges=first-parent', '--no-commit-id', '--name-status', '-r', '--find-renames', revision]
  const task = (async () => {
    try {
      let result: GitCommitChanges
      if (picked) {
        const [patchText, blob] = await Promise.all([
          git(repo, ['show', '--format=', '--unified=3', '--diff-merges=first-parent', revision, '--', picked]),
          gitBuffer(repo, ['show', `${revision}:${picked}`]).then(
            (buffer) => ({ buffer, missing: false as const }),
            () => ({ buffer: Buffer.alloc(0), missing: true as const })
          ),
        ])
        const truncated = patchText.length > PATCH_LIMIT
        const forceBinary = IMAGE_EXT.test(picked)
        const binary = blob.missing ? false : forceBinary || looksBinary(blob.buffer)
        const text = binary || blob.missing ? '' : blob.buffer.toString('utf8')
        const contentTruncated = !blob.missing && !binary && text.length > PATCH_LIMIT
        result = {
          hash: revision,
          files: [],
          patch: truncated ? patchText.slice(0, PATCH_LIMIT) : patchText,
          truncated,
          content: blob.missing || binary ? undefined : contentTruncated ? text.slice(0, PATCH_LIMIT) : text,
          contentMissing: blob.missing,
          contentBinary: binary,
          contentTruncated,
        }
      } else if (filesOnly) {
        const statusText = await git(repo, statusArgs)
        const changed = parseNameStatus(statusText)
        if (!allFiles) {
          result = { hash: revision, files: changed, patch: '', truncated: false }
        } else {
          const treeText = await git(repo, ['ls-tree', '-r', '--name-only', revision])
          const byPath = new Map(changed.map((file) => [file.path, file]))
          const files: GitFileChange[] = treeText
            .split('\n')
            .map((path) => path.trim())
            .filter(Boolean)
            .map((path) => byPath.get(path) || { status: '', path, oldPath: '' })
          for (const file of changed) {
            if (file.status === 'D' && !files.some((item) => item.path === file.path)) files.push(file)
          }
          files.sort((left, right) => left.path.localeCompare(right.path))
          result = { hash: revision, files, patch: '', truncated: false }
        }
      } else {
        const [statusText, patchText] = await Promise.all([git(repo, statusArgs), git(repo, ['show', '--format=', '--unified=3', '--diff-merges=first-parent', revision])])
        const truncated = patchText.length > PATCH_LIMIT
        result = {
          hash: revision,
          files: parseNameStatus(statusText),
          patch: truncated ? patchText.slice(0, PATCH_LIMIT) : patchText,
          truncated,
        }
      }

      if (commitChangesCache.size >= MAX_SERVER_CACHE_SIZE) {
        const firstKey = commitChangesCache.keys().next().value
        if (firstKey) commitChangesCache.delete(firstKey)
      }
      commitChangesCache.set(cacheKey, result)
      return result
    } catch (error) {
      throw new Error(gitFailure(error))
    }
  })().finally(() => {
    inFlightCommitChanges.delete(cacheKey)
  })

  inFlightCommitChanges.set(cacheKey, task)
  return task
}
