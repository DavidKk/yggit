'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuChevronsUpDown, LuCompass, LuFileClock, LuFingerprint, LuFolderGit2, LuSettings, LuX } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { useAgentQuoteGlobalShortcut } from '@/components/git/agent/agentQuoteShortcut'
import { measurePanelFit } from '@/components/git/fitColumn'
import { CreateBranchModal, RenameBranchModal } from '@/components/git/GitBranchModal'
import { GitCommitPanel } from '@/components/git/GitCommitPanel'
import { GitDebug } from '@/components/git/GitDebug'
import { GitFileBlameView } from '@/components/git/GitFileBlameView'
import { GitFileDiff } from '@/components/git/GitFileDiff'
import { GitFileHistoryView } from '@/components/git/GitFileHistoryView'
import { GIT_FIND_EVENT, useGitFindShortcut } from '@/components/git/gitFind'
import { GitHistory } from '@/components/git/GitHistory'
import { GitMergePanel } from '@/components/git/GitMergePanel'
import { GitModeSwitcher } from '@/components/git/GitModeSwitcher'
import { GitProjectMenu } from '@/components/git/GitProjectMenu'
import { GitSidebar } from '@/components/git/GitSidebar'
import { GitToolbar } from '@/components/git/GitToolbar'
import { PanelSplitter } from '@/components/git/PanelSplitter'
import { useMergeConflicts } from '@/components/git/useMergeConflicts'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { useInWorkspaceHeader, WorkspaceHeaderSlot } from '@/components/layout/WorkspaceHeaderContext'
import { useNotification } from '@/components/notification/useNotification'
import { Button, EmptyState, Spinner, Tooltip } from '@/components/sk'
import { dropdownTriggerClass } from '@/components/sk/dropdownMenu'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { useOptionalAgent } from '@/lib/agent/agent-context'
import { useOptionalSpotlight } from '@/lib/agent/spotlight-context'
import { readApiErrorMessage } from '@/lib/api-error'
import { getDriverMode, getGitDriver, type GitDriverMode } from '@/lib/git/driver'
import type { AddRemoteProjectOptions } from '@/lib/git/driver/types'
import { isFileSystemAccessSupported } from '@/lib/git/indexeddb-handles'
import { saveLastGitUrl } from '@/lib/git/last-git-url'
import { areCommitListsEquivalent, hasGitLogViewMetadataChanged, reconcileCommitsPreservingRefs } from '@/lib/git/refresh-diff'
import { gitSelectionHash } from '@/lib/git/scope'
import { addTemporaryRepo, parseRemoteUrl } from '@/lib/git/temporary-store'
import {
  GIT_WORKTREE_COMMIT,
  GIT_WORKTREE_HASH,
  type GitCommit,
  type GitFileChange,
  type GitLogView,
  type GitProjectView,
  type GitRemoteCheck,
  type GitSelection,
  gitStashAsCommit,
} from '@/lib/git/types'
import { isPositiveNumber, readGitUiPref, repoPrefKey, useGitUiPref, useGitUiReady, writeGitUiPref } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'

function isGitSelection(value: unknown): value is GitSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as { kind?: unknown; name?: unknown; path?: unknown }
  if (item.kind === 'all') return true
  if (item.kind === 'local' || item.kind === 'remote' || item.kind === 'tag' || item.kind === 'stash') return typeof item.name === 'string'
  if (item.kind === 'worktree') return typeof item.path === 'string'
  return false
}

import { makeShareUrl, type RepositoryPersistence } from '@/lib/git/resolver'

type Props = {
  initial: GitLogView | { error: string; repo: string }
  initialCommitHash?: string
  initialFilePath?: string
  initialPersistence?: RepositoryPersistence
}

const SIDEBAR_MIN = 200
const TREE_MIN = 220
const MAIN_MIN = 240

function isError(value: Props['initial']): value is { error: string; repo: string } {
  return 'error' in value
}

function repoName(path: string, displayPath?: string): string {
  const target = displayPath || path
  const parts = target.split('/').filter(Boolean)
  return parts[parts.length - 1] || target
}

function selectionFor(view: GitLogView): GitSelection {
  const current = view.branches.find((branch) => branch.current) || view.branches.find((branch) => branch.name === view.branch)
  return current ? { kind: 'local', name: current.name } : { kind: 'all' }
}

function highlightOf(view: GitLogView, selection: GitSelection): string {
  if (selection.kind === 'local' || selection.kind === 'remote' || selection.kind === 'tag' || selection.kind === 'stash') return selection.name
  if (selection.kind === 'worktree') return view.worktrees.find((entry) => entry.path === selection.path)?.branch || ''
  return ''
}

