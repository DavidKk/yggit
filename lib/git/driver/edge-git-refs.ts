import git from 'isomorphic-git'

import { isPrivateRemote } from '@/lib/git/project-access'
import type { GitBranch, GitRemoteBranch, GitRemoteSource, GitTag } from '@/lib/git/types'

import { readGitConfigData } from './edge-git-config'
import { computeBranchAheadBehind } from './edge-log-walker'
import type { EdgeRepositoryReader } from './edge-repository-reader'

export interface EdgeRefsSnapshot {
  currentBranch: string
  headOid: string
  branches: GitBranch[]
  tags: GitTag[]
  remotes: GitRemoteBranch[]
  remoteSources: GitRemoteSource[]
  remoteUrl: string
}

/**
 * Load branches, tags, remotes, upstreams, and HEAD OID for `readClientLogFallback`
 * using a single parsed `.git/config` pass instead of per-branch `git.getConfig` I/O.
 */
export async function readEdgeRefsSnapshot(reader: EdgeRepositoryReader): Promise<EdgeRefsSnapshot> {
  const { fs, cache } = reader

  let currentBranch = 'main'
  try {
    currentBranch = (await git.currentBranch({ fs, dir: '/' })) || 'main'
  } catch {
    // Empty/unborn repos fallback to main
  }

  let branchNames: string[] = []
  try {
    branchNames = await git.listBranches({ fs, dir: '/' })
  } catch {
    branchNames = [currentBranch]
  }
  if (!branchNames.includes(currentBranch)) {
    branchNames.unshift(currentBranch)
  }

  const [configData, tagNames, headOid] = await Promise.all([
    readGitConfigData(fs),
    git.listTags({ fs, dir: '/' }).catch(() => [] as string[]),
    git.resolveRef({ fs, dir: '/', ref: 'HEAD' }).catch(() => ''),
  ])

  const branches = await Promise.all(
    branchNames.map(async (name): Promise<GitBranch> => {
      const tip = await git.resolveRef({ fs, dir: '/', ref: name }).catch(() => '')
      let upstream = ''
      let ahead: number | undefined
      let behind: number | undefined

      const tracking = configData.branchUpstreams.get(name)
      if (tracking?.remote && tracking?.merge) {
        const mergeBranch = tracking.merge.replace(/^refs\/heads\//, '')
        upstream = `${tracking.remote}/${mergeBranch}`
        const remoteTip = await git.resolveRef({ fs, dir: '/', ref: `refs/remotes/${upstream}` }).catch(() => '')
        if (tip && remoteTip) {
          if (tip === remoteTip) {
            ahead = 0
            behind = 0
          } else {
            const counts = await computeBranchAheadBehind(fs, cache, '/', tip, remoteTip)
            if (counts) {
              ahead = counts.ahead
              behind = counts.behind
            }
          }
        }
      }

      return {
        name,
        current: name === currentBranch,
        tip,
        upstream,
        ahead,
        behind,
      }
    })
  )

  const tags = await Promise.all(
    tagNames.map(async (name): Promise<GitTag> => ({
      name,
      tip: await git.resolveRef({ fs, dir: '/', ref: name }).catch(() => ''),
    }))
  )

  const remotes: GitRemoteBranch[] = []
  const remoteSources: GitRemoteSource[] = []
  let remoteUrl = ''

  for (const r of configData.remotes) {
    if (!r.remote) continue
    const bNames = await git.listBranches({ fs, dir: '/', remote: r.remote }).catch(() => [] as string[])
    if (!bNames.length && !r.url) continue

    if (r.url && !remoteSources.some((item) => item.name === r.remote)) {
      remoteSources.push({
        name: r.remote,
        url: r.url,
        isPrivate: isPrivateRemote(r.url),
      })
      if (!remoteUrl || r.remote === 'origin') {
        remoteUrl = r.url
      }
    }

    const resolvedTips = await Promise.all(
      bNames.map(async (b) => {
        if (!b || b === 'HEAD') return null
        const tip = await git.resolveRef({ fs, dir: '/', ref: `refs/remotes/${r.remote}/${b}` }).catch(() => '')
        return { name: `${r.remote}/${b}`, remote: r.remote, branch: b, tip }
      })
    )

    for (const item of resolvedTips) {
      if (item && !remotes.some((existing) => existing.name === item.name)) {
        remotes.push(item)
      }
    }
  }

  return { currentBranch, headOid, branches, tags, remotes, remoteSources, remoteUrl }
}

/** Checkout an existing ref while preserving reader object cache and refreshing worktree state. */
export async function checkoutEdgeBranch(reader: EdgeRepositoryReader, branch: string): Promise<{ ok: boolean; message: string }> {
  try {
    await git.checkout({ fs: reader.fs, dir: '/', ref: branch, cache: reader.cache })
    reader.invalidateWorktree()
    return { ok: true, message: `Switched to ${branch}` }
  } catch (err) {
    throw new Error(`Failed to checkout branch: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Create a branch without discarding reader caches unless checkout alters working tree files. */
export async function createEdgeBranch(reader: EdgeRepositoryReader, branch: string, startPoint?: string, checkout = true): Promise<{ ok: boolean; message: string }> {
  try {
    await git.branch({ fs: reader.fs, dir: '/', ref: branch, object: startPoint, checkout })
    if (checkout) {
      reader.invalidateWorktree()
    }
    return { ok: true, message: `Created branch ${branch}` }
  } catch (err) {
    throw new Error(`Failed to create branch: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Delete a local branch without resetting pack/object or worktree caches. */
export async function deleteEdgeBranch(reader: EdgeRepositoryReader, branch: string): Promise<{ ok: boolean; message: string }> {
  try {
    await git.deleteBranch({ fs: reader.fs, dir: '/', ref: branch })
    return { ok: true, message: `Deleted branch ${branch}` }
  } catch (error) {
    throw new Error(`Failed to delete branch: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Create a tag without discarding repository reader caches. */
export async function createEdgeTag(reader: EdgeRepositoryReader, tag: string, options?: { target?: string; message?: string }): Promise<{ ok: boolean; message: string }> {
  try {
    await git.tag({ fs: reader.fs, dir: '/', ref: tag, object: options?.target })
    return { ok: true, message: `Created tag ${tag}` }
  } catch (err) {
    throw new Error(`Failed to create tag: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Delete a tag without discarding repository reader caches. */
export async function deleteEdgeTag(reader: EdgeRepositoryReader, tag: string): Promise<{ ok: boolean; message: string }> {
  try {
    await git.deleteTag({ fs: reader.fs, dir: '/', ref: tag })
    return { ok: true, message: `Deleted tag ${tag}` }
  } catch (err) {
    throw new Error(`Failed to delete tag: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** List configured remotes from `.git/config` using the cached handle filesystem. */
export async function listEdgeRemotes(reader: EdgeRepositoryReader): Promise<GitRemoteSource[]> {
  const { remotes } = await readGitConfigData(reader.fs)
  return remotes.map((r) => ({
    name: r.remote,
    url: r.url,
    isPrivate: isPrivateRemote(r.url),
  }))
}

/** Look up a single remote URL from `.git/config`. */
export async function getEdgeRemoteUrl(reader: EdgeRepositoryReader, remote: string): Promise<string> {
  const { remotes } = await readGitConfigData(reader.fs)
  return remotes.find((r) => r.remote === remote)?.url || ''
}

export async function addEdgeRemote(reader: EdgeRepositoryReader, name: string, url: string): Promise<{ ok: boolean; message: string }> {
  try {
    await git.addRemote({ fs: reader.fs, dir: '/', remote: name, url, force: true })
    return { ok: true, message: `Added remote ${name}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to add remote' }
  }
}

export async function setEdgeRemoteUrl(reader: EdgeRepositoryReader, remote: string, url: string): Promise<{ ok: boolean; message: string }> {
  try {
    await git.deleteRemote({ fs: reader.fs, dir: '/', remote }).catch(() => {})
    await git.addRemote({ fs: reader.fs, dir: '/', remote, url, force: true })
    return { ok: true, message: `Updated remote ${remote}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to update remote' }
  }
}

export async function renameEdgeRemote(reader: EdgeRepositoryReader, oldName: string, newName: string): Promise<{ ok: boolean; message: string }> {
  try {
    const url = await getEdgeRemoteUrl(reader, oldName)
    if (!url) throw new Error(`Remote not found: ${oldName}`)
    await git.deleteRemote({ fs: reader.fs, dir: '/', remote: oldName })
    await git.addRemote({ fs: reader.fs, dir: '/', remote: newName, url, force: true })
    return { ok: true, message: `Renamed remote to ${newName}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to rename remote' }
  }
}

export async function removeEdgeRemote(reader: EdgeRepositoryReader, remote: string): Promise<{ ok: boolean; message: string }> {
  try {
    await git.deleteRemote({ fs: reader.fs, dir: '/', remote })
    return { ok: true, message: `Removed remote ${remote}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to remove remote' }
  }
}
