import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { cloneGitProject, listGitCatalog } from '@/services/git/projects'

export const runtime = 'nodejs'

export const POST = defineApiRoute('post:/api/git/clone', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { id?: unknown; parent?: unknown } | null
  const id = String(body?.id || '').trim()
  if (!id) return apiBadRequest('缺少项目')
  try {
    const path = await cloneGitProject(id, String(body?.parent || ''))
    return { path, ...listGitCatalog() }
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '克隆失败')
  }
})