export function GitLogPage({ initial, initialCommitHash, initialFilePath, initialPersistence: _initialPersistence }: Props) {
  const t = useT()
  const router = useRouter()
  const notification = useNotification()
  const failed = isError(initial)
  const [view, setView] = useState<GitLogView | null>(failed ? null : initial)
  const [error, setError] = useState(failed ? initial.error : '')
  const selectionRepo = failed ? '' : view?.repo || ('repo' in initial ? initial.repo : '')
  const selectionFallback: GitSelection = view ? selectionFor(view) : failed ? { kind: 'all' } : selectionFor(initial)
  const [selection, setSelection] = useGitUiPref(selectionRepo ? repoPrefKey(selectionRepo, 'selection') : 'git.selection.none', selectionFallback, isGitSelection)
  const [busy, setBusy] = useState(false)
  const [progressStage, setProgressStage] = useState('')
  const [picking, setPicking] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [projectSearchRequest, setProjectSearchRequest] = useState(0)
  const [projects, setProjects] = useState<GitProjectView[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [commits, setCommits] = useState<GitCommit[]>(failed ? [] : initial.commits)
  const [hasMore, setHasMore] = useState(failed ? false : initial.hasMore)
  const [hasPrev, setHasPrev] = useState(failed ? false : Boolean(initial.hasPrev))
  const [startIndex, setStartIndex] = useState<number>(failed ? 0 : (initial.startIndex ?? 0))
  const commitsRef = useRef<GitCommit[]>(commits)
  commitsRef.current = commits
  const startIndexRef = useRef<number>(startIndex)
  startIndexRef.current = startIndex
  const [focusRequest, setFocusRequest] = useState<{ hash: string } | null>(initialCommitHash ? { hash: initialCommitHash } : null)
  const [selectedHash, setSelectedHash] = useState(initialCommitHash || '')
  const [selectedFile, setSelectedFile] = useState(() => initialFilePath || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('file') || '' : ''))
  const [selectedStatus, setSelectedStatus] = useState('')
  const [fileDetailTab, setFileDetailTab] = useState<'diff' | 'history' | 'blame'>('diff')
  const [commitFiles, setCommitFiles] = useState<GitFileChange[]>([])

  const currentFileIndex = useMemo(() => {
    if (!commitFiles.length || !selectedFile) return -1
    return commitFiles.findIndex((f) => f.path === selectedFile)
  }, [commitFiles, selectedFile])

  const handlePrevFile = useCallback(() => {
    if (commitFiles.length <= 1 || currentFileIndex === -1) return
    const prevIdx = (currentFileIndex - 1 + commitFiles.length) % commitFiles.length
    const file = commitFiles[prevIdx]
    setSelectedFile(file.path)
    setSelectedStatus(file.status)
  }, [commitFiles, currentFileIndex])

  const handleNextFile = useCallback(() => {
    if (commitFiles.length <= 1 || currentFileIndex === -1) return
    const nextIdx = (currentFileIndex + 1) % commitFiles.length
    const file = commitFiles[nextIdx]
    setSelectedFile(file.path)
    setSelectedStatus(file.status)
  }, [commitFiles, currentFileIndex])
  const [lineageHashes, setLineageHashes] = useState<string[] | null>(null)
  const lineageSet = useMemo(() => (lineageHashes && lineageHashes.length > 0 ? new Set(lineageHashes) : null), [lineageHashes])
  const [sidebarWidth, setSidebarWidth] = useGitUiPref('layout.sidebarWidth', 256, isPositiveNumber)
  const [treeWidth, setTreeWidth] = useGitUiPref('layout.treeWidth', 320, isPositiveNumber)
  const [filePanel, setFilePanel] = useState<{ type: 'history' | 'blame'; path: string; hash?: string } | null>(null)
  const [remoteCheck] = useState<GitRemoteCheck | null>(null)
  const [soloBranch, setSoloBranch] = useState<string | null>(null)
  const [soloRemote, setSoloRemote] = useState<string | null>(null)
  const [hiddenRemotes, setHiddenRemotes] = useState<string[]>([])
  const [renameModal, setRenameModal] = useState<{ open: boolean; oldName: string }>({ open: false, oldName: '' })
  const [createBranchModal, setCreateBranchModal] = useState<{ open: boolean; startPoint?: string; currentBranch?: string }>({ open: false })
  const worldRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const projectFindRef = useRef<HTMLDivElement>(null)
  const historyScrollRef = useRef<HTMLDivElement | null>(null)
  useGitFindShortcut(worldRef)
  const inWorkspace = useInWorkspaceHeader()

  const { conflicts } = useMergeConflicts({
    repo: view?.repo,
    commits,
    selectedHash,
    loading: busy,
    scrollRef: historyScrollRef,
  })

  const [conflictViewActive, setConflictViewActive] = useState(false)

  const handleOpenConflictView = useCallback(
    (hash?: string, file?: string) => {
      if (hash) {
        setSelectedHash(hash)
        setFocusRequest({ hash })
      }
      const targetHash = hash || selectedHash
      const conflictRecord = conflicts[targetHash]
      const targetFile = file || (conflictRecord?.conflictFiles && conflictRecord.conflictFiles[0]) || ''
      if (targetFile) {
        setSelectedFile(targetFile)
        setSelectedStatus('M')
      }
      setConflictViewActive(true)
    },
    [selectedHash, conflicts]
  )

  const spotlight = useOptionalSpotlight()
  const agent = useOptionalAgent()
  useEffect(() => {
    if (view?.repo && agent?.setActiveRepo) {
      agent.setActiveRepo(view.repo)
    }
  }, [view?.repo, agent])
  useEffect(() => {
    if (spotlight?.registerNavigateHandler) {
      return spotlight.registerNavigateHandler((hash) => {
        setSelectedHash(hash)
        setFocusRequest({ hash })
      })
    }
  }, [spotlight])

  useEffect(() => {
    if (spotlight?.codeAnnotation) {
      const ann = spotlight.codeAnnotation
      if (ann.commitHash && ann.commitHash !== selectedHash) {
        setSelectedHash(ann.commitHash)
        setFocusRequest({ hash: ann.commitHash })
      }
      if (ann.file && ann.file !== selectedFile) {
        setSelectedFile(ann.file)
      }
    }
  }, [spotlight?.codeAnnotation, selectedHash, selectedFile])

  // 3-second hover timer for branch spotlight
  const [activeHoverBranch, setActiveHoverBranch] = useState<string | null>(null)
  const hoverBranchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBranchHoverStart = useCallback((branchName: string) => {
    if (!branchName) return
    if (hoverBranchTimerRef.current) clearTimeout(hoverBranchTimerRef.current)
    hoverBranchTimerRef.current = setTimeout(() => {
      setActiveHoverBranch(branchName)
    }, 1000)
  }, [])

  const handleBranchHoverEnd = useCallback(() => {
    if (hoverBranchTimerRef.current) {
      clearTimeout(hoverBranchTimerRef.current)
      hoverBranchTimerRef.current = null
    }
    setActiveHoverBranch(null)
  }, [])

  useEffect(() => {
    return () => {
      if (hoverBranchTimerRef.current) clearTimeout(hoverBranchTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const host = projectFindRef.current
    if (!host) return
    function onFind() {
      setMenuOpen(true)
      setProjectSearchRequest((tick) => tick + 1)
    }
    host.addEventListener(GIT_FIND_EVENT, onFind)
    return () => host.removeEventListener(GIT_FIND_EVENT, onFind)
  }, [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const scopeRef = useRef('')
  const onPage = useCallback((pageScope: string, next: GitCommit[], more: boolean, nextHasPrev?: boolean, nextStartIndex?: number) => {
    if (pageScope !== scopeRef.current) return
    setCommits(next)
    setHasMore(more)
    if (nextHasPrev !== undefined) setHasPrev(nextHasPrev)
    if (nextStartIndex !== undefined) setStartIndex(nextStartIndex)
  }, [])

  const handlePagePrepend = useCallback((newCommits: GitCommit[], nextHasPrev: boolean, nextStartIndex: number) => {
    setCommits((prev) => {
      const seen = new Set(prev.map((c) => c.hash))
      const uniqueNew = newCommits.filter((c) => !seen.has(c.hash))
      return [...uniqueNew, ...prev]
    })
    setHasPrev(nextHasPrev)
    setStartIndex(nextStartIndex)
  }, [])

  const applyCatalog = useCallback((body: { projects?: GitProjectView[]; folders?: string[] }) => {
    if (Array.isArray(body.projects)) setProjects(body.projects)
    if (Array.isArray(body.folders)) setFolders(body.folders)
  }, [])

  const refreshProjects = useCallback(async () => {
    try {
      const driver = getGitDriver()
      const catalog = await driver.getProjects()
      applyCatalog(catalog)
    } catch {
      if (getDriverMode() === 'local') {
        const response = await fetch('/api/git/projects')
        const body = (await response.json()) as { ok?: boolean; projects?: GitProjectView[]; folders?: string[] }
        if (response.ok && body.ok !== false) applyCatalog(body)
      }
    }
  }, [applyCatalog])

  useEffect(() => {
    void refreshProjects()
    async function onDriverModeChanged(e: Event) {
      const customEvent = e as CustomEvent<GitDriverMode | { mode: GitDriverMode; targetRepo?: string; targetUrl?: string }>
      const detail = customEvent.detail
      const targetRepo = typeof detail === 'object' && detail !== null ? detail.targetRepo : undefined
      const repoToReload = targetRepo || viewRef.current?.repo || ''

      await refreshProjects()

      if (repoToReload) {
        await load(repoToReload)
      }
    }
    window.addEventListener('yggit:driver_mode_changed', onDriverModeChanged)
    return () => window.removeEventListener('yggit:driver_mode_changed', onDriverModeChanged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshProjects, router])

  useEffect(() => {
    function onUiNavigate(e: Event) {
      const customEvent = e as CustomEvent<{ target: string }>
      const target = customEvent.detail?.target
      if (target === 'panel_commit') {
        setSelectedHash(GIT_WORKTREE_HASH)
        setSelectedFile('')
        setSelectedStatus('')
        setLineageHashes(null)
        setConflictViewActive(false)
      } else if (target === 'panel_conflicts') {
        setConflictViewActive(true)
      }
    }
    window.addEventListener('yggit:ui_navigate', onUiNavigate)
    return () => window.removeEventListener('yggit:ui_navigate', onUiNavigate)
  }, [])

  const viewRef = useRef(view)
  viewRef.current = view

  const selectedHashRef = useRef(selectedHash)
  selectedHashRef.current = selectedHash
  const selectedFileRef = useRef(selectedFile)
  selectedFileRef.current = selectedFile
  const filePanelRef = useRef(filePanel)
  filePanelRef.current = filePanel

  const silentRefreshingRef = useRef(false)
  const silentRefresh = useCallback(async () => {
    if (silentRefreshingRef.current || busy) return
    const currentRepo = viewRef.current?.repo
    if (!currentRepo) return

    silentRefreshingRef.current = true
    const activeScope = scopeRef.current
    try {
      const driver = getGitDriver()
      driver.clearCache?.(currentRepo)
      const next = await driver.readLog({
        repo: currentRepo,
        ref: activeScope && activeScope !== '*' ? activeScope : undefined,
      })
      if (viewRef.current?.repo !== currentRepo || scopeRef.current !== activeScope) return

      setView((prev) => {
        if (!prev) return next
        if (!hasGitLogViewMetadataChanged(prev, next)) return prev
        return {
          ...prev,
          head: next.head,
          branch: next.branch,
          branches: next.branches,
          remotes: next.remotes,
          tags: next.tags,
          stashes: next.stashes,
          worktrees: next.worktrees,
          submodules: next.submodules,
          marks: next.marks,
          worktree: next.worktree,
        }
      })

      if (startIndexRef.current === 0) {
        if (commitsRef.current.length <= next.commits.length) {
          if (!areCommitListsEquivalent(commitsRef.current, next.commits)) {
            setCommits((prev) => reconcileCommitsPreservingRefs(prev, next.commits))
            setHasMore(next.hasMore)
            setHasPrev(Boolean(next.hasPrev))
            setStartIndex(next.startIndex ?? 0)
          }
        } else {
          setCommits((prev) => {
            if (prev.length <= next.commits.length) {
              return areCommitListsEquivalent(prev, next.commits) ? prev : next.commits
            }
            if (areCommitListsEquivalent(prev.slice(0, next.commits.length), next.commits)) {
              return prev
            }
            const freshHashes = new Set(next.commits.map((c) => c.hash))
            const tailHash = next.commits[next.commits.length - 1]?.hash
            const overlapIdx = tailHash ? prev.findIndex((c) => c.hash === tailHash) : -1
            if (overlapIdx >= 0) {
              const olderTail = prev.slice(overlapIdx + 1).filter((c) => !freshHashes.has(c.hash))
              return [...next.commits, ...olderTail]
            }
            const prevHashes = new Set(prev.map((c) => c.hash))
            const brandNew = next.commits.filter((c) => !prevHashes.has(c.hash))
            return brandNew.length > 0 ? [...brandNew, ...prev] : prev
          })
        }
      }

      const worktreeClean = !next.worktree || next.worktree.files === 0
      const isWorktree = selectedHashRef.current === GIT_WORKTREE_HASH || (!selectedHashRef.current && Boolean(viewRef.current?.worktree))
      if (worktreeClean && isWorktree) {
        if (selectedFileRef.current) {
          setSelectedFile('')
          setSelectedStatus('')
          setConflictViewActive(false)
        }
        const currentBranchName = next.head || next.branch || 'main'
        const currentBranchObj = next.branches.find((b) => b.name === currentBranchName || b.current)
        const headHash = currentBranchObj?.tip || next.commits.find((c) => c.refs.some((r) => r.includes(currentBranchName)))?.hash || next.commits[0]?.hash || ''
        if (headHash) {
          setSelectedHash(headHash)
          setSelection({ kind: 'local', name: currentBranchName })
        }
      }
    } catch {
      // Keep background revalidation non-intrusive
    } finally {
      silentRefreshingRef.current = false
    }
  }, [busy, setSelection])

  const lastFetchTimeRef = useRef<number>(0)
  const isFetchingRef = useRef<boolean>(false)

  const autoFetch = useCallback(
    async (force = false) => {
      const currentRepo = viewRef.current?.repo
      if (!currentRepo || isFetchingRef.current || busy) return
      const now = Date.now()
      // Throttle automatic network fetch to at most once every 45s unless forced
      if (!force && now - lastFetchTimeRef.current < 45_000) return

      isFetchingRef.current = true
      lastFetchTimeRef.current = now
      try {
        const driver = getGitDriver()
        await driver.fetch(currentRepo, { all: true, prune: true }).catch(() => {})
        await silentRefresh()
      } catch {
        // Silently ignore background fetch errors
      } finally {
        isFetchingRef.current = false
      }
    },
    [busy, silentRefresh]
  )

  const isMainOverview = !selectedFile && !filePanel && !conflictViewActive
  const isMainOverviewRef = useRef(isMainOverview)
  isMainOverviewRef.current = isMainOverview

  useEffect(() => {
    const repoName = view?.repo
    if (!repoName) return

    const IDLE_DELAY_MS = 8000
    const EDGE_POLL_MS = 15_000
    const REMOTE_FETCH_MS = 300_000 // 5 minutes

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let isIdle = process.env.NODE_ENV === 'test'
    let pendingWatchRefresh = false
    let eventSource: EventSource | null = null

    const flushPendingIfReady = () => {
      if (pendingWatchRefresh && isIdle && isMainOverviewRef.current && document.visibilityState === 'visible') {
        pendingWatchRefresh = false
        void silentRefresh()
      }
    }

    const scheduleIdle = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        isIdle = true
        flushPendingIfReady()
      }, IDLE_DELAY_MS)
    }

    const handleUserActivity = () => {
      isIdle = false
      scheduleIdle()
    }

    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const
    for (const evt of activityEvents) {
      window.addEventListener(evt, handleUserActivity, { capture: true, passive: true })
    }
    scheduleIdle()

    // 1. Initial background fetch 2s after repository is ready (only on main overview)
    const initTimer = setTimeout(() => {
      if (isMainOverviewRef.current) {
        void autoFetch()
      }
    }, 2000)

    // 2. Focus / Visibility trigger (only when on Branches + Commit Log main overview)
    const handleTrigger = () => {
      if (document.visibilityState !== 'visible' || !isMainOverviewRef.current) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (!isMainOverviewRef.current) return
        if (Date.now() - lastFetchTimeRef.current >= 45_000) {
          void autoFetch()
        } else {
          void silentRefresh()
        }
      }, 250)
    }

    window.addEventListener('focus', handleTrigger)
    document.addEventListener('visibilitychange', handleTrigger)

    // 3. Local mode: filesystem watcher via SSE; Edge mode: 15s idle polling
    const mode = getDriverMode()
    if (mode === 'local' && isMainOverview && typeof EventSource !== 'undefined') {
      eventSource = new EventSource(`/api/git/watch?repo=${encodeURIComponent(repoName)}`)
      eventSource.addEventListener('change', () => {
        if (document.visibilityState !== 'visible' || !isMainOverviewRef.current) return
        if (isIdle) {
          void silentRefresh()
        } else {
          pendingWatchRefresh = true
        }
      })
    }

    const edgePollInterval =
      mode === 'edge'
        ? window.setInterval(() => {
            if (document.visibilityState === 'visible' && isIdle && isMainOverviewRef.current) {
              void silentRefresh()
            }
          }, EDGE_POLL_MS)
        : null

    // 4. Remote autoFetch every 5 minutes (only when visible, idle, and on main overview)
    const fetchInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && isIdle && isMainOverviewRef.current) {
        void autoFetch()
      }
    }, REMOTE_FETCH_MS)

    return () => {
      clearTimeout(initTimer)
      if (debounceTimer) clearTimeout(debounceTimer)
      if (idleTimer) clearTimeout(idleTimer)
      if (edgePollInterval !== null) window.clearInterval(edgePollInterval)
      window.clearInterval(fetchInterval)
      if (eventSource) {
        eventSource.close()
      }
      for (const evt of activityEvents) {
        window.removeEventListener(evt, handleUserActivity, true)
      }
      window.removeEventListener('focus', handleTrigger)
      document.removeEventListener('visibilitychange', handleTrigger)
    }
  }, [silentRefresh, autoFetch, view?.repo, isMainOverview])

  function applyView(next: GitLogView) {
    const nextSelection = readGitUiPref(repoPrefKey(next.repo, 'selection'), isGitSelection) || selectionFor(next)
    setView(next)
    setSelection(nextSelection)
    setCommits(next.commits)
    setHasMore(next.hasMore)
    setHasPrev(Boolean(next.hasPrev))
    setStartIndex(next.startIndex ?? 0)
    setSelectedHash('')
    setSelectedFile('')
    setSelectedStatus('')
    setFocusRequest(null)
    setSoloBranch(null)
    setSoloRemote(null)
    writeGitUiPref(repoPrefKey(next.repo, 'sectionQueries'), {})
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('yggit:clear_searches', { detail: { repo: next.repo } }))
      const matchProject = projects.find((p) => p.localPath === next.repo || p.id === next.repo || (next.repo && p.localPath && next.repo.endsWith(p.localPath)))
      const remoteUrl = matchProject?.httpsUrl || next.remoteUrl || next.remoteSources?.find((r) => r.name === 'origin')?.url || next.remoteSources?.[0]?.url
      const canonical = makeShareUrl(remoteUrl || next.repo, { remoteUrl })
      const currentTarget = `${window.location.pathname}${window.location.search}`
      if (canonical && currentTarget !== canonical) {
        window.history.replaceState(window.history.state, '', canonical)
      }
    }
  }

  function select(next: GitSelection) {
    setSelection(next)
    let targetHash = view ? gitSelectionHash(view, next) : ''
    if (next.kind === 'worktree') {
      const entry = view?.worktrees.find((item) => item.path === next.path)
      if (entry?.current || next.path === view?.repo) {
        targetHash = GIT_WORKTREE_HASH
      }
    }
    if (!targetHash && (next.kind === 'local' || next.kind === 'remote' || next.kind === 'tag' || next.kind === 'stash')) {
      const hit = commits.find((c) =>
        c.refs.some(
          (r) =>
            r === next.name ||
            r === `HEAD -> ${next.name}` ||
            r === `tag: ${next.name}` ||
            r === `refs/heads/${next.name}` ||
            r === `refs/remotes/${next.name}` ||
            r.endsWith(`/${next.name}`)
        )
      )
      if (hit) targetHash = hit.hash
    }

    if (targetHash === GIT_WORKTREE_HASH) {
      if (startIndex > 0 && view?.repo) {
        void (async () => {
          try {
            const driver = getGitDriver()
            const res = await driver.readLog({ repo: view.repo, ref: scope, skip: 0, take: 50 })
            setCommits(res.commits)
            setHasMore(Boolean(res.hasMore))
            setHasPrev(false)
            setStartIndex(0)
            setSelectedHash(GIT_WORKTREE_HASH)
            setSelectedFile('')
            setSelectedStatus('')
            setLineageHashes(null)
            setConflictViewActive(false)
          } catch {}
        })()
        return
      }
      setSelectedHash(GIT_WORKTREE_HASH)
      setSelectedFile('')
      setSelectedStatus('')
      setLineageHashes(null)
      setConflictViewActive(false)
      return
    }

    if (targetHash) {
      const inWindow = commits.some((c) => c.hash === targetHash || c.hash.startsWith(targetHash))
      if (!inWindow && view?.repo) {
        void (async () => {
          try {
            const driver = getGitDriver()
            const res = await driver.readLog({
              repo: view.repo,
              ref: scope,
              locate: targetHash,
              take: 50,
            })
            if (res.commits.length > 0) {
              setCommits(res.commits)
              setHasMore(Boolean(res.hasMore))
              setHasPrev(Boolean(res.hasPrev))
              setStartIndex(res.startIndex ?? 0)
              setSelectedHash(targetHash)
              setSelectedFile('')
              setSelectedStatus('')
              setLineageHashes(null)
              setConflictViewActive(false)
              setFocusRequest({ hash: targetHash })
            }
          } catch {
            // Silently fallback if locate commit encounters an error
          }
        })()
        return
      }

      setSelectedHash(targetHash)
      setSelectedFile('')
      setSelectedStatus('')
      setLineageHashes(null)
      setConflictViewActive(false)
      setFocusRequest({ hash: targetHash })
    }
  }

  const scope = view ? '*' : ''
  const selectedStash = view?.stashes.find((item) => item.hash === selectedHash)
  const selected =
    selectedHash === GIT_WORKTREE_HASH
      ? GIT_WORKTREE_COMMIT
      : selectedStash
        ? gitStashAsCommit(selectedStash)
        : commits.find((commit) => commit.hash === selectedHash || (selectedHash && selectedHash.length >= 6 && commit.hash.startsWith(selectedHash))) || null
  const selectedIsWorktree = selectedHash === GIT_WORKTREE_HASH

  const handleLocateCommit = useCallback(
    async (commitHash: string) => {
      if (!commitHash) return
      setFilePanel(null)
      setSelectedFile('')
      setSelectedStatus('')
      setConflictViewActive(false)
      setLineageHashes(null)
      setSelectedHash(commitHash)
      setFocusRequest({ hash: commitHash })

      if (!view?.repo) return
      const clean = commitHash.trim().toLowerCase()
      const inWindow = commits.some((c) => c.hash.toLowerCase() === clean || c.short.toLowerCase() === clean || c.hash.toLowerCase().startsWith(clean))

      if (!inWindow) {
        try {
          const driver = getGitDriver()
          let res = await driver
            .readLog({
              repo: view.repo,
              ref: scope,
              locate: commitHash,
              take: 50,
            })
            .catch(() => null)

          if (!res || !res.commits || res.commits.length === 0) {
            res = await driver
              .readLog({
                repo: view.repo,
                locate: commitHash,
                take: 50,
              })
              .catch(() => null)
          }

          if (res && res.commits && res.commits.length > 0) {
            setCommits(res.commits)
            setHasMore(Boolean(res.hasMore))
            setHasPrev(Boolean(res.hasPrev))
            setStartIndex(res.startIndex ?? 0)
            setSelectedHash(commitHash)
            setFocusRequest({ hash: commitHash })
          }
        } catch {}
      }
    },
    [commits, scope, view?.repo]
  )

  const handleCommitFilesLoaded = useCallback(
    (files: GitFileChange[]) => {
      setCommitFiles(files)
      if (selectedIsWorktree) {
        if (files.length === 0) {
          setSelectedFile('')
          setSelectedStatus('')
          setConflictViewActive(false)
          const currentBranchName = viewRef.current?.head || viewRef.current?.branch || 'main'
          const currentBranchObj = viewRef.current?.branches.find((b) => b.name === currentBranchName || b.current)
          const headHash = currentBranchObj?.tip || commits.find((c) => c.refs.some((r) => r.includes(currentBranchName)))?.hash || commits[0]?.hash || ''
          if (headHash) {
            setSelectedHash(headHash)
            setSelection({ kind: 'local', name: currentBranchName })
          }
        } else if (selectedFile && !files.some((f) => f.path === selectedFile)) {
          setSelectedFile('')
          setSelectedStatus('')
          setConflictViewActive(false)
        }
        setView((prev) => {
          if (!prev) return prev
          if (files.length === 0) {
            if (prev.worktree === null) return prev
            return { ...prev, worktree: null }
          }
          let added = 0
          let deleted = 0
          let modified = 0
          for (const f of files) {
            if (f.status === 'A' || f.status === '?' || f.status === 'U') added++
            else if (f.status === 'D') deleted++
            else modified++
          }
          return {
            ...prev,
            worktree: {
              files: files.length,
              insertions: prev.worktree?.insertions ?? 0,
              deletions: prev.worktree?.deletions ?? 0,
              addedFiles: added,
              deletedFiles: deleted,
              modifiedFiles: modified,
            },
          }
        })
      }
    },
    [selectedIsWorktree, selectedFile, commits, setSelection]
  )
  const sidebarWidthRef = useRef(sidebarWidth)
  const treeWidthRef = useRef(treeWidth)
  const selectedRef = useRef(!!selected)
  selectedRef.current = !!selected
  selectedFileRef.current = selectedFile
  const prefsReady = useGitUiReady()
  // Avoid SSR inline defaults overwriting GitUiBootScript vars before hydrate.
  const frameStyle = (
    prefsReady
      ? {
          ['--git-sidebar-w']: `${sidebarWidth}px`,
          ['--git-tree-w']: `${treeWidth}px`,
        }
      : {}
  ) as CSSProperties

  useEffect(() => {
    document.documentElement.style.setProperty('--git-sidebar-w', `${sidebarWidth}px`)
    document.documentElement.style.setProperty('--git-tree-w', `${treeWidth}px`)
  }, [sidebarWidth, treeWidth])

  useEffect(() => {
    if (view && view.repo) {
      const parsed = parseRemoteUrl(view.repo)
      if (parsed) {
        const isSaved = projects.some((p) => (p.httpsUrl && p.httpsUrl === parsed.remoteUrl) || p.name === parsed.name)
        if (!isSaved) {
          addTemporaryRepo(parsed)
        }
      }
    }
  }, [view, projects])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const targetUrl = params.get('url') || params.get('repo')
    if (targetUrl) {
      const parsed = parseRemoteUrl(targetUrl)
      if (parsed) {
        const existing = projects.find((p) => (p.httpsUrl && p.httpsUrl === parsed.remoteUrl) || p.name === parsed.name)
        if (existing?.localPath) {
          void load(existing.localPath)
        } else {
          addTemporaryRepo(parsed)
          void load(parsed.remoteUrl)
        }
      } else {
        // Local repo path or Edge handle name
        void load(targetUrl)
      }
    } else if (getDriverMode() === 'edge') {
      const pathParts = window.location.pathname.split('/').filter(Boolean)
      if (pathParts[0] === 'repo' && pathParts[1]) {
        void load(pathParts[1])
      } else if (pathParts[0] === 'git' && pathParts.length > 1) {
        const repoName = pathParts.slice(1).join('/')
        void load(repoName)
      } else if (view?.repo && view.repo.startsWith('/')) {
        const name = view.displayPath || repoName(view.repo)
        if (name) void load(name)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !view?.repo) return
    const canonicalUrl = makeShareUrl(view.repo, {
      hash: selectedHash || undefined,
      remoteUrl: view.remoteUrl,
      file: selectedFile || undefined,
    })
    saveLastGitUrl(canonicalUrl)
    const current = window.location.pathname + window.location.search
    if (current !== canonicalUrl) {
      window.history.replaceState(window.history.state, '', canonicalUrl)
    }
  }, [selectedHash, selectedFile, view?.repo, view?.remoteUrl])

  useAgentQuoteGlobalShortcut({
    repo: view?.repo,
    currentBranch: view?.branch,
    selectedHash,
    selectedFile,
    selectedStatus,
    commits,
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (busy) return
      if (event.key !== 'Escape') return
      if (event.defaultPrevented) return

      if (menuOpen) return

      if (filePanelRef.current) {
        event.preventDefault()
        setFilePanel(null)
        return
      }

      if (selectedFileRef.current) {
        event.preventDefault()
        setSelectedFile('')
        setSelectedStatus('')
        return
      }

      if (selectedRef.current) {
        event.preventDefault()
        setSelectedHash('')
        setSelectedFile('')
        setSelectedStatus('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, busy])
  const limitWidth = useCallback((next: number, other: number, min: number) => {
    const total = frameRef.current?.clientWidth ?? next + other + MAIN_MIN
    const max = Math.max(min, total - other - MAIN_MIN)
    return Math.min(max, Math.max(min, next))
  }, [])
  const applySidebar = useCallback(
    (next: number) => {
      const width = limitWidth(next, selectedRef.current ? treeWidthRef.current : 0, SIDEBAR_MIN)
      sidebarWidthRef.current = width
      frameRef.current?.style.setProperty('--git-sidebar-w', `${width}px`)
      return width
    },
    [limitWidth]
  )
  const applyTree = useCallback(
    (next: number) => {
      const width = limitWidth(next, selectedFileRef.current ? 0 : sidebarWidthRef.current, TREE_MIN)
      treeWidthRef.current = width
      frameRef.current?.style.setProperty('--git-tree-w', `${width}px`)
      return width
    },
    [limitWidth]
  )
  const resizeSidebar = useCallback(
    (delta: number) => {
      applySidebar(sidebarWidthRef.current + delta)
    },
    [applySidebar]
  )
  const resizeTree = useCallback(
    (delta: number) => {
      applyTree(treeWidthRef.current - delta)
    },
    [applyTree]
  )
  const commitSidebar = useCallback(() => setSidebarWidth(sidebarWidthRef.current), [setSidebarWidth])
  const commitTree = useCallback(() => setTreeWidth(treeWidthRef.current), [setTreeWidth])
  const fitSidebar = useCallback(() => {
    const panel = frameRef.current?.querySelector('[data-git-sidebar]') as HTMLElement | null
    if (!panel) return
    const fitted = Math.max(SIDEBAR_MIN, measurePanelFit(panel, '[data-git-sidebar-label]', 16))
    setSidebarWidth(applySidebar(fitted))
  }, [applySidebar, setSidebarWidth])
  const fitTree = useCallback(() => {
    const panel = frameRef.current?.querySelector('[data-git-tree]') as HTMLElement | null
    if (!panel) return
    const fitted = Math.max(TREE_MIN, measurePanelFit(panel, '[data-git-tree-label]', 20))
    setTreeWidth(applyTree(fitted))
  }, [applyTree, setTreeWidth])
  scopeRef.current = scope

  async function load(repo: string) {
    if (!repo || !repo.trim()) {
      setView(null)
      setCommits([])
      setHasMore(false)
      setSelection({ kind: 'all' })
      setSelectedHash('')
      setSelectedFile('')
      setError('')
      setBusy(false)
      setProgressStage('')
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('repo')
        url.searchParams.delete('url')
        url.searchParams.delete('hash')
        url.searchParams.delete('file')
        window.history.replaceState(null, '', url.pathname.includes('/git') ? '/git' : url.pathname)
      }
      return
    }
    setBusy(true)
    setError('')
    setProgressStage('正在准备加载项目...')
    try {
      const driver = getGitDriver()
      const body = await driver.readLog({
        repo,
        onProgress: (stage) => setProgressStage(stage),
      })
      applyView(body)
    } catch (loadError) {
      setView(null)
      setCommits([])
      setHasMore(false)
      setSelection({ kind: 'all' })
      setSelectedHash('')
      setSelectedFile('')
      setError(loadError instanceof Error ? loadError.message : t('git.errors.readGit'))
    } finally {
      setBusy(false)
      setProgressStage('')
    }
  }

  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    function onOpenProject(e: Event) {
      const customEvent = e as CustomEvent<{ target: string; url: string }>
      const target = customEvent.detail?.target
      if (target) {
        void loadRef.current(target)
      }
    }
    window.addEventListener('yggit:open_project', onOpenProject)
    return () => window.removeEventListener('yggit:open_project', onOpenProject)
  }, [])

  async function pickFolders(prompt: string, multiple = false) {
    setPicking(true)
    try {
      const response = await fetch('/api/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'folder', prompt, multiple }),
      })
      const body = (await response.json()) as { ok?: boolean; path?: string; paths?: string[]; cancelled?: boolean }
      if (body.cancelled) return [] as string[]
      const paths = Array.isArray(body.paths)
        ? body.paths.map((item) => String(item || '').trim()).filter(Boolean)
        : String(body.path || '').trim()
          ? [String(body.path).trim()]
          : []
      if (!response.ok || body.ok === false || paths.length === 0) {
        setError(readApiErrorMessage(body, t('git.errors.openFolder')))
        return [] as string[]
      }
      return paths
    } catch {
      setError(t('git.errors.openFolder'))
      return [] as string[]
    } finally {
      setPicking(false)
    }
  }

  async function pickFolder(prompt: string) {
    const paths = await pickFolders(prompt, false)
    return paths[0] || ''
  }

  const handleAddWorktree = useCallback(async () => {
    if (!view?.repo) return
    const defaultWt = `../${view.repo.split(/[/\\]/).filter(Boolean).pop()}_wt`
    const inputPath = window.prompt('请输入新 Worktree 目录路径（支持相对当前仓库或绝对路径）：', defaultWt)
    if (!inputPath || !inputPath.trim()) return
    const branch = window.prompt('请输入关联的分支名称（可选，留空则默认当前分支）：') || undefined
    setBusy(true)
    setProgressStage('正在创建 Worktree...')
    try {
      const driver = getGitDriver()
      if (driver.addWorktree) {
        const res = await driver.addWorktree(view.repo, inputPath.trim(), branch?.trim())
        if (res.ok) {
          notification.success(res.message || 'Worktree 创建成功')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '创建 Worktree 失败')
        }
      } else {
        notification.error('当前模式不支持创建 Worktree')
      }
    } catch (err) {
      notification.error(err instanceof Error ? err.message : '创建 Worktree 失败')
    } finally {
      setBusy(false)
      setProgressStage('')
    }
  }, [view, notification])

  const handleCheckoutBranch = useCallback(
    async (branchName: string, isRemote = false) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(isRemote ? '正在检出分支...' : '正在切换分支...')
      try {
        const driver = getGitDriver()
        const res = await driver.checkoutBranch(view.repo, branchName, { track: isRemote })
        if (res.ok) {
          notification.success(res.message || (isRemote ? '检出分支成功' : '切换分支成功'))
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '操作失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '操作失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification]
  )

  const handlePushBranch = useCallback(
    async (branchName: string) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(`正在推送分支 ${branchName}...`)
      try {
        const driver = getGitDriver()
        const res = await driver.push(view.repo, { branch: branchName, setUpstream: true })
        if (res.ok) {
          notification.success(res.message || '推送成功')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '推送失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '推送失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification]
  )

  const handlePullBranch = useCallback(
    async (branchName: string) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(`正在拉取分支 ${branchName}...`)
      try {
        const driver = getGitDriver()
        await driver.fetch(view.repo, { prune: true }).catch(() => {})
        const res = await driver.pull(view.repo, { branch: branchName, ffOnly: true })
        if (res.ok) {
          notification.success(res.message || '拉取成功')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '拉取失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '拉取失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification]
  )

  const handleDeleteBranch = useCallback(
    async (branchName: string) => {
      if (!view?.repo) return
      const confirmed = window.confirm(`确定要删除分支 "${branchName}" 吗？`)
      if (!confirmed) return
      setBusy(true)
      setProgressStage(`正在删除分支 ${branchName}...`)
      try {
        const driver = getGitDriver()
        const res = await driver.deleteBranch(view.repo, branchName)
        if (res.ok) {
          notification.success(res.message || '已删除分支')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '删除失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '删除失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification]
  )

  const handleRenameBranch = useCallback((oldName: string) => {
    if (!oldName) return
    setRenameModal({ open: true, oldName })
  }, [])

  const executeRenameBranch = useCallback(
    async (oldName: string, newName: string) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(`正在重命名分支...`)
      try {
        const driver = getGitDriver()
        const res = await driver.renameBranch(view.repo, oldName, newName.trim())
        if (res.ok) {
          notification.success(res.message || '重命名成功')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '重命名失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '重命名失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification]
  )

  const handleCreateBranch = useCallback(
    (branchNameOrStart?: string, startPoint?: string) => {
      const start = startPoint || (branchNameOrStart && !branchNameOrStart.includes(' ') ? branchNameOrStart : undefined)
      setCreateBranchModal({ open: true, startPoint: start, currentBranch: view?.branch })
    },
    [view?.branch]
  )

  const executeCreateBranch = useCallback(
    async (name: string, startPoint?: string, checkout = true) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(`正在创建分支 ${name.trim()}...`)
      try {
        const driver = getGitDriver()
        const res = await driver.createBranch(view.repo, name.trim(), startPoint, checkout)
        if (res.ok) {
          notification.success(res.message || `已创建分支 ${name.trim()}`)
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '创建分支失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '创建分支失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification]
  )

  async function chooseFolder() {
    setError('')
    if (getDriverMode() === 'edge') {
      if (isFileSystemAccessSupported() && window.showDirectoryPicker) {
        try {
          const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
          if (handle) {
            setBusy(true)
            setProgressStage('Scanning Git repositories...')
            const { discoverEdgeGitRepos } = await import('@/lib/git/driver/edge-discover')
            const discovered = await discoverEdgeGitRepos(handle)
            if (discovered.length === 0) {
              setError(t('git.errors.noReposFound'))
              return
            }

            const driver = getGitDriver('edge')
            let firstProject: GitProjectView | null = null
            let importedCount = 0

            for (const repo of discovered) {
              try {
                const project = await driver.addProject({
                  pathOrUrl: repo.relativePath,
                  handle: repo.handle,
                  name: repo.name,
                })
                if (!firstProject) firstProject = project
                importedCount++
              } catch {
                // Skip individual invalid or duplicate repo entries
              }
            }

            if (!firstProject) {
              setError(t('git.errors.noReposFound'))
              return
            }

            await refreshProjects()
            closeMenu()
            if (importedCount > 1) {
              notification.success(t('git.project.importedCount', { count: importedCount }) || `Imported ${importedCount} Git repositories`)
            }
            await load(firstProject.id || firstProject.name)
            return
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.name === 'AbortError') return
          setError(e instanceof Error ? e.message : t('git.errors.openFolder'))
          return
        } finally {
          setBusy(false)
          setProgressStage('')
        }
      } else {
        // Fall back to companion folder picker on localhost / desktop if Web FS is unavailable
        const picked = await pickFolders(t('git.pickFolder.multi'), true)
        if (picked.length === 0) return
        setBusy(true)
        try {
          const response = await fetch('/api/git/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths: picked, discover: true }),
          })
          const body = (await response.json()) as {
            ok?: boolean
            projects?: GitProjectView[]
            folders?: string[]
            openPath?: string
            count?: number
          }
          if (!response.ok || body.ok === false || !body.openPath) {
            setError(readApiErrorMessage(body, t('git.errors.noReposFound')))
            return
          }
          applyCatalog(body)
          closeMenu()
          await load(body.openPath)
        } catch {
          setError(t('git.errors.unsupportedFileSystemAccess'))
        } finally {
          setBusy(false)
        }
        return
      }
      return
    }

    const picked = await pickFolders(t('git.pickFolder.multi'), true)
    if (picked.length === 0) return
    setBusy(true)
    try {
      const response = await fetch('/api/git/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: picked, discover: true }),
      })
      const body = (await response.json()) as {
        ok?: boolean
        projects?: GitProjectView[]
        folders?: string[]
        openPath?: string
        count?: number
      }
      if (!response.ok || body.ok === false || !body.openPath) {
        setError(readApiErrorMessage(body, t('git.errors.noReposFound')))
        return
      }
      applyCatalog(body)
      closeMenu()
      await load(body.openPath)
    } catch {
      setError(t('git.errors.noReposFound'))
    } finally {
      setBusy(false)
    }
  }

  async function addRemote(input: AddRemoteProjectOptions) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.addRemoteProject(input)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('git.errors.addRemoteFailed')
    } finally {
      setBusy(false)
    }
  }

  async function createFolder(name: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.createFolder(name)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('git.errors.createFolderFailed')
    } finally {
      setBusy(false)
    }
  }

  async function moveProject(id: string, group: string, beforeId?: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.moveProject(id, group, beforeId)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('git.errors.moveFailed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteFolder(name: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const result = await driver.deleteFolder(name)
      applyCatalog(result.catalog)
      return { error: '', removedCount: result.removedCount }
    } catch (err) {
      return { error: err instanceof Error ? err.message : t('git.errors.deleteFolderFailed') }
    } finally {
      setBusy(false)
    }
  }

  async function renameFolder(oldName: string, newName: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.renameFolder(oldName, newName)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : '重命名文件夹失败'
    } finally {
      setBusy(false)
    }
  }

  async function clearFolder(name: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.clearFolder(name)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : '清空文件夹失败'
    } finally {
      setBusy(false)
    }
  }

  async function setProjectLabel(id: string, label: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.setProjectLabel(id, label)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : '设置备注失败'
    } finally {
      setBusy(false)
    }
  }

  async function removeProject(id: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.removeProject(id)
      applyCatalog(catalog)
      if (view?.repo === id || scope === id) {
        setView(null)
        setCommits([])
        setHasMore(false)
        setSelection({ kind: 'all' })
        setSelectedHash('')
        setSelectedFile('')
        setError('')
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/git')
        }
      }
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : '移除项目失败'
    } finally {
      setBusy(false)
    }
  }

  async function cloneProject(project: GitProjectView) {
    if (getDriverMode() === 'edge') {
      setError(t('git.errors.cloneEdgeUnsupported'))
      return ''
    }
    const parent = await pickFolder(t('git.pickFolder.clone'))
    if (!parent) return ''
    setBusy(true)
    try {
      const response = await fetch('/api/git/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: project.id, parent }),
      })
      const body = (await response.json()) as { ok?: boolean; path?: string; projects?: GitProjectView[]; folders?: string[] }
      if (!response.ok || body.ok === false || !body.path) return readApiErrorMessage(body, t('git.errors.cloneFailed'))
      applyCatalog(body)
      closeMenu()
      await load(body.path)
      return ''
    } catch {
      return t('git.errors.cloneFailed')
    } finally {
      setBusy(false)
    }
  }

  const highlight = view ? highlightOf(view, selection) : ''
  const scopeMiss = Boolean(view && commits.length === 0)

  return (
    <div
      ref={worldRef}
      data-git-world-tree
      aria-busy={busy || undefined}
      className="flex h-full min-h-0 flex-1 flex-col bg-paper text-ink"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 70% 45% at 12% -10%, color-mix(in oklab, var(--wt-primary) 12%, transparent), transparent 55%), radial-gradient(ellipse 50% 40% at 88% 110%, color-mix(in oklab, var(--wt-secondary) 14%, transparent), transparent 50%)',
      }}
    >
      {process.env.NODE_ENV === 'development' ? <GitDebug /> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-panel/80">
        {inWorkspace ? (
          <WorkspaceHeaderSlot>
            <div ref={projectFindRef} data-git-find="project-switcher" className="relative min-w-0">
              <Tooltip content={view?.displayPath || view?.repo || t('git.header.pickRepo')} placement="bottom" suppressed={menuOpen || !view}>
                <Button
                  ref={anchorRef}
                  variant="plain"
                  className={cn(
                    'h-8 max-w-[16rem] justify-start gap-1.5 rounded-lg border-transparent bg-transparent px-2 font-normal text-ink',
                    'hover:enabled:border-transparent hover:enabled:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:enabled:text-ink',
                    menuOpen && 'bg-[color-mix(in_oklab,var(--ink)_9%,transparent)] hover:enabled:bg-[color-mix(in_oklab,var(--ink)_9%,transparent)]'
                  )}
                  aria-expanded={menuOpen}
                  aria-haspopup="dialog"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  {busy ? <Spinner className="size-3.5 shrink-0 text-accent" /> : <LuFolderGit2 className="size-3.5 shrink-0 text-ink-soft" aria-hidden />}
                  <span className="min-w-0 truncate text-[0.8125rem] font-semibold">
                    {busy ? t('common.loading') : view ? repoName(view.repo, view.displayPath) : t('git.header.noRepo')}
                  </span>
                  <LuChevronsUpDown className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
                </Button>
              </Tooltip>
              <GitProjectMenu
                open={menuOpen}
                anchorRef={anchorRef}
                currentPath={view?.repo || ''}
                projects={projects}
                folders={folders}
                busy={busy || picking}
                searchRequest={projectSearchRequest}
                onClose={closeMenu}
                onOpen={(path) => {
                  closeMenu()
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('yggit:clear_searches', { detail: { repo: path } }))
                  }
                  if (!path) {
                    void load('')
                    if (typeof window !== 'undefined' && window.location.pathname !== '/git') {
                      router.push('/git')
                    }
                  } else {
                    void load(path)
                  }
                }}
                onAddLocal={() => void chooseFolder()}
                onAddRemote={addRemote}
                onClone={cloneProject}
                onCreateFolder={createFolder}
                onDeleteFolder={deleteFolder}
                onRenameFolder={renameFolder}
                onClearFolder={clearFolder}
                onSetProjectLabel={setProjectLabel}
                onRemoveProject={removeProject}
                onMoveProject={moveProject}
                onRefreshProjects={refreshProjects}
              />
            </div>
            <div className="flex flex-1 items-center justify-center min-w-0">
              {view?.repo ? (
                <GitToolbar repo={view.repo} currentBranch={view.head || view.branch} hasStashes={view.stashes.length > 0} disabled={busy} onRefresh={silentRefresh} />
              ) : null}
            </div>
          </WorkspaceHeaderSlot>
        ) : (
          <header className="flex shrink-0 items-center gap-3 border-b border-line bg-panel-2/60 px-3 py-1.5">
            <BrandLogo
              href="/git"
              className="shrink-0"
              markClassName="size-7"
              wordmarkClassName="text-[0.95rem]"
              onClick={(e) => {
                e.preventDefault()
                void load('')
                if (typeof window !== 'undefined' && window.location.pathname !== '/git') {
                  window.history.pushState(null, '', '/git')
                }
              }}
            />
            <span className="h-4 w-px shrink-0 bg-[color-mix(in_oklab,var(--ink)_16%,transparent)]" aria-hidden />
            <div ref={projectFindRef} data-git-find="project-switcher" className="relative min-w-0">
              <Tooltip content={view?.displayPath || view?.repo || t('git.header.pickRepo')} placement="bottom" suppressed={menuOpen || !view}>
                <Button
                  ref={anchorRef}
                  variant="plain"
                  className={cn(
                    'h-8 max-w-[16rem] justify-start gap-1.5 rounded-lg border-transparent bg-transparent px-2 font-normal text-ink',
                    'hover:enabled:border-transparent hover:enabled:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:enabled:text-ink',
                    menuOpen && 'bg-[color-mix(in_oklab,var(--ink)_9%,transparent)] hover:enabled:bg-[color-mix(in_oklab,var(--ink)_9%,transparent)]'
                  )}
                  aria-expanded={menuOpen}
                  aria-haspopup="dialog"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  {busy ? <Spinner className="size-3.5 shrink-0 text-accent" /> : <LuFolderGit2 className="size-3.5 shrink-0 text-ink-soft" aria-hidden />}
                  <span className="min-w-0 truncate text-[0.8125rem] font-semibold">
                    {busy ? t('common.loading') : view ? repoName(view.repo, view.displayPath) : t('git.header.noRepo')}
                  </span>
                  <LuChevronsUpDown className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
                </Button>
              </Tooltip>
              <GitProjectMenu
                open={menuOpen}
                anchorRef={anchorRef}
                currentPath={view?.repo || ''}
                projects={projects}
                folders={folders}
                busy={busy || picking}
                searchRequest={projectSearchRequest}
                onClose={closeMenu}
                onOpen={(path) => {
                  closeMenu()
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('yggit:clear_searches', { detail: { repo: path } }))
                  }
                  if (!path) {
                    void load('')
                    if (typeof window !== 'undefined' && window.location.pathname !== '/git') {
                      router.push('/git')
                    }
                  } else {
                    void load(path)
                  }
                }}
                onAddLocal={() => void chooseFolder()}
                onAddRemote={addRemote}
                onClone={cloneProject}
                onCreateFolder={createFolder}
                onDeleteFolder={deleteFolder}
                onRenameFolder={renameFolder}
                onClearFolder={clearFolder}
                onSetProjectLabel={setProjectLabel}
                onRemoveProject={removeProject}
                onMoveProject={moveProject}
                onRefreshProjects={refreshProjects}
              />
            </div>
            <div className="flex flex-1 items-center justify-center min-w-0">
              {view?.repo ? (
                <GitToolbar repo={view.repo} currentBranch={view.head || view.branch} hasStashes={view.stashes.length > 0} disabled={busy} onRefresh={silentRefresh} />
              ) : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {process.env.NODE_ENV === 'development' && (
                <GitModeSwitcher
                  currentRepo={view?.repo}
                  currentName={view?.displayPath || (view?.repo ? repoName(view.repo, view.displayPath) : '')}
                  currentRemoteUrl={view?.remoteUrl}
                  onSwitchRepo={async (_nextMode, targetRepo) => {
                    const repoToLoad = targetRepo || viewRef.current?.repo || ''
                    if (repoToLoad) {
                      await load(repoToLoad)
                      void refreshProjects()
                    }
                  }}
                />
              )}
              {process.env.NODE_ENV === 'development' && (
                <Tooltip content={t('landing.studio.headerTip')} placement="bottom">
                  <Link href="/dev/studio" className={cn(dropdownTriggerClass, 'px-2 gap-1.5 text-xs font-mono font-medium')} aria-label={t('landing.header.devStudio')}>
                    <LuCompass className="size-3.5 text-accent shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('landing.header.devStudio')}</span>
                  </Link>
                </Tooltip>
              )}
              <span className="mx-0.5 h-3.5 w-px shrink-0 bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]" aria-hidden />
              <ThemeSwitcher compact />
              <LocaleSwitcher compact />
              <Tooltip content={t('gitAgent.settingsTitle')} placement="bottom">
                <Link
                  href="/settings/models"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      saveLastGitUrl(window.location.pathname + window.location.search)
                    }
                  }}
                  className={cn(dropdownTriggerClass, 'px-2')}
                  aria-label={t('gitAgent.settingsTitle')}
                >
                  <LuSettings className="size-4 shrink-0" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">{t('gitAgent.settingsTitle')}</span>
                </Link>
              </Tooltip>
            </div>
          </header>
        )}

        {error && !view ? (
          <EmptyState
            title={error.includes('RESOURCE_UNRESOLVED') || error.includes('PERMISSION_REQUIRED') ? t('git.page.permissionRequired') : t('git.page.repoUnreadable')}
            message={error.includes('RESOURCE_UNRESOLVED') || error.includes('PERMISSION_REQUIRED') ? t('git.page.permissionRequiredHint') : error}
            hint={t('git.page.repoUnreadableHint')}
          >
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button variant="accent" size="md" onClick={() => void chooseFolder()}>
                <LuFolderGit2 className="size-4" aria-hidden />
                {error.includes('RESOURCE_UNRESOLVED') || error.includes('PERMISSION_REQUIRED') ? t('git.project.reauthorizeLocal') : t('git.project.addLocal')}
              </Button>
              <Button variant="default" size="md" onClick={() => setMenuOpen(true)}>
                {t('git.project.switcher')}
              </Button>
            </div>
          </EmptyState>
        ) : !view ? (
          <EmptyState title={t('git.page.noProject')} message={t('git.page.noProjectMessage')} hint={t('git.page.noProjectHint')}>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button variant="accent" size="md" onClick={() => void chooseFolder()}>
                <LuFolderGit2 className="size-4" aria-hidden />
                {t('git.project.addLocal')}
              </Button>
              <Button variant="default" size="md" onClick={() => setMenuOpen(true)}>
                {t('git.project.switcher')}
              </Button>
            </div>
          </EmptyState>
        ) : (
          <div ref={frameRef} className="relative flex min-h-0 flex-1 overflow-hidden" style={frameStyle}>
            {filePanel ? (
              <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper">
                <header className="flex h-10 shrink-0 items-center justify-between border-b border-line bg-panel px-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {filePanel.type === 'history' ? (
                      <LuFileClock className="size-4 shrink-0 text-accent" aria-hidden />
                    ) : (
                      <LuFingerprint className="size-4 shrink-0 text-accent" aria-hidden />
                    )}
                    {(() => {
                      const lastSlash = filePanel.path.lastIndexOf('/')
                      const dirPrefix = lastSlash >= 0 ? filePanel.path.slice(0, lastSlash + 1) : ''
                      const fileName = lastSlash >= 0 ? filePanel.path.slice(lastSlash + 1) : filePanel.path
                      return (
                        <h2 className="m-0 flex min-w-0 items-center text-xs text-ink" title={filePanel.path}>
                          {dirPrefix ? <span className="truncate text-ink-soft/70 select-none">{dirPrefix}</span> : null}
                          <span className="shrink-0 font-semibold text-ink">{fileName}</span>
                        </h2>
                      )
                    })()}
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip content={filePanel.type === 'history' ? t('git.operations.fileBlame') || '文件追溯' : t('git.operations.fileHistory') || '文件历史'}>
                      <Button
                        variant="plain"
                        size="icon"
                        className="size-7 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-ink cursor-pointer"
                        aria-label={filePanel.type === 'history' ? t('git.operations.fileBlame') || 'File Blame' : t('git.operations.fileHistory') || 'File History'}
                        onClick={() => setFilePanel((prev) => (prev ? { ...prev, type: prev.type === 'history' ? 'blame' : 'history' } : null))}
                      >
                        {filePanel.type === 'history' ? <LuFingerprint className="size-3.5 text-ink-soft hover:text-accent" /> : <LuFileClock className="size-3.5 text-accent" />}
                      </Button>
                    </Tooltip>
                    <Button variant="plain" size="icon" className="size-7" aria-label={t('common.close')} onClick={() => setFilePanel(null)}>
                      <LuX className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </header>
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  {filePanel.type === 'history' ? (
                    <GitFileHistoryView repo={view.repo} path={filePanel.path} currentHash={filePanel.hash || selected?.hash} onLocateCommit={handleLocateCommit} />
                  ) : (
                    <GitFileBlameView repo={view.repo} path={filePanel.path} hash={filePanel.hash || selected?.hash} onLocateCommit={handleLocateCommit} />
                  )}
                </div>
              </section>
            ) : selected && (selectedFile || (conflictViewActive && conflicts[selected.hash])) ? (
              <GitFileDiff
                repo={view.repo}
                hash={selected.hash}
                path={selectedFile || conflicts[selected.hash]?.conflictFiles?.[0] || ''}
                status={selectedStatus}
                commit={selected}
                commits={commits}
                conflict={conflicts[selected.hash]}
                isConflictActive={conflictViewActive}
                onToggleConflict={(active) => setConflictViewActive(active)}
                fileIndex={currentFileIndex >= 0 ? currentFileIndex : undefined}
                fileCount={commitFiles.length > 0 ? commitFiles.length : undefined}
                onPrevFile={commitFiles.length > 1 ? handlePrevFile : undefined}
                onNextFile={commitFiles.length > 1 ? handleNextFile : undefined}
                hasConflict={Boolean(
                  conflicts[selected.hash]?.hasConflict &&
                  (conflicts[selected.hash]?.conflictFiles?.includes(selectedFile) || conflicts[selected.hash]?.unresolvedConflictFiles?.includes(selectedFile))
                )}
                onOpenConflictView={() => handleOpenConflictView(selected.hash, selectedFile)}
                initialTab={fileDetailTab}
                onTabChange={setFileDetailTab}
                onOpenFileHistory={(path) => {
                  setSelectedFile(path)
                  setFilePanel({ type: 'history', path, hash: selected?.hash })
                }}
                onOpenFileBlame={(path) => {
                  setSelectedFile(path)
                  setFilePanel({ type: 'blame', path, hash: selected?.hash })
                }}
                onLocateCommit={handleLocateCommit}
                onClose={() => {
                  setConflictViewActive(false)
                  setSelectedFile('')
                  setSelectedStatus('')
                  setFileDetailTab('diff')
                }}
              />
            ) : (
              <>
                <GitSidebar
                  key={view.repo}
                  view={view}
                  selection={selection}
                  width={sidebarWidth}
                  remoteUpdates={remoteCheck?.updates || []}
                  soloBranch={soloBranch}
                  onSoloBranch={setSoloBranch}
                  soloRemote={soloRemote}
                  onSoloRemote={setSoloRemote}
                  hiddenRemotes={hiddenRemotes}
                  onToggleHideRemote={(remote) => setHiddenRemotes((prev) => (prev.includes(remote) ? prev.filter((r) => r !== remote) : [...prev, remote]))}
                  onSelect={select}
                  onOpenRepo={(repo) => void load(repo)}
                  onAddWorktree={handleAddWorktree}
                  onCheckoutBranch={handleCheckoutBranch}
                  onCreateBranch={handleCreateBranch}
                  onDeleteBranch={handleDeleteBranch}
                  onRenameBranch={handleRenameBranch}
                  onPushBranch={handlePushBranch}
                  onPullBranch={handlePullBranch}
                  onBranchHoverStart={handleBranchHoverStart}
                  onBranchHoverEnd={handleBranchHoverEnd}
                  onRefresh={silentRefresh}
                />
                <PanelSplitter
                  label={t('git.splitter.sidebar')}
                  value={sidebarWidth}
                  min={SIDEBAR_MIN}
                  max={640}
                  line={false}
                  onResize={resizeSidebar}
                  onResizeEnd={commitSidebar}
                  onAutoFit={fitSidebar}
                />
                <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-line" aria-label={t('git.section.history')}>
                  {error ? <p className="m-0 px-3 py-2 text-xs text-fail">{error}</p> : null}
                  {scopeMiss ? (
                    <EmptyState
                      title={view.branches.length === 0 ? t('git.page.noBranch') : t('git.page.noCommits')}
                      message={view.branches.length === 0 ? t('git.page.noBranchMessage') : t('git.page.noCommitsInRef')}
                      hint={view.branches.length === 0 ? t('git.page.noBranchHint') : t('git.page.noCommitsHint')}
                      density="panel"
                    />
                  ) : (
                    <GitHistory
                      repo={view.repo}
                      remoteUrl={view.remoteUrl}
                      scope={scope}
                      commits={commits}
                      hasMore={hasMore}
                      hasPrev={hasPrev}
                      startIndex={startIndex}
                      worktree={view.worktree}
                      stashes={view.stashes}
                      highlight={highlight}
                      lineageHashes={lineageSet}
                      remoteNames={[...new Set(view.remotes.map((item) => item.remote))]}
                      worktreeBranches={view.worktrees.filter((item) => item.branch && !item.current).map((item) => item.branch)}
                      selectedHash={selectedHash}
                      conflicts={conflicts}
                      scrollRef={historyScrollRef}
                      focusRequest={focusRequest}
                      activeHoverBranch={activeHoverBranch}
                      onBranchHoverStart={handleBranchHoverStart}
                      onBranchHoverEnd={handleBranchHoverEnd}
                      onSelect={(commit) => {
                        setSelectedHash(commit.hash)
                        setSelectedFile('')
                        setSelectedStatus('')
                        setLineageHashes(null)
                        setConflictViewActive(false)
                      }}
                      onSelectWorktree={() => {
                        setSelectedHash(GIT_WORKTREE_HASH)
                        setSelectedFile('')
                        setSelectedStatus('')
                        setLineageHashes(null)
                        setConflictViewActive(false)
                      }}
                      onOpenConflictView={handleOpenConflictView}
                      currentBranch={view.branch}
                      soloBranch={soloBranch}
                      onSoloBranch={setSoloBranch}
                      soloRemote={soloRemote}
                      hiddenRemotes={hiddenRemotes}
                      onCheckoutBranch={handleCheckoutBranch}
                      onCreateBranch={handleCreateBranch}
                      onDeleteBranch={handleDeleteBranch}
                      onRenameBranch={handleRenameBranch}
                      onPushBranch={handlePushBranch}
                      onPullBranch={handlePullBranch}
                      onPage={onPage}
                      onPagePrepend={handlePagePrepend}
                      onRefresh={silentRefresh}
                    />
                  )}
                  {/* Standalone Merge Lineage Panel beside Git history */}
                  {selected && selected.parents && selected.parents.length >= 2 ? (
                    <GitMergePanel
                      repo={view.repo}
                      commit={selected}
                      commits={commits}
                      conflict={conflicts[selected.hash]}
                      highlighted={Boolean(lineageHashes && lineageHashes.length > 0)}
                      onHighlight={(active, hashes) => {
                        if (!active || !hashes) {
                          setLineageHashes(null)
                        } else {
                          setLineageHashes(hashes)
                        }
                      }}
                      onLocate={(hash) => {
                        setSelectedHash(hash)
                        setFocusRequest({ hash })
                      }}
                      onOpenConflictView={() => handleOpenConflictView(selected.hash)}
                    />
                  ) : null}
                </section>
              </>
            )}
            {selected ? (
              <>
                <PanelSplitter
                  label={t('git.splitter.tree')}
                  value={treeWidth}
                  min={TREE_MIN}
                  max={720}
                  line={false}
                  onResize={resizeTree}
                  onResizeEnd={commitTree}
                  onAutoFit={fitTree}
                />
                <GitCommitPanel
                  repo={view.repo}
                  remoteUrl={view.remoteUrl}
                  commit={selected}
                  width={treeWidth}
                  title={selectedIsWorktree ? t('git.panel.worktree') : t('git.panel.files')}
                  conflictFiles={conflicts[selected.hash]?.conflictFiles}
                  conflictFileCounts={conflicts[selected.hash]?.conflictFileCounts}
                  selectedPath={filePanel ? filePanel.path : selectedFile}
                  onFilesLoaded={handleCommitFilesLoaded}
                  onRefresh={silentRefresh}
                  onSelect={(path, status) => {
                    setSelectedFile(path)
                    setSelectedStatus(status)
                    setFileDetailTab('diff')
                    if (filePanel) {
                      setFilePanel((prev) => (prev ? { ...prev, path } : null))
                    }
                  }}
                  onOpenFileHistory={(path) => {
                    setSelectedFile(path)
                    setFilePanel({ type: 'history', path, hash: selected?.hash })
                  }}
                  onOpenFileBlame={(path) => {
                    setSelectedFile(path)
                    setFilePanel({ type: 'blame', path, hash: selected?.hash })
                  }}
                  onClose={() => {
                    setSelectedHash('')
                    setSelectedFile('')
                    setSelectedStatus('')
                    setFileDetailTab('diff')
                    setLineageHashes(null)
                    setConflictViewActive(false)
                    setFilePanel(null)
                  }}
                />
              </>
            ) : null}
          </div>
        )}

        {/* Full-Page Blocking Loading Overlay when switching or loading repository */}
        {busy ? (
          <div
            role="status"
            aria-live="polite"
            aria-label={t('git.page.switchingProject')}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper/60 backdrop-blur-xs select-none cursor-wait transition-opacity duration-200"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-line/80 bg-panel/95 px-7 py-6 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 min-w-[280px]">
              <Spinner className="size-8 text-accent" />
              <div className="flex flex-col items-center gap-1.5 text-center">
                <span className="text-sm font-semibold text-ink">{t('git.page.switchingProject')}</span>
                <span className="text-xs text-accent font-medium transition-all duration-200">{progressStage || t('git.page.switchingProjectHint')}</span>
              </div>
            </div>
          </div>
        ) : null}

        <RenameBranchModal
          open={renameModal.open}
          oldName={renameModal.oldName}
          busy={busy}
          onClose={() => setRenameModal({ open: false, oldName: '' })}
          onSubmit={executeRenameBranch}
        />
        <CreateBranchModal
          open={createBranchModal.open}
          startPoint={createBranchModal.startPoint}
          currentBranch={createBranchModal.currentBranch}
          busy={busy}
          onClose={() => setCreateBranchModal({ open: false })}
          onSubmit={executeCreateBranch}
        />
      </div>
    </div>
  )
}
