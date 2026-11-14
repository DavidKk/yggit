import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { checkGitRemotes } from '@/services/git/remote-check'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/remote-check', async ({ request }) => {
  const url = new URL(request.url)
  try {
    return await checkGitRemotes(url.searchParams.get('repo') || undefined)
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : 'git 失败')
  }
})
