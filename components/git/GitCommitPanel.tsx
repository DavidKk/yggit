'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useOptionalConfirm } from '@/components/confirm/ConfirmProvider'
import { FloatingMenu, type FloatingMenuItem } from '@/components/git/RefChipsCell'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { EmptyState, VirtualList } from '@/components/sk'
import { useOptionalAgent } from '@/lib/agent/agent-context'
import { composeCommitMessageWithAi } from '@/lib/agent/commit-composer'
import { getGitDriver } from '@/lib/git/driver'
import { GIT_WORKTREE_HASH, type GitCommit, type GitCommitChanges, type GitFileChange } from '@/lib/git/types'
import { isBoolean, useGitUiPref } from '@/lib/git/ui-prefs'

import { CommitPanelHeader } from './commit-panel/CommitPanelHeader'
import {
  buildTree,
  type ChangeCounts,
  type ConflictCounts,
  type FileView,
  folderPaths,
  getAncestorPaths,
  groupByPath,
  isFileView,
  tally,
  type TreeNode,
  type WorktreeLayout,
} from './commit-panel/commitTreeUtils'
import { GitCommitBox } from './commit-panel/GitCommitBox'
import { NewFileDialog } from './commit-panel/NewFileDialog'
import { PathRows } from './commit-panel/PathRows'
import { TreeRows } from './commit-panel/TreeRows'
import { useCommitPanelActions } from './commit-panel/useCommitPanelActions'
import { useCommitPanelContextMenus } from './commit-panel/useCommitPanelContextMenus'
import { WorktreeFileSections } from './commit-panel/WorktreeFileSections'

type Props = {
  repo: string
  remoteUrl?: string
  commit: GitCommit
  width: number
  /** Panel heading; defaults to 'Files'. */
  title?: string
  conflictFiles?: string[]
  conflictFileCounts?: Record<string, number | null>
  selectedPath: string
  onSelect: (path: string, status: string) => void
  onOpenFileHistory?: (path: string) => void
  onOpenFileBlame?: (path: string) => void
  onFilesLoaded?: (files: GitFileChange[]) => void
  onCommitSuccess?: (params: { hash?: string; subject: string; remainingFilesCount?: number }) => void
  onClose: () => void
  onRefresh?: () => Promise<void> | void
}

