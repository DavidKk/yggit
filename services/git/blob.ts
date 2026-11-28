import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { looksBinaryBuffer } from '@/lib/git/binary'
import { GIT_WORKTREE_HASH } from '@/lib/git/types'

import { resolveGitRepo } from './read'
import { parseGitHubRepo, readRemoteBlobData } from './remote-provider'

const execFileAsync = promisify(execFile)
const HASH = /^[0-9a-f]{7,64}$/i
const BINARY_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|avif|pdf|zip|gz|tar|wasm|woff2?|ttf|eot|mp3|mp4|mov|webm)$/i

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
  mjs: 'text/javascript; charset=utf-8',
  cjs: 'text/javascript; charset=utf-8',
  ts: 'text/plain; charset=utf-8',
  tsx: 'text/plain; charset=utf-8',
  jsx: 'text/plain; charset=utf-8',
  go: 'text/plain; charset=utf-8',
  mod: 'text/plain; charset=utf-8',
  sum: 'text/plain; charset=utf-8',
  yaml: 'text/plain; charset=utf-8',
  yml: 'text/plain; charset=utf-8',
  toml: 'text/plain; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  sh: 'text/plain; charset=utf-8',
  py: 'text/plain; charset=utf-8',
  rs: 'text/plain; charset=utf-8',
  sql: 'text/plain; charset=utf-8',
}

function isBinaryBlob(filePath: string, buffer: Uint8Array): boolean {
  if (BINARY_EXT.test(filePath)) return true
  return looksBinaryBuffer(buffer)
}

function resolveBlobMeta(filePath: string, buffer: Uint8Array): { contentType: string; binary: boolean } {
  const binary = isBinaryBlob(filePath, buffer)
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  if (MIME[ext]) return { contentType: MIME[ext], binary }
  return {
    contentType: binary ? 'application/octet-stream' : 'text/plain; charset=utf-8',
    binary,
  }
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

export async function readGitBlob(input: { repo?: string; hash: string; path: string }): Promise<{ buffer: Buffer; contentType: string; path: string; binary: boolean }> {
  const revision = input.hash.trim()
  const filePath = assertFilePath(input.path)
  if (input.repo && parseGitHubRepo(input.repo)) {
    const blob = await readRemoteBlobData(input.repo, revision, filePath)
    const buffer = Buffer.from(blob.bytes)
    return { buffer, ...resolveBlobMeta(filePath, buffer), path: filePath }
  }
  const repo = await resolveGitRepo(input.repo)
  if (revision === GIT_WORKTREE_HASH) {
    try {
      const buffer = await readFile(path.join(repo, filePath))
      return { buffer, ...resolveBlobMeta(filePath, buffer), path: filePath }
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
    const buffer = stdout as Buffer
    return { buffer, ...resolveBlobMeta(filePath, buffer), path: filePath }
  } catch (error) {
    throw new Error(gitFailure(error))
  }
}
