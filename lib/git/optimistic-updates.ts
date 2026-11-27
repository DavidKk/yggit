import type { GitBranch, GitCommit, GitLogView, GitProjectCatalog, GitProjectView, GitTag } from './types'

export type OptimisticGraphState = {
  view: GitLogView
  commits: GitCommit[]
}

function findCurrentBranchTip(view: GitLogView): string {
  const currentBranch = view.branches.find((b) => b.current || b.name === view.branch)
  if (currentBranch?.tip) return currentBranch.tip
  if (/^[0-9a-f]{7,40}$/i.test(view.head)) return view.head
  return ''
}

function resolveTargetHash(state: OptimisticGraphState, target?: string): string {
  const trimmed = target?.trim()
  if (!trimmed || trimmed === 'HEAD') {
    return findCurrentBranchTip(state.view) || state.commits[0]?.hash || state.view.head || ''
  }
  const exactBranch = state.view.branches.find((b) => b.name === trimmed)
  if (exactBranch?.tip) return exactBranch.tip
  const exactTag = state.view.tags.find((t) => t.name === trimmed)
  if (exactTag?.tip) return exactTag.tip
  const exactRemote = state.view.remotes.find((r) => r.name === trimmed)
  if (exactRemote?.tip) return exactRemote.tip
  const matchedCommit = state.commits.find((c) => c.hash === trimmed || (trimmed.length >= 6 && c.hash.startsWith(trimmed)))
  return matchedCommit?.hash || trimmed
}

function addRefToCommit(commits: GitCommit[], targetHash: string, refLabel: string): GitCommit[] {
  if (!targetHash) return commits
  return commits.map((commit) => {
    const matches = commit.hash === targetHash || (targetHash.length >= 6 && commit.hash.startsWith(targetHash)) || commit.hash.startsWith(targetHash)
    if (!matches) return commit
    if (commit.refs.includes(refLabel)) return commit
    return { ...commit, refs: [...commit.refs, refLabel] }
  })
}

function removeRefFromCommits(commits: GitCommit[], predicate: (ref: string) => boolean): GitCommit[] {
  let changed = false
  const next = commits.map((commit) => {
    const filtered = commit.refs.filter((ref) => !predicate(ref))
    if (filtered.length === commit.refs.length) return commit
    changed = true
    return { ...commit, refs: filtered }
  })
  return changed ? next : commits
}

/**
 * Optimistically apply tag creation to `view.tags` and the target commit's `refs`.
 */
export function applyOptimisticTagCreate(state: OptimisticGraphState, tagName: string, target?: string): OptimisticGraphState {
  const cleanName = tagName.trim()
  if (!cleanName) return state
  const tip = resolveTargetHash(state, target)
  const existingIndex = state.view.tags.findIndex((t) => t.name === cleanName)
  const nextTag: GitTag = { name: cleanName, tip }
  const nextTags = existingIndex >= 0 ? state.view.tags.map((item, idx) => (idx === existingIndex ? nextTag : item)) : [...state.view.tags, nextTag]

  const cleanedCommits = removeRefFromCommits(state.commits, (ref) => ref === `tag: ${cleanName}`)
  const nextCommits = addRefToCommit(cleanedCommits, tip, `tag: ${cleanName}`)

  return {
    view: { ...state.view, tags: nextTags },
    commits: nextCommits,
  }
}

/**
 * Optimistically remove a tag from `view.tags` and all commit `refs`.
 */
export function applyOptimisticTagDelete(state: OptimisticGraphState, tagName: string): OptimisticGraphState {
  const cleanName = tagName.trim()
  if (!cleanName) return state
  const nextTags = state.view.tags.filter((t) => t.name !== cleanName)
  const nextCommits = removeRefFromCommits(state.commits, (ref) => ref === `tag: ${cleanName}`)
  return {
    view: { ...state.view, tags: nextTags },
    commits: nextCommits,
  }
}

/**
 * Optimistically add a newly created local branch (typically when created without checkout)
 * to `view.branches` and the target commit's `refs`.
 */
