import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { gitFetch, gitPull, gitPush } from '@/services/git/operations'

export const runtime = 'nodejs'

export const POST = defineApiRoute('post:/api/git/sync', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as {
    repo?: unknown
    action?: unknown
    remote?: unknown
    branch?: unknown
    setUpstream?: unknown
    force?: unknown
    all?: unknown
    rebase?: unknown
    ffOnly?: unknown
  } | null

  const repo = String(body?.repo || '').trim()
  if (!repo) return apiBadRequest('缺少仓库路径')

  const action = String(body?.action || 'push').trim()

  try {
    if (action === 'push') {
      return await gitPush(repo, {
        remote: typeof body?.remote === 'string' ? body.remote : undefined,
        branch: typeof body?.branch === 'string' ? body.branch : undefined,
        setUpstream: Boolean(body?.setUpstream),
        force: Boolean(body?.force),
      })
    }

    if (action === 'pull') {
      return await gitPull(repo, {
        remote: typeof body?.remote === 'string' ? body.remote : undefined,
        branch: typeof body?.branch === 'string' ? body.branch : undefined,
        rebase: Boolean(body?.rebase),
        ffOnly: Boolean(body?.ffOnly),
      })
    }

    if (action === 'fetch') {
      return await gitFetch(repo, {
        remote: typeof body?.remote === 'string' ? body.remote : undefined,
        all: body?.all !== false,
      })
    }

    return apiBadRequest(`未知的同步操作: ${action}`)
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '同步操作失败')
  }
})
