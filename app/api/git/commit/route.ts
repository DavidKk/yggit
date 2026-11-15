import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { parseGitHubRepo, readRemoteCommitChanges } from '@/services/git/remote-provider'
import { readCommitChanges } from '@/services/git/show'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/commit', async ({ request }) => {
  const url = new URL(request.url)
  const repo = url.searchParams.get('repo') || undefined
  const hash = url.searchParams.get('hash') || ''

  try {
    if (repo && parseGitHubRepo(repo)) {
      return await readRemoteCommitChanges(repo, hash)
    }

    return await readCommitChanges(repo, hash, url.searchParams.get('tree') === '1', url.searchParams.get('path') || '', url.searchParams.get('all') === '1')
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : 'git 失败')
  }
})