export function applyOptimisticBranchCreate(state: OptimisticGraphState, branchName: string, startPoint?: string, checkout = false): OptimisticGraphState {
  const cleanName = branchName.trim()
  if (!cleanName || state.view.branches.some((b) => b.name === cleanName)) {
    return state
  }
  const tip = resolveTargetHash(state, startPoint)
  const createdBranch: GitBranch = {
    name: cleanName,
    upstream: '',
    current: checkout,
    tip,
  }
  const nextBranches = checkout ? [...state.view.branches.map((b) => ({ ...b, current: false })), createdBranch] : [...state.view.branches, createdBranch]

  let nextCommits = state.commits
  if (checkout) {
    const previousBranch = state.view.branch || state.view.head
    nextCommits = removeRefFromCommits(nextCommits, (ref) => ref === 'HEAD' || ref.startsWith('HEAD -> '))
    if (previousBranch) {
      const prevBranchEntry = state.view.branches.find((b) => b.name === previousBranch)
      if (prevBranchEntry?.tip) {
        nextCommits = addRefToCommit(nextCommits, prevBranchEntry.tip, previousBranch)
      }
    }
    nextCommits = addRefToCommit(nextCommits, tip, `HEAD -> ${cleanName}`)
  } else {
    nextCommits = addRefToCommit(nextCommits, tip, cleanName)
  }

  return {
    view: {
      ...state.view,
      head: checkout ? cleanName : state.view.head,
      branch: checkout ? cleanName : state.view.branch,
      branches: nextBranches,
    },
    commits: nextCommits,
  }
}

/**
 * Optimistically remove a local branch from `view.branches` and commit `refs`.
 */
export function applyOptimisticBranchDelete(state: OptimisticGraphState, branchName: string): OptimisticGraphState {
  const cleanName = branchName.trim()
  if (!cleanName) return state
  const nextBranches = state.view.branches.filter((b) => b.name !== cleanName)
  const nextCommits = removeRefFromCommits(state.commits, (ref) => ref === cleanName || ref === `HEAD -> ${cleanName}`)
  return {
    view: { ...state.view, branches: nextBranches },
    commits: nextCommits,
  }
}

function resolvePrimaryRemoteUrl(sources: NonNullable<GitLogView['remoteSources']>, currentUrl?: string): string | undefined {
  const origin = sources.find((s) => s.name === 'origin')
  if (origin?.url) return origin.url
  if (sources[0]?.url) return sources[0].url
  return currentUrl && sources.some((s) => s.url === currentUrl) ? currentUrl : undefined
}

/**
 * Optimistically add a remote entry to `view.remoteSources` and derive `view.remoteUrl`.
 */
export function applyOptimisticRemoteAdd(view: GitLogView, name: string, pullUrl: string): GitLogView {
  const cleanName = name.trim()
  const cleanUrl = pullUrl.trim()
  if (!cleanName || !cleanUrl) return view
  const existingSources = view.remoteSources || []
  const nextSources = existingSources.some((s) => s.name === cleanName)
    ? existingSources.map((s) => (s.name === cleanName ? { ...s, url: cleanUrl } : s))
    : [...existingSources, { name: cleanName, url: cleanUrl }]
  return {
    ...view,
    remoteSources: nextSources,
    remoteUrl: resolvePrimaryRemoteUrl(nextSources, view.remoteUrl),
  }
}

/**
 * Optimistically rename or update the URL of an existing remote in `view` and `commits`.
 */
