import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest, apiOk } from '@/initializer/response'
import {
  gitCommit,
  gitCreateFile,
  gitCreatePatch,
  gitCreateTag,
  gitDeleteFile,
  gitDeleteTag,
  gitDiscard,
  gitGetLastCommitMessage,
  gitIgnorePattern,
  gitRedoCommit,
  gitReset,
  gitRestoreFile,
  gitRevert,
  gitStage,
  gitStash,
  gitUndoLastCommit,
  gitUnstage,
} from '@/services/git/operations'
import { parseGitHubRepo, readRemoteCommitChanges } from '@/services/git/remote-provider'
import { readCommitChanges } from '@/services/git/show'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/commit', async ({ request }) => {
  const url = new URL(request.url)
  const repo = url.searchParams.get('repo') || undefined
  const hash = url.searchParams.get('hash') || ''

  try {
    if (repo && parseGitHubRepo(repo)) {
      return await readRemoteCommitChanges(repo, hash, {
        tree: url.searchParams.get('tree') === '1',
        file: url.searchParams.get('path') || '',
        all: url.searchParams.get('all') === '1',
      })
    }

    return await readCommitChanges(repo, hash, url.searchParams.get('tree') === '1', url.searchParams.get('path') || '', url.searchParams.get('all') === '1')
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : 'git 失败')
  }
})

export const POST = defineApiRoute('post:/api/git/commit', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as {
    repo?: unknown
    action?: unknown
    message?: unknown
    stageAll?: unknown
    amend?: unknown
    noVerify?: unknown
    pushAfter?: unknown
    files?: unknown
    all?: unknown
    stashAction?: unknown
    stashIndex?: unknown
    path?: unknown
    pattern?: unknown
    relativePath?: unknown
    hash?: unknown
    tag?: unknown
    target?: unknown
    remote?: unknown
    mode?: unknown
  } | null

  const repo = String(body?.repo || '').trim()
  if (!repo) return apiBadRequest('缺少仓库路径')

  const action = String(body?.action || 'commit').trim()
  const files = Array.isArray(body?.files) ? body.files.map(String).filter(Boolean) : undefined
  const all = Boolean(body?.all)

  try {
    if (action === 'commit') {
      const message = String(body?.message || '').trim()
      if (!message) return apiBadRequest('缺少提交信息')
      return await gitCommit(repo, message, {
        stageAll: Boolean(body?.stageAll),
        amend: Boolean(body?.amend),
        noVerify: Boolean(body?.noVerify),
        pushAfter: Boolean(body?.pushAfter),
      })
    }

    if (action === 'get-last-commit') {
      const res = await gitGetLastCommitMessage(repo)
      return apiOk(res)
    }

    if (action === 'create-patch') {
      const targetPath = typeof body?.path === 'string' ? body.path : undefined
      const res = await gitCreatePatch(repo, { path: targetPath, staged: Boolean(body?.stageAll) })
      return apiOk(res)
    }

    if (action === 'ignore') {
      const pattern = String(body?.pattern || '').trim()
      if (!pattern) return apiBadRequest('缺少 pattern')
      const res = await gitIgnorePattern(repo, pattern)
      return apiOk(res)
    }

    if (action === 'create-file') {
      const relativePath = String(body?.relativePath || '').trim()
      if (!relativePath) return apiBadRequest('缺少 relativePath')
      const res = await gitCreateFile(repo, relativePath)
      return apiOk(res)
    }

    if (action === 'delete-file') {
      const relativePath = String(body?.relativePath || '').trim()
      if (!relativePath) return apiBadRequest('缺少 relativePath')
      const res = await gitDeleteFile(repo, relativePath)
      return apiOk(res)
    }

    if (action === 'restore-file') {
      const hash = String(body?.hash || '').trim()
      const filePath = String(body?.path || '').trim()
      if (!hash || !filePath) return apiBadRequest('缺少 hash 或 path')
      const res = await gitRestoreFile(repo, hash, filePath)
      return apiOk(res)
    }

    if (action === 'create-tag') {
      const tag = String(body?.tag || '').trim()
      if (!tag) return apiBadRequest('缺少 tag')
      const target = typeof body?.target === 'string' ? body.target : undefined
      const message = typeof body?.message === 'string' ? body.message : undefined
      const res = await gitCreateTag(repo, tag, target, message)
      return apiOk(res)
    }

    if (action === 'delete-tag') {
      const tag = String(body?.tag || '').trim()
      if (!tag) return apiBadRequest('缺少 tag')
      const remote = typeof body?.remote === 'string' ? body.remote : undefined
      const res = await gitDeleteTag(repo, tag, { remote })
      return apiOk(res)
    }

    if (action === 'reset') {
      const target = String(body?.target || body?.hash || '').trim()
      const mode = String(body?.mode || 'mixed').trim() as 'soft' | 'mixed' | 'hard'
      if (!target) return apiBadRequest('缺少目标提交')
      const res = await gitReset(repo, target, mode)
      return apiOk(res)
    }

    if (action === 'revert') {
      const commit = String(body?.hash || body?.target || '').trim()
      if (!commit) return apiBadRequest('缺少目标提交')
      const res = await gitRevert(repo, commit)
      return apiOk(res)
    }

    if (action === 'stage') {
      return await gitStage(repo, files, all)
    }

    if (action === 'unstage') {
      return await gitUnstage(repo, files, all)
    }

    if (action === 'discard') {
      return await gitDiscard(repo, files, all)
    }

    if (action === 'undo') {
      const soft = body?.stageAll !== false
      const res = await gitUndoLastCommit(repo, soft)
      return apiOk(res)
    }

    if (action === 'redo') {
      const soft = body?.stageAll !== false
      const res = await gitRedoCommit(repo, soft)
      return apiOk(res)
    }

    if (action === 'stash') {
      const stashAction = String(body?.stashAction || 'save') as 'save' | 'pop' | 'apply' | 'drop' | 'edit'
      return await gitStash(repo, {
        action: stashAction,
        message: typeof body?.message === 'string' ? body.message : undefined,
        index: typeof body?.stashIndex === 'number' ? body.stashIndex : undefined,
        paths: files,
      })
    }

    return apiBadRequest(`未知的提交操作: ${action}`)
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '操作失败')
  }
})
