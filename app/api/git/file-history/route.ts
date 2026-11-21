import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { readFileHistory } from '@/services/git/read'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/file-history', async ({ request }) => {
  const url = new URL(request.url)
  const repo = url.searchParams.get('repo') || undefined
  const path = url.searchParams.get('path') || ''
  const ref = url.searchParams.get('ref') || undefined
  const limit = Number(url.searchParams.get('limit')) || 100

  if (!path) {
    return apiBadRequest('缺少 path 参数')
  }

  try {
    const history = await readFileHistory({ repo, path, ref, limit })
    return history
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : 'git log 失败')
  }
})
