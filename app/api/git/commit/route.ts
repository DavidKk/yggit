import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { readCommitChanges } from '@/services/git/show'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/commit', async ({ request }) => {
  const url = new URL(request.url)
  try {
    return await readCommitChanges(
      url.searchParams.get('repo') || undefined,
      url.searchParams.get('hash') || '',
      url.searchParams.get('tree') === '1',
      url.searchParams.get('path') || '',
      url.searchParams.get('all') === '1'
    )
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : 'git 失败')
  }
})
