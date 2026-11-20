import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { gitCheckout, gitCherryPick, gitCreateBranch, gitDeleteBranch, gitMergeBranch, gitRebaseBranch, gitRenameBranch } from '@/services/git/operations'

export const runtime = 'nodejs'

export const POST = defineApiRoute('post:/api/git/branch', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as {
    repo?: unknown
    action?: unknown
    branch?: unknown
    hash?: unknown
    oldName?: unknown
    newName?: unknown
    startPoint?: unknown
    create?: unknown
    track?: unknown
    force?: unknown
    abort?: unknown
    continue?: unknown
  } | null

  const repo = String(body?.repo || '').trim()
  if (!repo) return apiBadRequest('缺少仓库路径')

  const action = String(body?.action || '').trim()

  try {
    if (action === 'checkout') {
      const branch = String(body?.branch || '').trim()
      if (!branch) return apiBadRequest('缺少分支名称')
      return await gitCheckout(repo, branch, {
        create: Boolean(body?.create),
        startPoint: typeof body?.startPoint === 'string' ? body.startPoint : undefined,
        track: Boolean(body?.track),
      })
    }

    if (action === 'create') {
      const branch = String(body?.branch || '').trim()
      if (!branch) return apiBadRequest('缺少分支名称')
      return await gitCreateBranch(repo, branch, typeof body?.startPoint === 'string' ? body.startPoint : undefined, body?.create !== false)
    }

    if (action === 'delete') {
      const branch = String(body?.branch || '').trim()
      if (!branch) return apiBadRequest('缺少分支名称')
      return await gitDeleteBranch(repo, branch, Boolean(body?.force))
    }

    if (action === 'rename') {
      const newName = String(body?.newName || '').trim()
      if (!newName) return apiBadRequest('缺少新分支名称')
      return await gitRenameBranch(repo, String(body?.oldName || '').trim(), newName)
    }

    if (action === 'merge') {
      const branch = String(body?.branch || '').trim()
      if (!branch) return apiBadRequest('缺少要合并的分支名称')
      return await gitMergeBranch(repo, branch)
    }

    if (action === 'rebase') {
      const branch = String(body?.branch || '').trim()
      if (!branch && !body?.abort && !body?.continue) return apiBadRequest('缺少变基目标分支名称')
      return await gitRebaseBranch(repo, branch, {
        abort: Boolean(body?.abort),
        continue: Boolean(body?.continue),
      })
    }

    if (action === 'cherry-pick') {
      const hash = String(body?.hash || '').trim()
      if (!hash && !body?.abort && !body?.continue) return apiBadRequest('缺少要遴选的提交哈希')
      return await gitCherryPick(repo, hash, {
        abort: Boolean(body?.abort),
        continue: Boolean(body?.continue),
      })
    }

    return apiBadRequest(`未知的分支操作: ${action}`)
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '分支操作失败')
  }
})
