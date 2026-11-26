'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAgentQuoteGlobalShortcut } from '@/components/git/agent/agentQuoteShortcut'
import { GitCommitPanel } from '@/components/git/GitCommitPanel'
import { GitDebug } from '@/components/git/GitDebug'
import { GitFileDiff } from '@/components/git/GitFileDiff'
import { GIT_FIND_EVENT, useGitFindShortcut } from '@/components/git/gitFind'
import { GitHistory } from '@/components/git/GitHistory'
import { GitMergePanel } from '@/components/git/GitMergePanel'
import { GitSidebar } from '@/components/git/GitSidebar'
import { useGitBranchActions } from '@/components/git/hooks/useGitBranchActions'
import { useGitCommitSelection } from '@/components/git/hooks/useGitCommitSelection'
import { useGitLogAutoSync } from '@/components/git/hooks/useGitLogAutoSync'
import { useGitLogPanelLayout } from '@/components/git/hooks/useGitLogPanelLayout'
import { useGitLogRepoLoader } from '@/components/git/hooks/useGitLogRepoLoader'
import { useGitProjectActions } from '@/components/git/hooks/useGitProjectActions'
import { GitLogBlockingOverlay, GitLogBranchModals, GitLogFilePanel, GitLogNoRepoState } from '@/components/git/log-page/GitLogFilePanel'
import { GitLogHeader } from '@/components/git/log-page/GitLogHeader'
import { type GitLogPageProps, highlightOf, isError, isGitSelection, selectionFor, SIDEBAR_MIN, TREE_MIN } from '@/components/git/log-page/gitLogUtils'
import { PanelSplitter } from '@/components/git/PanelSplitter'
import { useMergeConflicts } from '@/components/git/useMergeConflicts'
import { useT } from '@/components/i18n/LocaleProvider'
import { useInWorkspaceHeader } from '@/components/layout/WorkspaceHeaderContext'
import { useNotification } from '@/components/notification/useNotification'
import { EmptyState } from '@/components/sk'
import { useOptionalAgent } from '@/lib/agent/agent-context'
import { useOptionalSpotlight } from '@/lib/agent/spotlight-context'
import { getDriverMode, getGitDriver, type GitDriverMode } from '@/lib/git/driver'
import { makeShareUrl } from '@/lib/git/resolver'
import { gitSelectionHash } from '@/lib/git/scope'
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
import { isPositiveNumber, readGitUiPref, repoPrefKey, useGitUiPref, writeGitUiPref } from '@/lib/git/ui-prefs'

