import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest, apiOk } from '@/initializer/response'
import { detectMergeConflict, getRemergeDiff, type MergeConflictRecord, readCachedConflicts, writeCachedConflicts } from '@/services/git/conflicts'
import { resolveGitRepo } from '@/services/git/read'

export const runtime = 'nodejs'

interface PostPayload {
  repo?: string
  commits?: Array<{ hash: string; parents: string[] }>
}

export const POST = defineApiRoute('post:/api/git/conflicts', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as PostPayload | null
  const commits = body?.commits || []
  if (!Array.isArray(commits) || commits.length === 0) {
    return apiOk({ conflicts: {} })
  }

  try {
    const repo = await resolveGitRepo(typeof body?.repo === 'string' ? body.repo : undefined)
    const cached = readCachedConflicts(repo)
    let dirty = false

    // Identify uncached merge commits, limit batch to at most 5 per request to maintain 0 lag
    const uncached = commits.filter((c) => c && c.hash && !cached[c.hash] && Array.isArray(c.parents) && c.parents.length >= 2).slice(0, 5)

    if (uncached.length > 0) {
      for (const item of uncached) {
        const record = await detectMergeConflict(repo, item.hash, item.parents)
        cached[item.hash] = record
        dirty = true
      }
      if (dirty) {
        writeCachedConflicts(repo, cached)
      }
    }

    // Only return records for the requested commits
    const result: Record<string, MergeConflictRecord> = {}
    for (const c of commits) {
      if (cached[c.hash]) {
        result[c.hash] = cached[c.hash]
      }
    }

    return apiOk({ conflicts: result })
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '无法检测合并冲突')
  }
})

export const GET = defineApiRoute('get:/api/git/conflicts', async ({ request }) => {
  const url = new URL(request.url)
  const repoParam = url.searchParams.get('repo') || undefined
  const hash = url.searchParams.get('hash') || ''

  if (!hash) {
    return apiBadRequest('缺少 commit hash')
  }

  try {
    const repo = await resolveGitRepo(repoParam)
    const cached = readCachedConflicts(repo)
    const record = cached[hash]

    const remerge = await getRemergeDiff(repo, hash)
    return apiOk({
      hash,
      record: record || null,
      diff: remerge.diff,
      files: remerge.files,
    })
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '读取冲突解决方案失败')
  }
})
