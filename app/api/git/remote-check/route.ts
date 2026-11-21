import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { checkGitRemotes } from '@/services/git/remote-check'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/remote-check', async ({ request }) => {
  const url = new URL(request.url)
  const repo = url.searchParams.get('repo') || undefined
  const force = url.searchParams.get('refresh') === '1' || url.searchParams.get('force') === '1'
  try {
    return await checkGitRemotes(repo, force)
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : 'git 失败')
  }
})
