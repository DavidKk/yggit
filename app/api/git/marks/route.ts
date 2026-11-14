import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { writeBranchMark } from '@/services/git/marks'
import { resolveGitRepo } from '@/services/git/read'

export const runtime = 'nodejs'

export const PUT = defineApiRoute('put:/api/git/marks', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { repo?: unknown; branch?: unknown; direction?: unknown; destination?: unknown } | null
  const branch = String(body?.branch || '').trim()
  if (!branch) return apiBadRequest('缺少分支')
  try {
    const repo = await resolveGitRepo(typeof body?.repo === 'string' ? body.repo : undefined)
    const branches = writeBranchMark(repo, branch, {
      direction: String(body?.direction || ''),
      destination: String(body?.destination || ''),
    })
    return { repo, branches }
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '无法保存标记')
  }
})