export function applyOptimisticRemoteUpdate(state: OptimisticGraphState, oldName: string, newName: string, newUrl: string): OptimisticGraphState {
  const cleanOld = oldName.trim()
  const cleanNew = newName.trim()
  const cleanUrl = newUrl.trim()
  if (!cleanOld || !cleanNew) return state

  const existingSources = state.view.remoteSources || []
  const hasOld = existingSources.some((s) => s.name === cleanOld)
  const nextSources = hasOld
    ? existingSources.map((s) => (s.name === cleanOld ? { ...s, name: cleanNew, url: cleanUrl } : s))
    : [...existingSources, { name: cleanNew, url: cleanUrl }]

  const nextRemotes = state.view.remotes.map((r) => {
    if (r.remote !== cleanOld) return r
    const suffix = r.branch || (r.name.startsWith(`${cleanOld}/`) ? r.name.slice(cleanOld.length + 1) : r.name)
    return {
      ...r,
      remote: cleanNew,
      branch: suffix,
      name: cleanNew === cleanOld ? r.name : `${cleanNew}/${suffix}`,
    }
  })

  const nextCommits =
    cleanOld === cleanNew
      ? state.commits
      : state.commits.map((commit) => {
          const prefix = `${cleanOld}/`
          if (!commit.refs.some((ref) => ref.startsWith(prefix))) return commit
          return {
            ...commit,
            refs: commit.refs.map((ref) => (ref.startsWith(prefix) ? `${cleanNew}/${ref.slice(prefix.length)}` : ref)),
          }
        })

  return {
    view: {
      ...state.view,
      remoteSources: nextSources,
      remotes: nextRemotes,
      remoteUrl: resolvePrimaryRemoteUrl(nextSources, state.view.remoteUrl),
    },
    commits: nextCommits,
  }
}

/**
 * Optimistically remove a remote source and all its tracking branches from `view` and `commits`.
 */
export function applyOptimisticRemoteRemove(state: OptimisticGraphState, remoteName: string): OptimisticGraphState {
  const cleanName = remoteName.trim()
  if (!cleanName) return state
  const nextSources = (state.view.remoteSources || []).filter((s) => s.name !== cleanName)
  const nextRemotes = state.view.remotes.filter((r) => r.remote !== cleanName)
  const prefix = `${cleanName}/`
  const nextCommits = removeRefFromCommits(state.commits, (ref) => ref.startsWith(prefix))
  return {
    view: {
      ...state.view,
      remoteSources: nextSources,
      remotes: nextRemotes,
      remoteUrl: resolvePrimaryRemoteUrl(nextSources, undefined),
    },
    commits: nextCommits,
  }
}

/**
 * Incrementally prepend an acknowledged non-amend commit to the loaded history head
 * and advance the active branch ref without waiting for a full log reload.
 */
export function applyIncrementalCommitSuccess(
  state: OptimisticGraphState,
  params: {
    hash?: string
    subject: string
    remainingFilesCount?: number
  }
): OptimisticGraphState {
  const hash = params.hash?.trim()
  if (!hash || state.commits.some((c) => c.hash === hash)) {
    return state
  }

  const currentBranch = state.view.branch || state.view.head
  const headBranch = state.view.branches.find((b) => b.current || b.name === currentBranch)
  const prevHead = state.commits.find((c) => c.refs.some((r) => r === 'HEAD' || r.startsWith('HEAD -> '))) || state.commits[0]
  const parentHash = headBranch?.tip || prevHead?.hash || ''

  const cleanedCommits = state.commits.map((commit) => {
    const isParent = parentHash ? commit.hash === parentHash : commit.refs.some((r) => r === 'HEAD' || r.startsWith('HEAD -> '))
    if (!isParent) return commit
    const filteredRefs = commit.refs.filter((r) => r !== 'HEAD' && r !== `HEAD -> ${currentBranch}` && r !== currentBranch)
    return filteredRefs.length === commit.refs.length ? commit : { ...commit, refs: filteredRefs }
  })

  const newCommit: GitCommit = {
    hash,
    short: hash.slice(0, 7),
    parents: parentHash ? [parentHash] : [],
    author: prevHead?.author || '',
    date: new Date().toISOString(),
    refs: currentBranch && currentBranch !== 'HEAD' ? [`HEAD -> ${currentBranch}`] : ['HEAD'],
    subject: params.subject,
  }

  const nextBranches = state.view.branches.map((branch) => {
    if (branch.name !== currentBranch && !branch.current) return branch
    return {
      ...branch,
      tip: hash,
      ahead: typeof branch.ahead === 'number' && branch.upstream ? branch.ahead + 1 : branch.ahead,
    }
  })

  const remaining = params.remainingFilesCount
  const nextWorktree =
    remaining === 0
      ? null
      : typeof remaining === 'number' && state.view.worktree
        ? { ...state.view.worktree, files: remaining }
        : remaining === undefined
          ? null
          : state.view.worktree

  return {
    view: {
      ...state.view,
      branches: nextBranches,
      worktree: nextWorktree,
    },
    commits: [newCommit, ...cleanedCommits],
  }
}

