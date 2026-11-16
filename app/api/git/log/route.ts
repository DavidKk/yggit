import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { readGitHistory, readGitLog } from '@/services/git/read'
import { parseGitHubRepo, readRemoteGitLog } from '@/services/git/remote-provider'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/log', async ({ request }) => {
  const url = new URL(request.url)
  const repo = url.searchParams.get('repo') || undefined
  const skip = Number(url.searchParams.get('skip') || 0)
  const ref = url.searchParams.get('ref') || undefined
  const branch = url.searchParams.get('branch') || undefined

  try {
    if (repo && parseGitHubRepo(repo)) {
      return await readRemoteGitLog(repo, branch || ref, skip)
    }

    if (skip > 0) return await readGitHistory({ repo, ref, skip })
    return await readGitLog({
      repo,
      branch,
      ref,
    })
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : 'git 失败')
  }
})