export function GitLogPage({ initial, initialCommitHash, initialFilePath, initialPersistence: _initialPersistence }: GitLogPageProps) {
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
    const currentBranch = view?.head || view?.branch || ''
    if (currentBranch && agent?.setActiveBranch) {
      agent.setActiveBranch(currentBranch)
    }
  }, [view?.repo, view?.head, view?.branch, agent])
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

  const viewRef = useRef(view)
  viewRef.current = view

  const selectedHashRef = useRef(selectedHash)
  selectedHashRef.current = selectedHash
  const selectedFileRef = useRef(selectedFile)
  selectedFileRef.current = selectedFile
  const filePanelRef = useRef(filePanel)
  filePanelRef.current = filePanel

  const isMainOverview = !selectedFile && !filePanel && !conflictViewActive
  const { silentRefresh } = useGitLogAutoSync({
    busy,
    view,
    viewRef,
    scopeRef,
    startIndexRef,
    commitsRef,
    selectedHashRef,
    selectedFileRef,
    isMainOverview,
    setView,
    setCommits,
    setHasMore,
    setHasPrev,
    setStartIndex,
    setSelectedFile,
    setSelectedStatus,
    setConflictViewActive,
    setSelectedHash,
    setSelection,
  })

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

  const { handleLocateCommit, handleCommitFilesLoaded } = useGitCommitSelection({
    view,
    viewRef,
    scope,
    commits,
    selectedIsWorktree,
    selectedFile,
    setFilePanel,
    setSelectedFile,
    setSelectedStatus,
    setConflictViewActive,
    setLineageHashes,
    setSelectedHash,
    setFocusRequest,
    setCommits,
    setHasMore,
    setHasPrev,
    setStartIndex,
    setCommitFiles,
    setSelection,
    setView,
  })

  const { frameStyle, resizeSidebar, resizeTree, commitSidebar, commitTree, fitSidebar, fitTree } = useGitLogPanelLayout({
    frameRef,
    sidebarWidth,
    setSidebarWidth,
    treeWidth,
    setTreeWidth,
    selected: Boolean(selected),
    selectedFile,
    selectedFileRef,
    filePanelRef,
    busy,
    menuOpen,
    setFilePanel,
    setSelectedFile,
    setSelectedStatus,
    setSelectedHash,
  })

  useAgentQuoteGlobalShortcut({
    repo: view?.repo,
    currentBranch: view?.branch,
    selectedHash,
    selectedFile,
    selectedStatus,
    commits,
  })

  scopeRef.current = scope

  const { load, loadRef } = useGitLogRepoLoader({
    view,
    projects,
    selectedHash,
    selectedFile,
    applyView,
    setView,
    setCommits,
    setHasMore,
    setSelection,
    setSelectedHash,
    setSelectedFile,
    setSelectedStatus,
    setLineageHashes,
    setConflictViewActive,
    setError,
    onError: (msg) => notification.error(msg),
    setBusy,
    setProgressStage,
    t,
  })

  useEffect(() => {
    void refreshProjects()
    async function onDriverModeChanged(e: Event) {
      const customEvent = e as CustomEvent<GitDriverMode | { mode: GitDriverMode; targetRepo?: string; targetUrl?: string }>
      const detail = customEvent.detail
      const targetRepo = typeof detail === 'object' && detail !== null ? detail.targetRepo : undefined
      const repoToReload = targetRepo || viewRef.current?.repo || ''

      await refreshProjects()

      if (repoToReload) {
        await loadRef.current(repoToReload)
      }
    }
    window.addEventListener('yggit:driver_mode_changed', onDriverModeChanged)
    return () => window.removeEventListener('yggit:driver_mode_changed', onDriverModeChanged)
  }, [refreshProjects, loadRef])

  const {
    handleAddWorktree,
    handleCheckoutBranch,
    handlePushBranch,
    handlePullBranch,
    handleDeleteBranch,
    handleRenameBranch,
    executeRenameBranch,
    handleCreateBranch,
    executeCreateBranch,
  } = useGitBranchActions({
    view,
    loadRef,
    notification,
    setBusy,
    setProgressStage,
    setRenameModal,
    setCreateBranchModal,
  })

  const { chooseFolder, addRemote, createFolder, moveProject, deleteFolder, renameFolder, clearFolder, setProjectLabel, removeProject, cloneProject } = useGitProjectActions({
    view,
    scope,
    t,
    notification,
    applyCatalog,
    refreshProjects,
    closeMenu,
    load,
    setPicking,
    setBusy,
    setProgressStage,
    setError,
    setView,
    setCommits,
    setHasMore,
    setSelection,
    setSelectedHash,
    setSelectedFile,
  })

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
        <GitLogHeader
          inWorkspace={inWorkspace}
          view={view}
          viewRef={viewRef}
          busy={busy}
          picking={picking}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          closeMenu={closeMenu}
          anchorRef={anchorRef}
          projectFindRef={projectFindRef}
          projects={projects}
          folders={folders}
          projectSearchRequest={projectSearchRequest}
          load={load}
          routerPush={(href) => router.push(href)}
          chooseFolder={chooseFolder}
          addRemote={addRemote}
          cloneProject={cloneProject}
          createFolder={createFolder}
          deleteFolder={deleteFolder}
          renameFolder={renameFolder}
          clearFolder={clearFolder}
          setProjectLabel={setProjectLabel}
          removeProject={removeProject}
          moveProject={moveProject}
          refreshProjects={refreshProjects}
          silentRefresh={silentRefresh}
          t={t}
        />

        {!view ? (
          <GitLogNoRepoState error={error} onChooseFolder={() => void chooseFolder()} onOpenMenu={() => setMenuOpen(true)} t={t} />
        ) : (
          <div ref={frameRef} className="relative flex min-h-0 flex-1 overflow-hidden" style={frameStyle}>
            {filePanel ? (
              <GitLogFilePanel
                repo={view.repo}
                filePanel={filePanel}
                selectedHash={selected?.hash}
                onToggleType={() => setFilePanel((prev) => (prev ? { ...prev, type: prev.type === 'history' ? 'blame' : 'history' } : null))}
                onClose={() => setFilePanel(null)}
                onLocateCommit={handleLocateCommit}
                t={t}
              />
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

        <GitLogBlockingOverlay busy={busy} progressStage={progressStage} t={t} />
        <GitLogBranchModals
          renameModal={renameModal}
          setRenameModal={setRenameModal}
          executeRenameBranch={executeRenameBranch}
          createBranchModal={createBranchModal}
          setCreateBranchModal={setCreateBranchModal}
          executeCreateBranch={executeCreateBranch}
          busy={busy}
        />
      </div>
    </div>
  )
}
