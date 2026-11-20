import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { readGitBlame } from '@/services/git/blame'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/blame', async ({ request }) => {
  const url = new URL(request.url)
  const repo = url.searchParams.get('repo') || undefined
  const path = url.searchParams.get('path') || ''
  const hash = url.searchParams.get('hash') || undefined

  if (!path) {
    return apiBadRequest('缺少 path 参数')
  }

  try {
    const blame = await readGitBlame({ repo, path, hash })
    return blame
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : 'git blame 失败')
  }
})
