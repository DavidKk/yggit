import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { gitAddWorktree } from '@/services/git/operations'

export const runtime = 'nodejs'

export const POST = defineApiRoute('post:/api/git/worktree', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as {
    repo?: unknown
    path?: unknown
    branch?: unknown
    action?: unknown
  } | null

  const repo = String(body?.repo || '').trim()
  if (!repo) return apiBadRequest('缺少仓库路径')

  const worktreePath = String(body?.path || '').trim()
  if (!worktreePath) return apiBadRequest('缺少 Worktree 目录路径')

  const branch = typeof body?.branch === 'string' && body.branch.trim() ? body.branch.trim() : undefined

  try {
    return await gitAddWorktree(repo, worktreePath, branch)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '创建 Worktree 失败' }
  }
})