/** Optimistically create a project folder in the catalog. */
export function applyOptimisticCreateFolder(catalog: GitProjectCatalog, name: string): GitProjectCatalog {
  const cleanName = name.trim()
  if (!cleanName || catalog.folders.includes(cleanName)) return catalog
  return {
    ...catalog,
    folders: [...catalog.folders, cleanName],
  }
}

/** Optimistically rename a project folder and update member `project.group` references. */
export function applyOptimisticRenameFolder(catalog: GitProjectCatalog, oldName: string, newName: string): GitProjectCatalog {
  const cleanOld = oldName.trim()
  const cleanNew = newName.trim()
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) return catalog
  const seen = new Set<string>()
  const nextFolders: string[] = []
  for (const folder of catalog.folders) {
    const mapped = folder === cleanOld ? cleanNew : folder
    if (!seen.has(mapped)) {
      seen.add(mapped)
      nextFolders.push(mapped)
    }
  }
  return {
    folders: nextFolders,
    projects: catalog.projects.map((p) => (p.group === cleanOld ? { ...p, group: cleanNew } : p)),
  }
}

/** Optimistically clear a folder by ungrouping all member projects. */
export function applyOptimisticClearFolder(catalog: GitProjectCatalog, name: string): GitProjectCatalog {
  const cleanName = name.trim()
  if (!cleanName) return catalog
  return {
    ...catalog,
    projects: catalog.projects.map((p) => (p.group === cleanName ? { ...p, group: '' } : p)),
  }
}

/** Optimistically delete a folder and remove all member projects inside it. */
export function applyOptimisticDeleteFolder(catalog: GitProjectCatalog, name: string): { catalog: GitProjectCatalog; removedCount: number } {
  const cleanName = name.trim()
  if (!cleanName) return { catalog, removedCount: 0 }
  let removedCount = 0
  const nextProjects: GitProjectView[] = []
  for (const project of catalog.projects) {
    if (project.group === cleanName) {
      removedCount += 1
    } else {
      nextProjects.push(project)
    }
  }
  return {
    catalog: {
      folders: catalog.folders.filter((f) => f !== cleanName),
      projects: nextProjects,
    },
    removedCount,
  }
}

/** Optimistically move or reorder a project within or between groups. */
export function applyOptimisticMoveProject(catalog: GitProjectCatalog, id: string, group: string, beforeId?: string): GitProjectCatalog {
  const idx = catalog.projects.findIndex((p) => p.id === id)
  if (idx < 0) return catalog
  const moved: GitProjectView = { ...catalog.projects[idx], group }
  const withoutMoved = catalog.projects.filter((p) => p.id !== id)
  const insertAt = beforeId ? withoutMoved.findIndex((p) => p.id === beforeId) : -1
  const nextProjects = insertAt >= 0 ? [...withoutMoved.slice(0, insertAt), moved, ...withoutMoved.slice(insertAt)] : [...withoutMoved, moved]

  const nextFolders = group && !catalog.folders.includes(group) ? [...catalog.folders, group] : catalog.folders
  return {
    folders: nextFolders,
    projects: nextProjects,
  }
}

/** Optimistically update a project's custom alias/label in the catalog. */
export function applyOptimisticSetProjectLabel(catalog: GitProjectCatalog, id: string, label: string): GitProjectCatalog {
  const cleanLabel = label.trim()
  return {
    ...catalog,
    projects: catalog.projects.map((p) => (p.id === id ? { ...p, label: cleanLabel || undefined } : p)),
  }
}

/** Optimistically remove a project from the catalog. */
export function applyOptimisticRemoveProject(catalog: GitProjectCatalog, id: string): GitProjectCatalog {
  return {
    ...catalog,
    projects: catalog.projects.filter((p) => p.id !== id),
  }
}
