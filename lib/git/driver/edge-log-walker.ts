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

const YIELD_INTERVAL_STEPS = 120
const YIELD_INTERVAL_MS = 12

function abortError(): Error {
  return typeof DOMException !== 'undefined' ? new DOMException('Aborted', 'AbortError') : new Error('Aborted')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw abortError()
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function commitTimestamp(item: RawCommitItem): number {
  return item.commit.committer?.timestamp || item.commit.author?.timestamp || 0
}

function matchesHashNeedle(oid: string, cleanNeedle: string): boolean {
  const lower = oid.toLowerCase()
  return lower === cleanNeedle || (cleanNeedle.length >= 7 && lower.startsWith(cleanNeedle))
}

/**
 * Resumable, cancellable multi-branch commit walker that yields periodically to keep the UI responsive
 * and reuses in-memory traversal state across pagination and locate jumps.
 */
export class MultiBranchLogSession {
  readonly commits: RawCommitItem[] = []
  private readonly commitMap = new Map<string, RawCommitItem>()
  private readonly visited = new Set<string>()
  private readonly queued = new Set<string>()
  private readonly queue: RawCommitItem[] = []
  private initialized = false
  private exhausted = false
  private readonly tips: string[]
  private readonly fs: any
  private readonly cache?: any
  private readonly dir: string

  constructor({ fs, cache, dir = '/', tips }: { fs: any; cache?: any; dir?: string; tips: string[] }) {
    this.fs = fs
    this.cache = cache
    this.dir = dir
    this.tips = tips
  }

  private async getCommit(oid: string): Promise<RawCommitItem | null> {
    if (!oid) return null
    const cleanOid = oid.trim().toLowerCase()
    const cached = this.commitMap.get(cleanOid)
    if (cached) return cached
    try {
      const c = (await git.readCommit({ fs: this.fs, cache: this.cache, dir: this.dir, oid: cleanOid })) as RawCommitItem
      this.commitMap.set(cleanOid, c)
      return c
    } catch {
      return null
    }
  }

  private async ensureInitialized(signal?: AbortSignal): Promise<void> {
    if (this.initialized) return
    throwIfAborted(signal)
    let lastYield = Date.now()
    for (let i = 0; i < this.tips.length; i++) {
      throwIfAborted(signal)
      const rawOid = this.tips[i]
      if (!rawOid) continue
      const oid = rawOid.trim().toLowerCase()
      if (this.queued.has(oid)) continue
      this.queued.add(oid)
      const c = await this.getCommit(oid)
      if (c) this.queue.push(c)
      if ((i + 1) % YIELD_INTERVAL_STEPS === 0 || Date.now() - lastYield >= YIELD_INTERVAL_MS) {
        await yieldToEventLoop()
        lastYield = Date.now()
      }
    }
    this.queue.sort((a, b) => commitTimestamp(b) - commitTimestamp(a))
    this.initialized = true
    if (this.queue.length === 0) {
      this.exhausted = true
    }
  }

  private async stepNext(): Promise<RawCommitItem | null> {
    while (this.queue.length > 0) {
      const top = this.queue.shift()!
      if (this.visited.has(top.oid)) continue
      this.visited.add(top.oid)
      this.commits.push(top)

      for (const pOid of top.commit.parent || []) {
        const pClean = pOid.trim().toLowerCase()
        if (!this.visited.has(pClean) && !this.queued.has(pClean)) {
          this.queued.add(pClean)
          const parentCommit = await this.getCommit(pClean)
          if (parentCommit) {
            const ts = commitTimestamp(parentCommit)
            let low = 0
            let high = this.queue.length
            while (low < high) {
              const mid = (low + high) >>> 1
              if (commitTimestamp(this.queue[mid]) >= ts) {
                low = mid + 1
              } else {
                high = mid
              }
            }
            this.queue.splice(low, 0, parentCommit)
          }
        }
      }
      return top
    }
    this.exhausted = true
    return null
  }

  async ensureCount(targetCount: number, signal?: AbortSignal): Promise<RawCommitItem[]> {
    await this.ensureInitialized(signal)
    let steps = 0
    let lastYield = Date.now()
    while (!this.exhausted && this.commits.length < targetCount) {
      throwIfAborted(signal)
      const next = await this.stepNext()
      if (!next) break
      steps++
      if (steps % YIELD_INTERVAL_STEPS === 0 || Date.now() - lastYield >= YIELD_INTERVAL_MS) {
        await yieldToEventLoop()
        lastYield = Date.now()
      }
    }
    return this.commits
  }

  async locate(hash: string, tailBuffer: number, maxWalk = 20000, signal?: AbortSignal): Promise<{ commits: RawCommitItem[]; locatedIndex: number }> {
    const clean = hash.trim().toLowerCase()
    if (!clean) {
      return { commits: await this.ensureCount(tailBuffer, signal), locatedIndex: -1 }
    }

    const cachedIdx = this.commits.findIndex((c) => matchesHashNeedle(c.oid, clean))
    if (cachedIdx >= 0) {
      await this.ensureCount(cachedIdx + tailBuffer + 1, signal)
      return { commits: this.commits, locatedIndex: cachedIdx }
    }

    await this.ensureInitialized(signal)
    let steps = 0
    let lastYield = Date.now()
    let locatedIndex = -1

    while (!this.exhausted && this.commits.length < maxWalk) {
      throwIfAborted(signal)
      const item = await this.stepNext()
      if (!item) break
      if (matchesHashNeedle(item.oid, clean)) {
        locatedIndex = this.commits.length - 1
        break
      }
      steps++
      if (steps % YIELD_INTERVAL_STEPS === 0 || Date.now() - lastYield >= YIELD_INTERVAL_MS) {
        await yieldToEventLoop()
        lastYield = Date.now()
      }
    }

    if (locatedIndex >= 0) {
      await this.ensureCount(locatedIndex + tailBuffer + 1, signal)
    }

    return { commits: this.commits, locatedIndex }
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
  signal,
}: {
  fs: any
  cache?: any
  dir?: string
  tips: string[]
  limit: number
  skip?: number
  signal?: AbortSignal
}): Promise<RawCommitItem[]> {
  const session = new MultiBranchLogSession({ fs, cache, dir, tips })
  return await session.ensureCount(skip + limit + 1, signal)
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
