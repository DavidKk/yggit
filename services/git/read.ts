import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { promisify } from 'node:util'

import { ROOT_PATH } from '@/constants/paths'
import { GIT_LOG_PAGE_SIZE, normalizeRemote } from '@/lib/git/identity'
import { parseGitBranches, parseGitLog, parseGitRemotes, parseGitStashes, parseGitSubmodules, parseGitTags, parseGitWorktrees } from '@/lib/git/parse'
import type { GitCommit, GitLogView, GitWorktree } from '@/lib/git/types'

import { readBranchMarks } from './marks'
import { getProjectRemotes, listGitProjects, originUrl, rememberLocalProject, writeLastOpenedRepo } from './projects'
import { parseGitHubRepo, readRemoteGitLog } from './remote-provider'
import { resolveRepoSlug } from './resolver'

const execFileAsync = promisify(execFile)
const LOG_FORMAT = '%H%x1f%h%x1f%P%x1f%an%x1f%ad%x1f%D%x1f%s%x1e'

function gitFailure(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') return '未找到 git'
  const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: string }).stderr || '') : ''
  const message = (stderr || (error instanceof Error ? error.message : '')).trim()
  if (/not a git repository/i.test(message)) return '这个文件夹不是 Git 仓库'
  if (/No such file or directory|not a directory/i.test(message)) return '找不到这个文件夹'
  return message || 'git 失败'
}

async function git(repo: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repo, ...args], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 15000,
    encoding: 'utf8',
  })
  return stdout
}

async function gitOptional(repo: string, args: string[]): Promise<string> {
  try {
    return await git(repo, args)
  } catch {
    return ''
  }
}

function displayPath(repo: string): string {
  const home = os.homedir()
  if (repo === home) return '~'
  return repo.startsWith(`${home}/`) ? `~${repo.slice(home.length)}` : repo
}

