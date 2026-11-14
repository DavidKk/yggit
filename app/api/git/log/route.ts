import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { readGitHistory, readGitLog } from '@/services/git/read'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/log', async ({ request }) => {
  const url = new URL(request.url)
  const skip = Number(url.searchParams.get('skip') || 0)
  const ref = url.searchParams.get('ref') || undefined
  try {
    if (skip > 0) return await readGitHistory({ repo: url.searchParams.get('repo') || undefined, ref, skip })
    return await readGitLog({
      repo: url.searchParams.get('repo') || undefined,
      branch: url.searchParams.get('branch') || undefined,
      ref,
    })
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : 'git 失败')
  }
})
