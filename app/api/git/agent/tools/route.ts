import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest, apiOk } from '@/initializer/response'
import { checkBranchContainment, findGitCommits, getGitBranches, getGitCommitDetails, getGitRepoSummary, getTodayMerges } from '@/services/git/agent-impact'

export const runtime = 'nodejs'

export const POST = defineApiRoute('post:/api/git/agent/tools', async ({ request }) => {
  try {
    const payload = await request.json()
    const { tool, args = {}, repo } = payload

    if (!tool) {
      return apiBadRequest('Missing tool name')
    }

    switch (tool) {
      case 'get_branches': {
        const data = await getGitBranches({ repo })
        return apiOk(data as unknown as Record<string, unknown>)
      }

      case 'get_repo_summary': {
        const data = await getGitRepoSummary({ repo })
        return apiOk(data as unknown as Record<string, unknown>)
      }

      case 'check_branch_containment': {
        const { sourceBranch, targetBranch } = args
        if (!sourceBranch || !targetBranch) {
          return apiBadRequest('sourceBranch and targetBranch are required')
        }
        const data = await checkBranchContainment({ repo, sourceBranch, targetBranch })
        return apiOk(data as unknown as Record<string, unknown>)
      }

      case 'get_today_merges': {
        const { since } = args
        const data = await getTodayMerges({ repo, since })
        return apiOk(data as unknown as Record<string, unknown>)
      }

      case 'find_commits': {
        const { query, author, since, maxCount } = args
        const data = await findGitCommits({ repo, query, author, since, maxCount })
        return apiOk(data as unknown as Record<string, unknown>)
      }

      case 'get_commit_details': {
        const { commitHash } = args
        if (!commitHash) {
          return apiBadRequest('commitHash is required')
        }
        const data = await getGitCommitDetails({ repo, commitHash })
        return apiOk(data as unknown as Record<string, unknown>)
      }

      default:
        return apiBadRequest(`Unsupported agent tool: ${tool}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Tool execution failed'
    return apiBadRequest(msg)
  }
})