export async function resolveGitRepo(input?: string): Promise<string> {
  const raw = (input || '').trim()
  if (raw) {
    try {
      return (await git(raw, ['rev-parse', '--show-toplevel'])).trim()
    } catch {
      // Check registered projects if input was a project name or ID
      const projects = listGitProjects()
      const match = projects.find((p) => p.name.toLowerCase() === raw.toLowerCase() || p.id.toLowerCase() === raw.toLowerCase())
      if (match?.localPath && fs.existsSync(match.localPath)) {
        try {
          return (await git(match.localPath, ['rev-parse', '--show-toplevel'])).trim()
        } catch {
          // Fall through
        }
      }

      // Check if input is a repo slug / URL / route path
      try {
        const cleanSlug = raw
          .replace(/^https?:\/\//, '')
          .replace(/\.git$/, '')
          .replace(/^\/git\//, '')
          .split('/')
        const { resolved } = resolveRepoSlug(cleanSlug)
        if (resolved.repoPathOrUrl && fs.existsSync(resolved.repoPathOrUrl)) {
          return (await git(resolved.repoPathOrUrl, ['rev-parse', '--show-toplevel'])).trim()
        }
      } catch {
        // Fall through
      }
    }
  }
  const fallback = (raw && fs.existsSync(raw) ? raw : '') || ROOT_PATH
  try {
    return (await git(fallback, ['rev-parse', '--show-toplevel'])).trim()
  } catch (error) {
    throw new Error(gitFailure(error))
  }
}

async function readHead(repo: string): Promise<string> {
  try {
    return (await git(repo, ['symbolic-ref', '--short', 'HEAD'])).trim()
  } catch {
    return ''
  }
}

function historyArgs(ref: string, skip: number, take: number = GIT_LOG_PAGE_SIZE): string[] {
  const requested = (ref || '').trim()
  if (requested.startsWith('-')) throw new Error('无效的引用')
  const isStash = /^(?:stash(?:@\{\d+\})?|refs\/stash)$/.test(requested)
  // `--all` also walks refs/stash, which draws the stash index and untracked commits as normal nodes.
  const branchRefs = ['--branches', '--tags', '--remotes', 'HEAD']
  // Keep branch tips visible when selecting a stash, including its base if the original branch was deleted.
  // Stashes are drawn separately; never walk their index or untracked parents as ordinary commits.
  const revisions = isStash ? [...branchRefs, `${requested}^1`] : !requested || requested === '*' ? branchRefs : [requested]
  const offset = Number.isFinite(skip) && skip > 0 ? Math.floor(skip) : 0
  const limit = Number.isFinite(take) && take > 0 ? Math.floor(take) : GIT_LOG_PAGE_SIZE
  return ['log', ...revisions, '--date-order', '-n', String(limit + 1), '--skip', String(offset), '--date=iso-strict', `--pretty=format:${LOG_FORMAT}`]
}

export async function readLogPage(repo: string, ref: string, skip: number, take: number = GIT_LOG_PAGE_SIZE): Promise<{ commits: GitCommit[]; hasMore: boolean }> {
  try {
    const text = await git(repo, historyArgs(ref, skip, take))
    const commits = parseGitLog(text)
    return { commits: commits.slice(0, take), hasMore: commits.length > take }
  } catch (error) {
    const message = gitFailure(error)
    if (message.includes('does not have any commits') || /bad revision|unknown revision|ambiguous argument/i.test(message)) return { commits: [], hasMore: false }
    throw new Error(message)
  }
}

export async function readFileHistory(options: { repo?: string; path: string; ref?: string; limit?: number }): Promise<{ commits: GitCommit[] }> {
  const repo = await resolveGitRepo(options.repo)
  const targetRef = options.ref && options.ref !== 'WORKTREE' ? options.ref : 'HEAD'
  const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 500) : 100
  try {
    const text = await git(repo, ['log', '--follow', '--date-order', '-n', String(limit), '--date=iso-strict', `--pretty=format:${LOG_FORMAT}`, targetRef, '--', options.path])
    let commits = parseGitLog(text)
    if (commits.length === 0 && targetRef !== 'HEAD') {
      try {
        const headText = await git(repo, ['log', '--follow', '--date-order', '-n', String(limit), '--date=iso-strict', `--pretty=format:${LOG_FORMAT}`, 'HEAD', '--', options.path])
        commits = parseGitLog(headText)
      } catch {
        // ignore fallback failure
      }
    }
    return { commits }
  } catch (error) {
    if (targetRef !== 'HEAD') {
      try {
        const headText = await git(repo, ['log', '--follow', '--date-order', '-n', String(limit), '--date=iso-strict', `--pretty=format:${LOG_FORMAT}`, 'HEAD', '--', options.path])
        return { commits: parseGitLog(headText) }
      } catch {
        // ignore
      }
    }
    const message = gitFailure(error)
    if (message.includes('does not have any commits') || /bad revision|unknown revision|ambiguous argument/i.test(message)) {
      return { commits: [] }
    }
    throw new Error(message)
  }
}

async function readWorktree(repo: string): Promise<GitWorktree | null> {
  let porcelain = ''
  try {
    porcelain = await git(repo, ['status', '--porcelain', '-uall'])
  } catch {
    return null
  }
  const files = porcelain
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false
      const pathPart = line.slice(3).trim().replace(/^"|"$/g, '')
      return !pathPart.endsWith('/')
    })
  if (files.length === 0) return null
  let addedFiles = 0
  let deletedFiles = 0
  let modifiedFiles = 0
  for (const line of files) {
    const status = line.slice(0, 2)
    if (status.includes('?') || status.includes('A')) addedFiles++
    else if (status.includes('D')) deletedFiles++
    else modifiedFiles++
  }
  let insertions = 0
  let deletions = 0
  try {
    const numstat = await git(repo, ['diff', '--numstat', 'HEAD'])
    for (const line of numstat.split('\n')) {
      const [added, removed] = line.split('\t')
      if (!added || added === '-' || removed === '-') continue
      insertions += Number(added) || 0
      deletions += Number(removed) || 0
    }
  } catch {
    /* 还没有 HEAD 时只计文件数 */
  }
  return { files: files.length, insertions, deletions, addedFiles, deletedFiles, modifiedFiles }
}

export async function locateCommitOffset(repo: string, ref: string, hash: string): Promise<number> {
  try {
    const requested = (ref || '').trim()
    const isStash = /^(?:stash(?:@\{\d+\})?|refs\/stash)$/.test(requested)
    const branchRefs = ['--branches', '--tags', '--remotes', 'HEAD']
    const revisions = isStash ? [...branchRefs, `${requested}^1`] : !requested || requested === '*' ? branchRefs : [requested]
    const text = await git(repo, ['log', ...revisions, '--date-order', '--format=%H'])
    const clean = hash.trim().toLowerCase()
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase()
      if (line === clean || (clean.length >= 7 && line.startsWith(clean))) {
        return i
      }
    }
    return -1
  } catch {
    return -1
  }
}

