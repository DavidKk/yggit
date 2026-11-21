import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { cleanGitMessage } from '@/lib/git/clean-git-message'

import { resolveGitRepo } from './read'

const execFileAsync = promisify(execFile)

async function runGit(repo: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', ['-C', repo, ...args], {
      maxBuffer: 8 * 1024 * 1024,
      timeout: 30000,
      encoding: 'utf8',
    })
    return { stdout: stdout.trim(), stderr: stderr.trim() }
  } catch (error: unknown) {
    const err = error as { stderr?: string; stdout?: string; message?: string }
    const message = (err?.stderr || err?.stdout || err?.message || 'Git 操作失败').toString().trim()
    throw new Error(message)
  }
}

export async function gitCheckout(
  repoInput: string,
  branch: string,
  options?: { create?: boolean; startPoint?: string; track?: boolean }
): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const args: string[] = ['checkout']

  if (options?.create) {
    args.push('-b', branch)
    if (options.startPoint) args.push(options.startPoint)
  } else if (options?.track) {
    // Remote branch tracking checkout
    args.push('--track', branch)
  } else {
    args.push(branch)
  }

  const { stdout, stderr } = await runGit(repo, args)
  return { ok: true, message: stdout || stderr || `已切换到分支 ${branch}` }
}

export async function gitCreateBranch(repoInput: string, branch: string, startPoint?: string, checkout = true): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  if (checkout) {
    const args = ['checkout', '-b', branch]
    if (startPoint) args.push(startPoint)
    const { stdout, stderr } = await runGit(repo, args)
    return { ok: true, message: stdout || stderr || `已创建并检出分支 ${branch}` }
  }

  const args = ['branch', branch]
  if (startPoint) args.push(startPoint)
  const { stdout, stderr } = await runGit(repo, args)
  return { ok: true, message: stdout || stderr || `已创建分支 ${branch}` }
}

export async function gitDeleteBranch(repoInput: string, branch: string, force = false): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const args = ['branch', force ? '-D' : '-d', branch]
  const { stdout, stderr } = await runGit(repo, args)
  return { ok: true, message: stdout || stderr || `已删除分支 ${branch}` }
}

export async function gitRenameBranch(repoInput: string, oldName: string, newName: string): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const args = oldName ? ['branch', '-m', oldName, newName] : ['branch', '-m', newName]
  const { stdout, stderr } = await runGit(repo, args)
  return { ok: true, message: stdout || stderr || `已重命名分支为 ${newName}` }
}

export async function gitMergeBranch(repoInput: string, branch: string): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
  const repo = await resolveGitRepo(repoInput)
  const args = ['merge', branch]
  try {
    const { stdout, stderr } = await runGit(repo, args)
    return { ok: true, message: stdout || stderr || `已合并分支 ${branch}`, conflict: false }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('CONFLICT') || msg.includes('conflict')) {
      return { ok: false, message: msg, conflict: true }
    }
    throw err
  }
}

export async function gitRebaseBranch(
  repoInput: string,
  branch: string,
  options?: { abort?: boolean; continue?: boolean }
): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
  const repo = await resolveGitRepo(repoInput)
  if (options?.abort) {
    await runGit(repo, ['rebase', '--abort'])
    return { ok: true, message: '已中止变基 (Rebase Aborted)', conflict: false }
  }
  if (options?.continue) {
    try {
      const { stdout, stderr } = await runGit(repo, ['rebase', '--continue'])
      return { ok: true, message: stdout || stderr || '已继续变基', conflict: false }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('CONFLICT') || msg.includes('conflict')) {
        return { ok: false, message: msg, conflict: true }
      }
      throw err
    }
  }
  const args = ['rebase', branch]
  try {
    const { stdout, stderr } = await runGit(repo, args)
    return { ok: true, message: stdout || stderr || `已将当前分支变基到 ${branch}`, conflict: false }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('CONFLICT') || msg.includes('conflict')) {
      return { ok: false, message: msg, conflict: true }
    }
    throw err
  }
}

