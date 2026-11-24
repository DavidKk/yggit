import git from 'isomorphic-git'

export interface RawCommitItem {
  oid: string
  commit: {
    parent: string[]
    tree?: string
    author?: { name?: string; email?: string; timestamp?: number; timezoneOffset?: number }
    committer?: { name?: string; email?: string; timestamp?: number; timezoneOffset?: number }
    message?: string
  }
}

/**
 * Traverse commits across multiple branch tips simultaneously in descending committer timestamp order,
 * matching standard Git log behavior (git log --branches --tags --remotes HEAD).
 */
export async function walkMultiBranchLog({
  fs,
  cache,
  dir = '/',
  tips,
  limit,
  skip = 0,
}: {
  fs: any
  cache?: any
  dir?: string
  tips: string[]
  limit: number
  skip?: number
}): Promise<RawCommitItem[]> {
  const commitMap = new Map<string, RawCommitItem>()
  const visited = new Set<string>()

  async function getCommit(oid: string): Promise<RawCommitItem | null> {
    if (!oid) return null
    const cleanOid = oid.trim().toLowerCase()
    const cached = commitMap.get(cleanOid)
    if (cached) return cached
    try {
      const c = (await git.readCommit({ fs, cache, dir, oid: cleanOid })) as RawCommitItem
      commitMap.set(cleanOid, c)
      return c
    } catch {
      return null
    }
  }

  const queue: RawCommitItem[] = []
  const queued = new Set<string>()

  for (const rawOid of tips) {
    if (!rawOid) continue
    const oid = rawOid.trim().toLowerCase()
    if (queued.has(oid)) continue
    queued.add(oid)
    const c = await getCommit(oid)
    if (c) queue.push(c)
  }

  const getTs = (item: RawCommitItem) => item.commit.committer?.timestamp || item.commit.author?.timestamp || 0
  queue.sort((a, b) => getTs(b) - getTs(a))

  const result: RawCommitItem[] = []
  const maxNeeded = skip + limit + 1

  while (queue.length > 0 && result.length < maxNeeded) {
    const top = queue.shift()!
    if (visited.has(top.oid)) continue
    visited.add(top.oid)
    result.push(top)

    for (const pOid of top.commit.parent || []) {
      const pClean = pOid.trim().toLowerCase()
      if (!visited.has(pClean) && !queued.has(pClean)) {
        queued.add(pClean)
        const parentCommit = await getCommit(pClean)
        if (parentCommit) {
          const ts = getTs(parentCommit)
          let low = 0
          let high = queue.length
          while (low < high) {
            const mid = (low + high) >>> 1
            if (getTs(queue[mid]) >= ts) {
              low = mid + 1
            } else {
              high = mid
            }
          }
          queue.splice(low, 0, parentCommit)
        }
      }
    }
  }

  return result
}

/**
 * Fast ancestor search to compute ahead and behind commit counts between a local branch tip and its remote tracking tip.
 */
export async function computeBranchAheadBehind(
  fs: any,
  cache: any,
  dir: string,
  localTip: string,
  remoteTip: string,
  maxHops = 100
): Promise<{ ahead: number; behind: number } | null> {
  if (!localTip || !remoteTip) return null
  if (localTip === remoteTip) return { ahead: 0, behind: 0 }

  try {
    const localAncestors = new Set<string>()
    const localQueue = [localTip]
    let aheadCount = 0
    let foundRemoteInLocal = false

    while (localQueue.length > 0 && localAncestors.size < maxHops) {
      const cur = localQueue.shift()!
      if (cur === remoteTip) {
        foundRemoteInLocal = true
        break
      }
      if (localAncestors.has(cur)) continue
      localAncestors.add(cur)
      aheadCount++
      const c = await git.readCommit({ fs, cache, dir, oid: cur }).catch(() => null)
      if (c?.commit?.parent) {
        for (const p of c.commit.parent) {
          if (!localAncestors.has(p)) localQueue.push(p)
        }
      }
    }

    if (foundRemoteInLocal) {
      return { ahead: aheadCount, behind: 0 }
    }

    const remoteAncestors = new Set<string>()
    const remoteQueue = [remoteTip]
    let behindCount = 0
    let foundLocalInRemote = false

    while (remoteQueue.length > 0 && remoteAncestors.size < maxHops) {
      const cur = remoteQueue.shift()!
      if (cur === localTip) {
        foundLocalInRemote = true
        break
      }
      if (remoteAncestors.has(cur)) continue
      remoteAncestors.add(cur)
      behindCount++
      const c = await git.readCommit({ fs, cache, dir, oid: cur }).catch(() => null)
      if (c?.commit?.parent) {
        for (const p of c.commit.parent) {
          if (!remoteAncestors.has(p)) remoteQueue.push(p)
        }
      }
    }

    if (foundLocalInRemote) {
      return { ahead: 0, behind: behindCount }
    }

    return { ahead: aheadCount, behind: behindCount }
  } catch {
    return null
  }
}
