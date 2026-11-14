import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { GIT_WORKTREE_HASH } from '@/lib/git/types'

import { resolveGitRepo } from './read'

const execFileAsync = promisify(execFile)
const HASH = /^[0-9a-f]{7,64}$/i

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  md: 'text/markdown; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  mdx: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  ts: 'text/plain; charset=utf-8',
  tsx: 'text/plain; charset=utf-8',
  jsx: 'text/plain; charset=utf-8',
}

function gitFailure(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') return '未找到 git'
  const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: string }).stderr || '') : ''
  const message = (stderr || (error instanceof Error ? error.message : '')).trim()
  if (/bad object|bad revision|unknown revision|ambiguous argument|does not exist|exists on disk, but not in/i.test(message)) return '找不到这个文件'
  return message || 'git 失败'
}

function assertFilePath(input: string): string {
  const path = input.trim()
  if (!path || path.startsWith('-') || path.startsWith('/') || path.includes('\0') || path.split('/').includes('..')) throw new Error('无效的文件')
  return path
}

export function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return MIME[ext] || 'application/octet-stream'
}

export async function readGitBlob(input: { repo?: string; hash: string; path: string }): Promise<{ buffer: Buffer; contentType: string; path: string }> {
  const revision = input.hash.trim()
  const filePath = assertFilePath(input.path)
  const repo = await resolveGitRepo(input.repo)
  if (revision === GIT_WORKTREE_HASH) {
    try {
      const buffer = await readFile(path.join(repo, filePath))
      return { buffer, contentType: mimeFromPath(filePath), path: filePath }
    } catch {
      throw new Error('找不到这个文件')
    }
  }
  if (!HASH.test(revision)) throw new Error('无效的提交')
  try {
    const { stdout } = await execFileAsync('git', ['-C', repo, 'show', `${revision}:${filePath}`], {
      encoding: 'buffer',
      maxBuffer: 12 * 1024 * 1024,
      timeout: 20000,
    })
    return { buffer: stdout as Buffer, contentType: mimeFromPath(filePath), path: filePath }
  } catch (error) {
    throw new Error(gitFailure(error))
  }
}
