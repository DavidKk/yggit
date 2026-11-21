import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { getProjectRemotes } from '@/services/git/projects'
import { gitAddRemote, gitGetRemoteUrl, gitRemoveRemote, gitRenameRemote, gitSetRemoteUrl, gitSetUpstream } from '@/services/git/remotes'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/remote', async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const repo = (searchParams.get('repo') || '').trim()
  if (!repo) return apiBadRequest('缺少仓库路径')
  const remote = (searchParams.get('remote') || '').trim()

  const remotes = await getProjectRemotes(repo)
  let url = ''
  if (remote) {
    url = await gitGetRemoteUrl(repo, remote)
  }
  return { ok: true, remotes, url }
})

export const POST = defineApiRoute('post:/api/git/remote', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as {
    repo?: unknown
    action?: unknown
    remote?: unknown
    url?: unknown
    pushUrl?: unknown
    newName?: unknown
    name?: unknown
    branch?: unknown
    upstream?: unknown
  } | null

  const repo = String(body?.repo || '').trim()
  if (!repo) return apiBadRequest('缺少仓库路径')

  const action = String(body?.action || '').trim()
  const remote = String(body?.remote || body?.name || '').trim()

  try {
    if (action === 'setUrl') {
      const url = String(body?.url || '').trim()
      if (!url) return apiBadRequest('缺少远程源 URL')
      return await gitSetRemoteUrl(repo, remote, url)
    }
    if (action === 'rename') {
      const newName = String(body?.newName || '').trim()
      if (!newName) return apiBadRequest('缺少新远程源名称')
      return await gitRenameRemote(repo, remote, newName)
    }
    if (action === 'remove') {
      if (!remote) return apiBadRequest('缺少远程源名称')
      return await gitRemoveRemote(repo, remote)
    }
    if (action === 'add') {
      const name = String(body?.name || remote).trim()
      const url = String(body?.url || '').trim()
      const pushUrl = String(body?.pushUrl || '').trim()
      if (!name || !url) return apiBadRequest('缺少远程源名称或 URL')
      return await gitAddRemote(repo, name, url, pushUrl)
    }
    if (action === 'setUpstream') {
      const branch = String(body?.branch || '').trim()
      const upstream = String(body?.upstream || '').trim()
      if (!branch || !upstream) return apiBadRequest('缺少本地分支或上游分支名')
      return await gitSetUpstream(repo, branch, upstream)
    }
    return apiBadRequest(`未知的远程源操作: ${action}`)
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '远程源操作失败')
  }
})
