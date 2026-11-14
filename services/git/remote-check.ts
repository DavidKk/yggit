import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { parseGitRemotes } from '@/lib/git/parse'
import type { GitRemoteCheck, GitRemoteProbe } from '@/lib/git/types'

import { resolveGitRepo } from './read'

const execFileAsync = promisify(execFile)

function gitFailure(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') return '未找到 git'
  const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: string }).stderr || '') : ''
  const message = (stderr || (error instanceof Error ? error.message : '')).trim()
  return message || 'git 失败'
}

async function git(repo: string, args: string[], timeout = 20000): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repo, ...args], {
    maxBuffer: 4 * 1024 * 1024,
    timeout,
    encoding: 'utf8',
  })
  return stdout
}

function parseLsRemoteHeads(raw: string, remote: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const tab = trimmed.indexOf('\t')
    if (tab < 0) continue
    const tip = trimmed.slice(0, tab)
    const ref = trimmed.slice(tab + 1)
    if (!ref.startsWith('refs/heads/') || !tip) continue
    const branch = ref.slice('refs/heads/'.length)
    if (!branch) continue
    map.set(`${remote}/${branch}`, tip)
  }
  return map
}

/** Compare remote tips via `git ls-remote` against local `refs/remotes/*` — no fetch. */
export async function checkGitRemotes(repoInput?: string): Promise<GitRemoteCheck> {
  const repo = await resolveGitRepo(repoInput)
  let remoteNames: string[] = []
  try {
    remoteNames = (await git(repo, ['remote'], 8000))
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  } catch (error) {
    throw new Error(gitFailure(error))
  }

  let localText = ''
  try {
    localText = await git(repo, ['for-each-ref', 'refs/remotes', '--format=%(refname:short)%00%(objectname)'], 8000)
  } catch {
    localText = ''
  }
  const local = new Map(parseGitRemotes(localText).map((item) => [item.name, item.tip]))

  const updates: GitRemoteProbe[] = []
  const errors: Array<{ remote: string; message: string }> = []

  await Promise.all(
    remoteNames.map(async (remote) => {
      try {
        const raw = await git(repo, ['ls-remote', '--heads', remote], 25000)
        const remoteTips = parseLsRemoteHeads(raw, remote)
        for (const [name, remoteTip] of remoteTips) {
          const slash = name.indexOf('/')
          const branch = slash >= 0 ? name.slice(slash + 1) : name
          const localTip = local.get(name) || ''
          if (!localTip) {
            updates.push({ remote, branch, name, localTip: '', remoteTip, status: 'new' })
            continue
          }
          if (localTip !== remoteTip) {
            updates.push({ remote, branch, name, localTip, remoteTip, status: 'ahead' })
          }
        }
      } catch (error) {
        errors.push({ remote, message: gitFailure(error) })
      }
    })
  )

  updates.sort((left, right) => left.name.localeCompare(right.name))
  return {
    checkedAt: new Date().toISOString(),
    remotes: remoteNames,
    updates,
    errors,
  }
}