export async function gitCherryPick(
  repoInput: string,
  hash: string,
  options?: { abort?: boolean; continue?: boolean }
): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
  const repo = await resolveGitRepo(repoInput)
  if (options?.abort) {
    await runGit(repo, ['cherry-pick', '--abort'])
    return { ok: true, message: '已中止遴选 (Cherry-pick Aborted)', conflict: false }
  }
  if (options?.continue) {
    try {
      const { stdout, stderr } = await runGit(repo, ['cherry-pick', '--continue'])
      return { ok: true, message: stdout || stderr || '已继续遴选', conflict: false }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('CONFLICT') || msg.includes('conflict')) {
        return { ok: false, message: msg, conflict: true }
      }
      throw err
    }
  }
  const args = ['cherry-pick', hash]
  try {
    const { stdout, stderr } = await runGit(repo, args)
    return { ok: true, message: stdout || stderr || `已成功遴选提交 ${hash.slice(0, 7)}`, conflict: false }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('CONFLICT') || msg.includes('conflict')) {
      return { ok: false, message: msg, conflict: true }
    }
    throw err
  }
}

export async function gitStage(repoInput: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  if (all || !files || files.length === 0) {
    await runGit(repo, ['add', '-A'])
    return { ok: true, message: '已暂存全部更改' }
  }

  await runGit(repo, ['add', '--', ...files])
  return { ok: true, message: `已暂存 ${files.length} 个文件` }
}

export async function gitUnstage(repoInput: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  if (all || !files || files.length === 0) {
    await runGit(repo, ['reset', 'HEAD'])
    return { ok: true, message: '已取消全部暂存' }
  }

  await runGit(repo, ['reset', 'HEAD', '--', ...files])
  return { ok: true, message: `已取消暂存 ${files.length} 个文件` }
}

export async function gitDiscard(repoInput: string, files?: string[], all = false): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  if (all || !files || files.length === 0) {
    await runGit(repo, ['restore', '.']).catch(() => runGit(repo, ['checkout', '--', '.']))
    await runGit(repo, ['clean', '-fd'])
    return { ok: true, message: '已撤销所有未提交更改' }
  }

  // Restore tracked files, clean untracked files
  try {
    await runGit(repo, ['restore', '--', ...files])
  } catch {
    await runGit(repo, ['checkout', '--', ...files]).catch(() => null)
  }
  await runGit(repo, ['clean', '-fd', '--', ...files]).catch(() => null)
  return { ok: true, message: `已撤销 ${files.length} 个文件的更改` }
}

export interface GitCommitExecOptions {
  stageAll?: boolean
  amend?: boolean
  noVerify?: boolean
  pushAfter?: boolean
}