export async function readGitHistory(input: { repo?: string; ref?: string; skip?: number; take?: number; locate?: string }): Promise<{
  commits: GitCommit[]
  hasMore: boolean
  hasPrev?: boolean
  startIndex?: number
  locatedIndex?: number
}> {
  const repo = await resolveGitRepo(input.repo)
  const targetRef = (input.ref || '*').trim() || '*'

  if (input.locate) {
    const offset = await locateCommitOffset(repo, targetRef, input.locate)
    if (offset >= 0) {
      const take = input.take ?? GIT_LOG_PAGE_SIZE
      const half = Math.floor(take / 2)
      const startIndex = Math.max(0, offset - half)
      const page = await readLogPage(repo, targetRef, startIndex, take)
      return {
        commits: page.commits,
        hasMore: page.hasMore,
        hasPrev: startIndex > 0,
        startIndex,
        locatedIndex: offset,
      }
    }
  }

  const skip = input.skip ?? 0
  const take = input.take ?? GIT_LOG_PAGE_SIZE
  const page = await readLogPage(repo, targetRef, skip, take)
  return {
    commits: page.commits,
    hasMore: page.hasMore,
    hasPrev: skip > 0,
    startIndex: skip,
  }
}

export async function readGitLog(input?: { repo?: string; branch?: string; ref?: string; skip?: number }): Promise<GitLogView> {
  if (input?.repo && parseGitHubRepo(input.repo)) {
    return await readRemoteGitLog(input.repo, input.branch || input.ref, input.skip)
  }
  const repo = await resolveGitRepo(input?.repo)
  writeLastOpenedRepo(repo)
  const head = await readHead(repo)
  const historyRef = (input?.ref || input?.branch || '*').trim() || '*'
  let branchText = ''
  let remoteText = ''
  let tagText = ''
  let stashText = ''
  let worktreeText = ''
  let submoduleText = ''
  let page: { commits: GitCommit[]; hasMore: boolean } = { commits: [], hasMore: false }
  let status: GitWorktree | null = null
  let origin = ''
  let projectRemotes: Awaited<ReturnType<typeof getProjectRemotes>> = []
  try {
    ;[branchText, remoteText, tagText, stashText, worktreeText, submoduleText, page, status, origin, projectRemotes] = await Promise.all([
      git(repo, ['for-each-ref', 'refs/heads', '--format=%(refname:short)%00%(upstream:short)%00%(HEAD)%00%(objectname)%00%(upstream:track,nobracket)']),
      gitOptional(repo, ['for-each-ref', 'refs/remotes', '--format=%(refname:short)%00%(objectname)']),
      gitOptional(repo, ['for-each-ref', 'refs/tags', '--sort=-creatordate', '--format=%(refname:short)%00%(*objectname)%00%(objectname)']),
      gitOptional(repo, ['stash', 'list', '--format=%gd%x1f%H%x1f%P%x1f%cI%x1f%s']),
      gitOptional(repo, ['worktree', 'list', '--porcelain']),
      gitOptional(repo, ['submodule', 'status']),
      readLogPage(repo, historyRef, input?.skip ?? 0),
      readWorktree(repo),
      originUrl(repo),
      getProjectRemotes(repo),
    ])
  } catch (error) {
    throw new Error(gitFailure(error))
  }
  const remoteIdentity = normalizeRemote(origin)
  void rememberLocalProject(repo).catch(() => undefined)
  const branches = parseGitBranches(branchText)
  if (head && !branches.some((item) => item.name === head)) {
    branches.unshift({ name: head, upstream: '', current: true, tip: '' })
  }
  const requested = (input?.branch || '').trim()
  const branch = requested && branches.some((item) => item.name === requested) ? requested : head
  const worktrees = parseGitWorktrees(worktreeText).map((entry) => ({ ...entry, current: entry.path === repo }))
  return {
    repo,
    displayPath: displayPath(repo),
    remoteUrl: origin || undefined,
    remoteKey: remoteIdentity?.key || undefined,
    head,
    branch,
    branches,
    remotes: parseGitRemotes(remoteText),
    remoteSources: projectRemotes,
    tags: parseGitTags(tagText),
    stashes: parseGitStashes(stashText),
    worktrees,
    submodules: parseGitSubmodules(submoduleText, repo),
    commits: page.commits,
    hasMore: page.hasMore,
    marks: readBranchMarks(repo),
    worktree: status,
  }
}
