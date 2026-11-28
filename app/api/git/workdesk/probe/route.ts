import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest, apiOk } from '@/initializer/response'
import { probeLocalRepoForWorkdesk } from '@/services/git/workdesk-probe'

export const runtime = 'nodejs'

interface ProbePayload {
  repo?: unknown
  knownSignature?: unknown
  force?: unknown
}

export const POST = defineApiRoute('post:/api/git/workdesk/probe', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as ProbePayload | null
  const repo = typeof body?.repo === 'string' ? body.repo.trim() : ''
  if (!repo) {
    return apiBadRequest('缺少仓库路径')
  }

  try {
    const result = await probeLocalRepoForWorkdesk({
      repo,
      knownSignature: typeof body?.knownSignature === 'string' ? body.knownSignature : undefined,
      force: body?.force === true,
    })
    return apiOk({
      unchanged: result.unchanged,
      signature: result.signature,
      ...(result.logView ? { logView: result.logView } : {}),
    })
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '工作台仓库探针检测失败')
  }
})
