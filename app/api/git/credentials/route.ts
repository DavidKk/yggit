import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import type { GitProjectHost } from '@/lib/git/types'
import { authorizeGitHost } from '@/services/git/projects'

export const runtime = 'nodejs'

export const POST = defineApiRoute('post:/api/git/credentials', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { host?: unknown; baseUrl?: unknown; token?: unknown } | null
  const host = body?.host === 'github' || body?.host === 'gitlab' ? body.host : ''
  if (!host) return apiBadRequest('选择 GitLab 或 GitHub')
  try {
    return await authorizeGitHost({ host: host as Exclude<GitProjectHost, 'local'>, baseUrl: String(body?.baseUrl || ''), token: String(body?.token || '') })
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '授权失败')
  }
})