export async function gitCommit(repoInput: string, message: string, options?: boolean | GitCommitExecOptions): Promise<{ ok: boolean; message: string; hash?: string }> {
  const repo = await resolveGitRepo(repoInput)
  const trimmed = message.trim()
  if (!trimmed) throw new Error('提交信息不能为空')

  const opts: GitCommitExecOptions = typeof options === 'boolean' ? { stageAll: options } : options || {}

  if (opts.stageAll) {
    await runGit(repo, ['add', '-A'])
  }

  const args = ['commit']
  if (opts.amend) {
    args.push('--amend')
  }
  if (opts.noVerify) {
    args.push('--no-verify')
  }
  args.push('-m', trimmed)

  const { stdout, stderr } = await runGit(repo, args)
  let hash = ''
  try {
    const rev = await runGit(repo, ['rev-parse', 'HEAD'])
    hash = rev.stdout.trim()
  } catch {
    // Ignore
  }

  let pushMsg = ''
  if (opts.pushAfter) {
    try {
      const pushRes = await gitPush(repoInput)
      pushMsg = `，${pushRes.message}`
    } catch (e) {
      pushMsg = `，但推送失败: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  return { ok: true, message: (stdout || stderr || '提交成功') + pushMsg, hash }
}

export async function gitUndoLastCommit(repoInput: string, soft = true): Promise<{ ok: boolean; message: string; undoneHash?: string }> {
  const repo = await resolveGitRepo(repoInput)
  try {
    const headRes = await runGit(repo, ['rev-parse', 'HEAD'])
    const headHash = headRes.stdout.trim()
    await runGit(repo, ['rev-parse', 'HEAD~1'])

    // Save undone commit into a dedicated local ref so redo is always accurate
    try {
      await runGit(repo, ['update-ref', 'refs/yggit/last_undone_head', headHash])
    } catch {
      // Ignore
    }

    const args = ['reset', soft ? '--soft' : '--mixed', 'HEAD~1']
    await runGit(repo, args)
    return {
      ok: true,
      message: soft ? '已撤销上一次提交并保留在暂存区' : '已撤销上一次提交并保留在工作区',
      undoneHash: headHash,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('unknown revision') || msg.includes('HEAD~1')) {
      throw new Error('当前已经是初始提交，无法撤销 (Initial commit cannot be undone)')
    }
    throw error
  }
}

export async function gitRedoCommit(repoInput: string, soft = true): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  let targetRef = ''
  try {
    const res = await runGit(repo, ['rev-parse', '--verify', 'refs/yggit/last_undone_head'])
    targetRef = res.stdout.trim()
  } catch {
    try {
      const origRes = await runGit(repo, ['rev-parse', '--verify', 'ORIG_HEAD'])
      targetRef = origRes.stdout.trim()
    } catch {
      throw new Error('暂无可重做的提交 (No commit available to redo)')
    }
  }

  if (!targetRef) {
    throw new Error('暂无可重做的提交 (No commit available to redo)')
  }

  const args = ['reset', soft ? '--soft' : '--mixed', targetRef]
  const { stdout, stderr } = await runGit(repo, args)
  try {
    await runGit(repo, ['update-ref', '-d', 'refs/yggit/last_undone_head'])
  } catch {
    // Ignore
  }
  return { ok: true, message: stdout || stderr || '已恢复撤销的提交' }
}

export async function gitGetLastCommitMessage(repoInput: string): Promise<{ summary: string; description: string }> {
  const repo = await resolveGitRepo(repoInput)
  try {
    const { stdout } = await runGit(repo, ['log', '-1', '--pretty=format:%B'])
    const text = stdout.trim()
    const firstNewline = text.indexOf('\n')
    if (firstNewline === -1) {
      return { summary: text, description: '' }
    }
    const summary = text.slice(0, firstNewline).trim()
    const description = text.slice(firstNewline).trim()
    return { summary, description }
  } catch {
    return { summary: '', description: '' }
  }
}

async function getTargetRemote(repo: string, branch?: string, explicitRemote?: string): Promise<string> {
  if (explicitRemote?.trim()) return explicitRemote.trim()
  if (branch?.trim()) {
    try {
      const cfg = await runGit(repo, ['config', `branch.${branch.trim()}.remote`])
      const r = cfg.stdout.trim()
      if (r) return r
    } catch {
      // ignore
    }
  }
  let list: string[] = []
  try {
    const remotesRes = await runGit(repo, ['remote'])
    list = remotesRes.stdout
      .trim()
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    list = []
  }
  if (list.length === 0) {
    throw new Error('当前仓库未配置任何远程仓库 (Remote)，请先关联远程地址后再执行推送/拉取')
  }
  if (list.includes('origin')) return 'origin'
  return list[0]
}

export async function gitPush(
  repoInput: string,
  options?: { remote?: string; branch?: string; setUpstream?: boolean; force?: boolean }
): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const args = ['push']

  if (options?.force) {
    args.push('--force-with-lease')
  }

  let currentBranch = ''
  try {
    const branchRes = await runGit(repo, ['symbolic-ref', '--short', 'HEAD'])
    currentBranch = branchRes.stdout.trim()
  } catch {
    currentBranch = ''
  }

  const targetBranch = options?.branch?.trim() || currentBranch
  const targetRemote = await getTargetRemote(repo, targetBranch, options?.remote)

  // Check if target branch has an upstream
  let hasUpstream = false
  if (targetBranch) {
    try {
      await runGit(repo, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', `${targetBranch}@{u}`])
      hasUpstream = true
    } catch {
      hasUpstream = false
    }
  }

  if (targetBranch) {
    if (!hasUpstream || options?.setUpstream) {
      args.push('-u', targetRemote, targetBranch)
    } else {
      args.push(targetRemote, targetBranch)
    }
  } else if (targetRemote) {
    args.push(targetRemote)
  }

  const { stdout, stderr } = await runGit(repo, args)
  return { ok: true, message: cleanGitMessage(stdout || stderr, '推送成功') }
}

export async function gitPull(repoInput: string, options?: { remote?: string; branch?: string; rebase?: boolean; ffOnly?: boolean }): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const args = ['pull']
  if (options?.rebase) {
    args.push('--rebase')
  } else if (options?.ffOnly) {
    args.push('--ff-only')
  }

  const targetBranch = options?.branch?.trim()
  const targetRemote = await getTargetRemote(repo, targetBranch, options?.remote)

  if (targetBranch) {
    args.push(targetRemote, targetBranch)
  } else if (options?.remote) {
    args.push(targetRemote)
  }

  const { stdout, stderr } = await runGit(repo, args)
  return { ok: true, message: cleanGitMessage(stdout || stderr, '拉取成功') }
}

export async function gitFetch(repoInput: string, options?: { remote?: string; all?: boolean; prune?: boolean }): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const args = ['fetch']
  if (options?.prune !== false) {
    args.push('--prune')
  }
  if (options?.all) {
    args.push('--all')
  } else if (options?.remote) {
    args.push(options.remote)
  }

  const { stdout, stderr } = await runGit(repo, args)
  return { ok: true, message: cleanGitMessage(stdout || stderr, '抓取完成') }
}

export async function gitStash(
  repoInput: string,
  options: { action: 'save' | 'pop' | 'apply' | 'drop' | 'edit'; message?: string; index?: number; paths?: string[] }
): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const stashRef = options.index != null ? `stash@{${options.index}}` : undefined

  if (options.action === 'save') {
    const args = ['stash', 'push']
    if (options.message?.trim()) {
      args.push('-m', options.message.trim())
    }
    if (options.paths && options.paths.length > 0) {
      args.push('--', ...options.paths)
    }
    const { stdout, stderr } = await runGit(repo, args)
    return { ok: true, message: cleanGitMessage(stdout || stderr, '已暂存工作区更改') }
  }

  if (options.action === 'pop') {
    const args = ['stash', 'pop']
    if (stashRef) args.push(stashRef)
    const { stdout, stderr } = await runGit(repo, args)
    return { ok: true, message: cleanGitMessage(stdout || stderr, '已恢复暂存内容') }
  }

  if (options.action === 'apply') {
    const args = ['stash', 'apply']
    if (stashRef) args.push(stashRef)
    const { stdout, stderr } = await runGit(repo, args)
    return { ok: true, message: cleanGitMessage(stdout || stderr, '已应用暂存内容') }
  }

  if (options.action === 'drop') {
    const args = ['stash', 'drop']
    if (stashRef) args.push(stashRef)
    const { stdout, stderr } = await runGit(repo, args)
    return { ok: true, message: cleanGitMessage(stdout || stderr, '已删除暂存') }
  }

  if (options.action === 'edit') {
    if (!options.message?.trim()) throw new Error('暂存信息不能为空')
    const ref = stashRef || 'stash@{0}'
    const { stdout: commitSha } = await runGit(repo, ['rev-parse', ref])
    const cleanSha = commitSha.trim()
    await runGit(repo, ['stash', 'store', '-m', options.message.trim(), cleanSha])
    const oldIdx = (options.index ?? 0) + 1
    await runGit(repo, ['stash', 'drop', `stash@{${oldIdx}}`])
    return { ok: true, message: '已更新暂存说明' }
  }

  throw new Error(`未知的暂存操作: ${String(options.action)}`)
}

export async function gitCreatePatch(repoInput: string, options?: { path?: string; staged?: boolean }): Promise<{ ok: boolean; patch: string }> {
  const repo = await resolveGitRepo(repoInput)
  const args = ['diff']
  if (options?.staged) args.push('--cached')
  if (options?.path) args.push('--', options.path)

  try {
    const { stdout } = await runGit(repo, args)
    return { ok: true, patch: stdout || '' }
  } catch {
    return { ok: true, patch: '' }
  }
}

export async function gitIgnorePattern(repoInput: string, pattern: string): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const gitignorePath = path.join(repo, '.gitignore')
  let content = ''
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf8')
  }
  const trimmed = pattern.trim()
  const lines = content.split('\n').map((l) => l.trim())
  if (!lines.includes(trimmed)) {
    const newContent = content.endsWith('\n') || !content ? `${content}${trimmed}\n` : `${content}\n${trimmed}\n`
    fs.writeFileSync(gitignorePath, newContent, 'utf8')
  }
  return { ok: true, message: `已将 ${trimmed} 加入 .gitignore` }
}

export async function gitCreateFile(repoInput: string, relativePath: string): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const fullPath = path.resolve(repo, relativePath)
  if (!fullPath.startsWith(repo)) {
    throw new Error('非法路径')
  }
  if (fs.existsSync(fullPath)) {
    throw new Error('文件已存在')
  }
  const dir = path.dirname(fullPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(fullPath, '', 'utf8')
  return { ok: true, message: `已创建文件 ${relativePath}` }
}

export async function gitDeleteFile(repoInput: string, relativePath: string): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const fullPath = path.resolve(repo, relativePath)
  if (!fullPath.startsWith(repo)) {
    throw new Error('非法路径')
  }
  if (fs.existsSync(fullPath)) {
    try {
      await runGit(repo, ['rm', '-f', '--', relativePath])
    } catch {
      fs.rmSync(fullPath, { recursive: true, force: true })
    }
  }
  return { ok: true, message: `已删除 ${relativePath}` }
}

export async function gitAddWorktree(repoInput: string, worktreePath: string, branch?: string): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const args: string[] = ['worktree', 'add', worktreePath]
  if (branch) args.push(branch)
  const { stdout, stderr } = await runGit(repo, args)
  return { ok: true, message: stdout || stderr || `已创建工作树 ${worktreePath}` }
}

export async function gitCreateTag(repoInput: string, tag: string, target?: string, message?: string): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const args = ['tag']
  if (message) {
    args.push('-a', tag, '-m', message)
  } else {
    args.push(tag)
  }
  if (target) args.push(target)
  const { stdout, stderr } = await runGit(repo, args)
  return { ok: true, message: stdout || stderr || `已创建标签 ${tag}` }
}

export async function gitDeleteTag(repoInput: string, tag: string, options?: { remote?: string }): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  if (options?.remote) {
    const { stdout, stderr } = await runGit(repo, ['push', options.remote, '--delete', tag])
    return { ok: true, message: stdout || stderr || `已删除远程标签 ${options.remote}/${tag}` }
  }
  const { stdout, stderr } = await runGit(repo, ['tag', '-d', tag])
  return { ok: true, message: stdout || stderr || `已删除本地标签 ${tag}` }
}

export async function gitRestoreFile(repoInput: string, commitHash: string, filePath: string): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const { stdout, stderr } = await runGit(repo, ['checkout', commitHash, '--', filePath])
  return { ok: true, message: stdout || stderr || `已从提交 ${commitHash.slice(0, 7)} 恢复 ${filePath}` }
}

export async function gitReset(repoInput: string, target: string, mode: 'soft' | 'mixed' | 'hard' = 'mixed'): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const flag = mode === 'soft' ? '--soft' : mode === 'hard' ? '--hard' : '--mixed'
  const { stdout, stderr } = await runGit(repo, ['reset', flag, target])
  return { ok: true, message: stdout || stderr || `已重置到 ${target} (${mode})` }
}

export async function gitRevert(repoInput: string, commit: string): Promise<{ ok: boolean; message: string }> {
  const repo = await resolveGitRepo(repoInput)
  const { stdout, stderr } = await runGit(repo, ['revert', '--no-edit', commit])
  return { ok: true, message: stdout || stderr || `已撤销提交 ${commit.slice(0, 7)}` }
}