function GitCommitPanelInner({
  repo,
  commit,
  width,
  title,
  conflictFiles,
  conflictFileCounts,
  selectedPath,
  onSelect,
  onOpenFileHistory,
  onOpenFileBlame,
  onFilesLoaded,
  onCommitSuccess,
  onClose,
  onRefresh,
}: Props) {
  const t = useT()
  const notify = useNotification()
  const optionalConfirm = useOptionalConfirm()
  const confirm = optionalConfirm ?? (() => Promise.resolve(true))
  const agent = useOptionalAgent()
  const [aiComposing, setAiComposing] = useState(false)
  const panelTitle = title ?? t('git.panel.files')
  const isWorktree = commit.hash === GIT_WORKTREE_HASH
  const panelRef = useRef<HTMLElement>(null)
  const [changes, setChanges] = useState<GitCommitChanges | null>(null)
  const [allFiles, setAllFiles] = useState<GitFileChange[] | null>(null)
  const [error, setError] = useState('')
  const [fileQuery, setFileQuery] = useState('')
  const [stagedQuery, setStagedQuery] = useState('')
  const [unstagedQuery, setUnstagedQuery] = useState('')
  const [conflictsOnly, setConflictsOnly] = useState(false)

  useEffect(() => {
    setFileQuery('')
    setStagedQuery('')
    setUnstagedQuery('')
    setConflictsOnly(false)
  }, [repo])

  useEffect(() => {
    function onClearSearches() {
      setFileQuery('')
      setStagedQuery('')
      setUnstagedQuery('')
      setConflictsOnly(false)
    }
    window.addEventListener('yggit:clear_searches', onClearSearches)
    return () => window.removeEventListener('yggit:clear_searches', onClearSearches)
  }, [])

  // Layout preference: split vs unified
  const [worktreeLayout, setWorktreeLayout] = useState<WorktreeLayout>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yggit.ui.worktree-layout')
      if (saved === 'split' || saved === 'unified') return saved
    }
    return 'split'
  })

  // Bottom Panel Mode: Commit vs Stash
  const [bottomTab, setBottomTab] = useState<'commit' | 'stash'>('commit')
  const [commitSummary, setCommitSummary] = useState('')
  const [commitDesc, setCommitDesc] = useState('')
  const [amendCommit, setAmendCommit] = useState(false)
  const [pushAfterCommit, setPushAfterCommit] = useState(false)
  const [skipGitHooks, setSkipGitHooks] = useState(false)
  const [stashTitle, setStashTitle] = useState('')
  const [stashDesc, setStashDesc] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [isStashing, setIsStashing] = useState(false)

  // 3 Collapsible panels state
  const [openStaged, setOpenStaged] = useState(true)
  const [openUnstaged, setOpenUnstaged] = useState(true)
  const [openCommit, setOpenCommit] = useState(true)
  const [commitSettingsAnchor, setCommitSettingsAnchor] = useState<{ x: number; y: number } | null>(null)
  const commitSettingsBtnRef = useRef<HTMLButtonElement>(null)
  const commitDescRef = useRef<HTMLTextAreaElement>(null)
  const stashDescRef = useRef<HTMLTextAreaElement>(null)

  // Inline new file dialog
  const [newFileDialog, setNewFileDialog] = useState<{ folderPath: string; fileName: string } | null>(null)

  const conflictCounts = useMemo<ConflictCounts>(
    () => Object.assign(Object.create(null), Object.fromEntries((conflictFiles ?? []).map((file) => [file, conflictFileCounts?.[file] ?? null]))),
    [conflictFiles, conflictFileCounts]
  )
  const conflictFileCount = Object.keys(conflictCounts).length
  const filterConflicts = conflictsOnly && conflictFileCount > 0
  const [contextMenu, setContextMenu] = useState<{
    anchor: { x: number; y: number }
    items: FloatingMenuItem[]
    ariaLabel: string
  } | null>(null)
  const fileNeedle = fileQuery.trim().toLowerCase()
  const [preferredView, setView] = useGitUiPref('commit.fileView', 'tree' as FileView, isFileView)
  const view = isWorktree && preferredView === 'all' ? 'tree' : preferredView
  const [expandDefault, setExpandDefault] = useGitUiPref('commit.treeExpandDefault', true, isBoolean)
  const [openPaths, setOpenPaths] = useState<Set<string>>(() => new Set())
  const expandDefaultRef = useRef(expandDefault)
  expandDefaultRef.current = expandDefault
  const selectedPathRef = useRef(selectedPath)
  selectedPathRef.current = selectedPath
  const onFilesLoadedRef = useRef(onFilesLoaded)
  onFilesLoadedRef.current = onFilesLoaded
  const tRef = useRef(t)
  tRef.current = t
  const prevCommitHashRef = useRef(commit.hash)

  const handleToggleLayout = (nextMode: WorktreeLayout) => {
    setWorktreeLayout(nextMode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('yggit.ui.worktree-layout', nextMode)
    }
  }

  useEffect(() => {
    let cancelled = false
    setChanges(null)
    setAllFiles(null)
    setError('')
    setFileQuery('')
    setStagedQuery('')
    setUnstagedQuery('')
    setConflictsOnly(false)
    if (prevCommitHashRef.current !== commit.hash) {
      prevCommitHashRef.current = commit.hash
      setOpenPaths(new Set())
    }
    const driver = getGitDriver()
    driver
      .readCommitDiff({ repo, hash: commit.hash, tree: true })
      .then((body) => {
        if (cancelled) return
        if (!body || !body.files) {
          setError(tRef.current('git.errors.readChanges'))
          return
        }
        setChanges(body)
        onFilesLoadedRef.current?.(body.files || [])
        const allFolderPaths = folderPaths(buildTree(body.files))
        setOpenPaths((prev) => {
          const next = new Set<string>()
          if (prev.size > 0) {
            for (const p of prev) {
              if (allFolderPaths.includes(p)) next.add(p)
            }
          } else if (expandDefaultRef.current) {
            for (const p of allFolderPaths) next.add(p)
          }
          if (selectedPathRef.current) {
            for (const anc of getAncestorPaths(selectedPathRef.current)) next.add(anc)
          }
          return next
        })
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : tRef.current('git.errors.readChanges'))
      })
    return () => {
      cancelled = true
    }
  }, [repo, commit.hash])

  useEffect(() => {
    if (view !== 'all' || allFiles || !changes) return
    let cancelled = false
    const driver = getGitDriver()
    driver
      .readCommitDiff({ repo, hash: commit.hash, tree: true, all: true })
      .then((body) => {
        if (cancelled) return
        if (!body || !body.files) {
          setError(tRef.current('git.errors.readTree'))
          return
        }
        setAllFiles(body.files)
        const allFolderPaths = folderPaths(buildTree(body.files))
        setOpenPaths((prev) => {
          const next = new Set<string>()
          if (prev.size > 0) {
            for (const p of prev) {
              if (allFolderPaths.includes(p)) next.add(p)
            }
          } else if (expandDefaultRef.current) {
            for (const p of allFolderPaths) next.add(p)
          }
          if (selectedPathRef.current) {
            for (const anc of getAncestorPaths(selectedPathRef.current)) next.add(anc)
          }
          return next
        })
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : tRef.current('git.errors.readTree'))
      })
    return () => {
      cancelled = true
    }
  }, [view, allFiles, changes, repo, commit.hash])

  // Auto-expand ancestors whenever selectedPath changes
  useEffect(() => {
    if (!selectedPath) return
    const ancestors = getAncestorPaths(selectedPath)
    if (ancestors.length === 0) return
    setOpenPaths((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const anc of ancestors) {
        if (!next.has(anc)) {
          next.add(anc)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [selectedPath])

  // Handle Amend commit auto filling
  useEffect(() => {
    if (!amendCommit) return
    let active = true
    const driver = getGitDriver()
    driver
      .getLastCommit(repo)
      .then((last) => {
        if (!active) return
        if (last.summary) {
          setCommitSummary(last.summary)
          setCommitDesc(last.description || '')
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [amendCommit, repo])

  const changedFiles = useMemo<GitFileChange[]>(() => {
    const files = [...new Map((changes?.files || []).map((file) => [file.path, file])).values()]
    const paths = new Set(files.map((file) => file.path))
    return [
      ...files,
      ...Object.keys(conflictCounts)
        .filter((path) => !paths.has(path))
        .map((path): GitFileChange => ({ path, oldPath: '', status: 'M', conflict: true })),
    ]
  }, [changes?.files, conflictCounts])

  const stagedFiles = useMemo(() => changedFiles.filter((f) => f.staged), [changedFiles])
  const unstagedFiles = useMemo(() => changedFiles.filter((f) => f.unstaged ?? !f.staged), [changedFiles])

  const filteredStagedFiles = useMemo(() => {
    const q = stagedQuery.trim().toLowerCase()
    return stagedFiles.filter((f) => !q || f.path.toLowerCase().includes(q))
  }, [stagedFiles, stagedQuery])

  const filteredUnstagedFiles = useMemo(() => {
    const q = unstagedQuery.trim().toLowerCase()
    return unstagedFiles.filter((f) => !q || f.path.toLowerCase().includes(q))
  }, [unstagedFiles, unstagedQuery])

  const filteredChangedFiles = useMemo(() => {
    return changedFiles.filter((f) => f.path.toLowerCase().includes(fileNeedle) && (!filterConflicts || f.path in conflictCounts))
  }, [changedFiles, fileNeedle, filterConflicts, conflictCounts])

  const filteredAllFiles = useMemo(() => {
    if (!allFiles) return null
    return allFiles.filter((f) => f.path.toLowerCase().includes(fileNeedle) && (!filterConflicts || f.path in conflictCounts))
  }, [allFiles, fileNeedle, filterConflicts, conflictCounts])

  const changedTree = useMemo(() => buildTree(filteredChangedFiles), [filteredChangedFiles])
  const pathGroups = useMemo(() => groupByPath(filteredChangedFiles), [filteredChangedFiles])
  const allTree = useMemo(() => buildTree(filteredAllFiles || []), [filteredAllFiles])
  const activeTree = view === 'all' ? allTree : changedTree
  const folders = useMemo(() => folderPaths(activeTree), [activeTree])
  const treeCounts = useMemo(() => {
    const index = new Map<string, ChangeCounts>()
    for (const node of activeTree) tally(node, conflictCounts, index)
    return index
  }, [activeTree, conflictCounts])

  const isSearching = Boolean(fileNeedle || filterConflicts)

  const treeRows = useMemo(() => {
    const rows: Array<{ node: TreeNode; depth: number; parentId?: string }> = []
    const visit = (nodes: TreeNode[], depth: number, parentId?: string) => {
      for (const node of nodes) {
        rows.push({ node, depth, parentId })
        if (node.children.length && (isSearching || openPaths.has(node.path))) visit(node.children, depth + 1, node.path)
      }
    }
    visit(activeTree, 0)
    return rows
  }, [activeTree, openPaths, isSearching])

  const pathRows = useMemo(
    () =>
      pathGroups.flatMap((group) => [
        { id: `dir:${group.dir}`, group, header: true },
        ...group.files.map((file) => ({ id: `file:${file.path}`, group: { dir: group.dir, files: [file] }, header: false })),
      ]),
    [pathGroups]
  )

  const allOpen = folders.length > 0 && folders.every((path) => openPaths.has(path))
  const canExpand = (view === 'tree' || view === 'all') && folders.length > 0
  const badgeCount = view === 'all' ? (filteredAllFiles?.length ?? filteredChangedFiles.length) : filteredChangedFiles.length

  useEffect(() => {
    if ((fileNeedle || filterConflicts) && folders.length > 0) {
      setOpenPaths(new Set(folders))
    }
  }, [fileNeedle, filterConflicts, folders])

  // Auto-scroll selectedPath into view in the file tree
  useEffect(() => {
    if (!selectedPath) return
    const timer = setTimeout(() => {
      const scrollEl = panelRef.current?.querySelector('[role="list"]') as HTMLElement | null
      if (!scrollEl) return
      const idx = treeRows.findIndex((row) => row.node.path === selectedPath)
      if (idx < 0) return
      const rowTop = idx * 28
      const rowBottom = rowTop + 28
      if (rowTop < scrollEl.scrollTop || rowBottom > scrollEl.scrollTop + scrollEl.clientHeight) {
        scrollEl.scrollTo({ top: Math.max(0, rowTop - scrollEl.clientHeight / 2 + 14), behavior: 'smooth' })
      }
    }, 60)
    return () => clearTimeout(timer)
  }, [selectedPath, treeRows])

  const handleFocusSelectedFile = useCallback(() => {
    if (!selectedPath) return
    const parts = selectedPath.split('/')
    if (parts.length > 1) {
      setOpenPaths((prev) => {
        const next = new Set(prev)
        let accum = ''
        for (let i = 0; i < parts.length - 1; i++) {
          accum = accum ? `${accum}/${parts[i]}` : parts[i]
          next.add(accum)
        }
        return next
      })
    }
    setTimeout(() => {
      const scrollEl = panelRef.current?.querySelector('[role="list"]') as HTMLElement | null
      const safePath = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(selectedPath) : selectedPath.replace(/["\\]/g, '\\$&')
      const targetEl = panelRef.current?.querySelector(`[data-git-file-path="${safePath}"]`) as HTMLElement | null
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        targetEl.classList.add('ring-2', 'ring-accent', 'ring-offset-1')
        setTimeout(() => {
          targetEl.classList.remove('ring-2', 'ring-accent', 'ring-offset-1')
        }, 1200)
      } else if (scrollEl) {
        const idx = treeRows.findIndex((row) => row.node.path === selectedPath)
        if (idx >= 0) {
          const rowTop = idx * 28
          scrollEl.scrollTo({ top: Math.max(0, rowTop - scrollEl.clientHeight / 2 + 14), behavior: 'smooth' })
        }
      }
    }, 60)
  }, [selectedPath, treeRows])

  const toggleFolder = (path: string) => {
    setOpenPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const setFolderOpen = (path: string, next: boolean) => {
    setOpenPaths((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(path)
      else copy.delete(path)
      return copy
    })
  }

  const pendingStageCountRef = useRef(0)

  const handleOptimisticFilesChange = useCallback((nextFiles: GitFileChange[]) => {
    setChanges((prev) => (prev ? { ...prev, files: nextFiles } : prev))
    onFilesLoadedRef.current?.(nextFiles)
  }, [])

  const reloadDiff = useCallback(async () => {
    if (pendingStageCountRef.current > 0) return
    try {
      const driver = getGitDriver()
      const body = await driver.readCommitDiff({ repo, hash: commit.hash, tree: true })
      if (pendingStageCountRef.current > 0) return
      if (body?.files) {
        setChanges(body)
        onFilesLoaded?.(body.files)
      }
    } catch {
      // ignore
    }
  }, [repo, commit.hash, onFilesLoaded])

  // Automatically refresh working tree diff when window regains focus
  useEffect(() => {
    if (!isWorktree) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const onFocus = () => {
      if (pendingStageCountRef.current > 0) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (pendingStageCountRef.current === 0) {
          void reloadDiff()
        }
      }, 150)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [isWorktree, reloadDiff])

  const {
    handleStage,
    handleUnstage,
    handleDiscard,
    handleStageAll,
    handleUnstageAll,
    handleCommitSubmit,
    handleStashSubmit,
    handleCreatePatch,
    handleIgnore,
    handleCreateFileSubmit,
    flushPendingStageOps,
  } = useCommitPanelActions({
    repo,
    files: changes?.files || [],
    stagedFiles,
    unstagedFiles,
    onOptimisticFilesChange: handleOptimisticFilesChange,
    pendingStageCountRef,
    commitSummary,
    setCommitSummary,
    commitDesc,
    setCommitDesc,
    amendCommit,
    setAmendCommit,
    skipGitHooks,
    pushAfterCommit,
    setIsCommitting,
    stashTitle,
    setStashTitle,
    stashDesc,
    setStashDesc,
    setIsStashing,
    newFileDialog,
    setNewFileDialog,
    reloadDiff,
    onRefresh,
    onCommitSuccess,
    onSelect,
    notify,
    confirm,
  })

  // AI commit message composer
  const handleAiCompose = async () => {
    if (aiComposing) return
    const useStaged = stagedFiles.length > 0
    const list = useStaged ? stagedFiles : unstagedFiles
    if (list.length === 0) {
      notify.info(t('git.commit.noChangesForMessage') || 'No changes in working tree to generate commit message')
      return
    }

    setAiComposing(true)
    try {
      const driver = getGitDriver()
      const diffSnippets = await Promise.all(
        list.slice(0, 3).map(async (f) => {
          try {
            const res = await driver.readCommitDiff({ repo, hash: GIT_WORKTREE_HASH, file: f.path })
            return { path: f.path, diff: res.patch || '' }
          } catch {
            return { path: f.path, diff: '' }
          }
        })
      )

      const activeProfile = agent?.profiles.find((p) => p.id === agent.activeProfileId)
      const result = await composeCommitMessageWithAi({
        repo,
        files: list.map((f) => ({ path: f.path, status: f.status })),
        diffSnippets,
        config: agent?.config,
        profileId: agent?.activeProfileId,
        profileName: activeProfile?.name,
        redactionOptions: agent?.redactionOptions,
        modelFilter: agent?.modelFilter,
      })

      setCommitSummary(result.summary)
      setCommitDesc(result.description)
      notify.success(t('git.commit.autoCommitSummaryGenerated') || 'Commit summary generated')
    } finally {
      setAiComposing(false)
    }
  }

  // File & Folder Context Menus
  const { handleFileContextMenu, handleFolderContextMenu } = useCommitPanelContextMenus({
    repo,
    commit,
    isWorktree,
    changedFiles,
    openPaths,
    toggleFolder,
    handleStage,
    handleUnstage,
    handleDiscard,
    handleIgnore,
    handleCreatePatch,
    reloadDiff,
    flushPendingStageOps,
    onRefresh,
    onOpenFileHistory,
    onOpenFileBlame,
    onSelect,
    setNewFileDialog,
    setContextMenu,
    notify,
  })

  return (
    <aside
      ref={panelRef}
      data-git-find="files"
      data-git-tree
      data-git-tree-root
      className="relative z-20 flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-line bg-panel outline-none"
      style={{ width: `var(--git-tree-w, ${width}px)` }}
      aria-label={panelTitle}
      tabIndex={-1}
    >
      {/* Single Clean Top Header & View Options Menu */}
      <CommitPanelHeader
        panelTitle={panelTitle}
        badgeCount={badgeCount}
        changes={changes}
        selectedPath={selectedPath}
        onLocateCurrentFile={handleFocusSelectedFile}
        isWorktree={isWorktree}
        worktreeLayout={worktreeLayout}
        onToggleLayout={handleToggleLayout}
        fileQuery={fileQuery}
        setFileQuery={setFileQuery}
        view={view}
        setView={setView}
        canExpand={canExpand}
        allOpen={allOpen}
        onToggleExpandAll={() => {
          const next = !allOpen
          setExpandDefault(next)
          setOpenPaths(next ? new Set(folders) : new Set())
        }}
        onClose={onClose}
        conflictFileCount={conflictFileCount}
        filterConflicts={filterConflicts}
        setConflictsOnly={setConflictsOnly}
      />

      {/* Main Content Area */}
      {error ? (
        <p className="m-0 px-3 py-2 text-xs text-fail">{error}</p>
      ) : !changes || (view === 'all' && !allFiles) ? (
        <div className="flex flex-col gap-2 px-3 py-2" aria-hidden>
          <div className="h-7 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
          <div className="h-7 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
          <div className="h-7 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
        </div>
      ) : isWorktree && worktreeLayout === 'split' ? (
        <WorktreeFileSections
          openUnstaged={openUnstaged}
          setOpenUnstaged={setOpenUnstaged}
          openStaged={openStaged}
          setOpenStaged={setOpenStaged}
          unstagedFiles={unstagedFiles}
          stagedFiles={stagedFiles}
          filteredUnstagedFiles={filteredUnstagedFiles}
          filteredStagedFiles={filteredStagedFiles}
          unstagedQuery={unstagedQuery}
          setUnstagedQuery={setUnstagedQuery}
          stagedQuery={stagedQuery}
          setStagedQuery={setStagedQuery}
          handleStageAll={handleStageAll}
          handleUnstageAll={handleUnstageAll}
          view={view}
          selectedPath={selectedPath}
          conflictCounts={conflictCounts}
          onSelect={onSelect}
          handleFileContextMenu={handleFileContextMenu}
          handleFolderContextMenu={handleFolderContextMenu}
          handleStage={handleStage}
          handleUnstage={handleUnstage}
          handleDiscard={handleDiscard}
          repo={repo}
          openPaths={openPaths}
          toggleFolder={toggleFolder}
          setFolderOpen={setFolderOpen}
          isSearching={isSearching}
        />
      ) : (view === 'all' ? !filteredAllFiles?.length : !filteredChangedFiles.length) ? (
        <EmptyState
          density="compact"
          className="px-3 py-8"
          title={fileNeedle ? t('git.sidebar.noMatches') : t('git.commit.noChanges')}
          message={fileNeedle ? t('git.sidebar.noMatchesHint') : t('git.commit.noChangesMsg')}
        />
      ) : view === 'path' ? (
        <VirtualList
          key="path"
          count={pathRows.length}
          rowHeight={28}
          getRowId={(index) => pathRows[index].id}
          aria-label={t('git.commit.pathListAria')}
          renderRow={(index) => {
            const row = pathRows[index]
            return (
              <PathRows
                groups={[row.group]}
                headerOnly={row.header}
                fileOnly={!row.header}
                selected={selectedPath}
                conflictCounts={conflictCounts}
                onSelect={onSelect}
                onFileContextMenu={handleFileContextMenu}
                onFolderContextMenu={handleFolderContextMenu}
                isWorktree={isWorktree}
                onStage={handleStage}
                onUnstage={handleUnstage}
                onDiscard={handleDiscard}
                repo={repo}
              />
            )
          }}
        />
      ) : (
        <VirtualList
          key={view}
          count={treeRows.length}
          rowHeight={28}
          getRowId={(index) => treeRows[index].node.path}
          aria-label={t(view === 'all' ? 'git.commit.allFilesAria' : 'git.commit.treeAria')}
          renderRow={(index) => {
            const row = treeRows[index]
            return (
              <TreeRows
                nodes={[row.node]}
                depth={row.depth}
                parentId={row.parentId}
                counts={treeCounts}
                open={openPaths}
                selected={selectedPath}
                conflictCounts={conflictCounts}
                onToggle={toggleFolder}
                onSetOpen={setFolderOpen}
                onSelect={onSelect}
                onFileContextMenu={handleFileContextMenu}
                onFolderContextMenu={handleFolderContextMenu}
                isWorktree={isWorktree}
                onStage={handleStage}
                onUnstage={handleUnstage}
                onDiscard={handleDiscard}
                isSearching={isSearching}
                recursive={false}
                repo={repo}
              />
            )
          }}
        />
      )}

      {/* Panel 3: Commit & Stash Panel (Image 3 & 4) */}
      {isWorktree && (
        <GitCommitBox
          openCommit={openCommit}
          setOpenCommit={setOpenCommit}
          bottomTab={bottomTab}
          setBottomTab={setBottomTab}
          commitSettingsBtnRef={commitSettingsBtnRef}
          pushAfterCommit={pushAfterCommit}
          skipGitHooks={skipGitHooks}
          setCommitSettingsAnchor={setCommitSettingsAnchor}
          commitSummary={commitSummary}
          setCommitSummary={setCommitSummary}
          commitDesc={commitDesc}
          setCommitDesc={setCommitDesc}
          commitDescRef={commitDescRef}
          handleCommitSubmit={handleCommitSubmit}
          handleAiCompose={() => void handleAiCompose()}
          aiComposing={aiComposing}
          isCommitting={isCommitting}
          amendCommit={amendCommit}
          setAmendCommit={setAmendCommit}
          stagedFiles={stagedFiles}
          unstagedFiles={unstagedFiles}
          stashTitle={stashTitle}
          setStashTitle={setStashTitle}
          stashDesc={stashDesc}
          setStashDesc={setStashDesc}
          stashDescRef={stashDescRef}
          handleStashSubmit={handleStashSubmit}
          isStashing={isStashing}
        />
      )}

      {/* Floating Menu for Commit Settings */}
      {commitSettingsAnchor ? (
        <FloatingMenu
          anchor={commitSettingsAnchor}
          ignoreRef={commitSettingsBtnRef}
          ariaLabel={t('git.operations.commitOptions') || 'Commit options'}
          color="var(--accent)"
          onClose={() => setCommitSettingsAnchor(null)}
          items={[
            {
              key: 'push-after',
              label: t('git.operations.pushAfterCommit') || 'Push after committing',
              checked: pushAfterCommit,
              onSelect: () => setPushAfterCommit((v) => !v),
            },
            {
              key: 'skip-hooks',
              label: t('git.operations.skipGitHooks') || 'Skip Git hooks',
              checked: skipGitHooks,
              onSelect: () => setSkipGitHooks((v) => !v),
            },
          ]}
        />
      ) : null}

      {/* Floating Context Menu */}
      {contextMenu ? (
        <FloatingMenu anchor={contextMenu.anchor} ariaLabel={contextMenu.ariaLabel} color="var(--accent)" onClose={() => setContextMenu(null)} items={contextMenu.items} />
      ) : null}

      {/* Inline Create File Modal */}
      {newFileDialog && (
        <NewFileDialog
          dialog={newFileDialog}
          onClose={() => setNewFileDialog(null)}
          onChangeName={(fileName) => setNewFileDialog({ ...newFileDialog, fileName })}
          onSubmit={handleCreateFileSubmit}
        />
      )}
    </aside>
  )
}

function areCommitPanelPropsEqual(prev: Props, next: Props): boolean {
  if (prev.repo !== next.repo) return false
  if (prev.remoteUrl !== next.remoteUrl) return false
  if (prev.width !== next.width) return false
  if (prev.title !== next.title) return false
  if (prev.selectedPath !== next.selectedPath) return false
  if (prev.commit.hash !== next.commit.hash || prev.commit.subject !== next.commit.subject) return false
  if (prev.commit.refs.length !== next.commit.refs.length || prev.commit.refs.some((r, i) => r !== next.commit.refs[i])) return false
  if (prev.conflictFiles !== next.conflictFiles) {
    if (!prev.conflictFiles || !next.conflictFiles) return false
    if (prev.conflictFiles.length !== next.conflictFiles.length || prev.conflictFiles.some((f, i) => f !== next.conflictFiles![i])) return false
  }
  if (prev.conflictFileCounts !== next.conflictFileCounts) {
    if (JSON.stringify(prev.conflictFileCounts ?? null) !== JSON.stringify(next.conflictFileCounts ?? null)) return false
  }
  return true
}

export const GitCommitPanel = memo(GitCommitPanelInner, areCommitPanelPropsEqual)
