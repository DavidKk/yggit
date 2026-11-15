'use client'

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { LuChevronsUpDown, LuFolderGit2 } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { measurePanelFit } from '@/components/git/fitColumn'
import { GitCommitPanel } from '@/components/git/GitCommitPanel'
import { GitDebug } from '@/components/git/GitDebug'
import { GitFileDiff } from '@/components/git/GitFileDiff'
import { GIT_FIND_EVENT, useGitFindShortcut } from '@/components/git/gitFind'
import { GitHistory } from '@/components/git/GitHistory'
import { GitProjectMenu } from '@/components/git/GitProjectMenu'
import { GitSidebar } from '@/components/git/GitSidebar'
import { PanelSplitter } from '@/components/git/PanelSplitter'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { Button, EmptyState, Tooltip } from '@/components/sk'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { readApiErrorMessage } from '@/lib/api-error'
import { gitSelectionHash } from '@/lib/git/scope'
import { addTemporaryRepo, parseRemoteUrl } from '@/lib/git/temporary-store'
import {
  GIT_WORKTREE_COMMIT,
  GIT_WORKTREE_HASH,
  type GitCommit,
  type GitLogView,
  type GitProjectView,
  type GitRemoteCheck,
  type GitSelection,
  gitStashAsCommit,
} from '@/lib/git/types'
import { isPositiveNumber, readGitUiPref, repoPrefKey, useGitUiPref, useGitUiReady } from '@/lib/git/ui-prefs'
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
  initialPersistence?: RepositoryPersistence
}

const SIDEBAR_MIN = 200
const TREE_MIN = 220
const MAIN_MIN = 240

function isError(value: Props['initial']): value is { error: string; repo: string } {
  return 'error' in value
}

function repoName(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] || path
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

export function GitLogPage({ initial, initialCommitHash, initialPersistence }: Props) {
  const t = useT()
  const failed = isError(initial)
  const [view, setView] = useState<GitLogView | null>(failed ? null : initial)
  const [error, setError] = useState(failed ? initial.error : '')
  const selectionRepo = failed ? '' : view?.repo || ('repo' in initial ? initial.repo : '')
  const selectionFallback: GitSelection = view ? selectionFor(view) : failed ? { kind: 'all' } : selectionFor(initial)
  const [selection, setSelection] = useGitUiPref(selectionRepo ? repoPrefKey(selectionRepo, 'selection') : 'git.selection.none', selectionFallback, isGitSelection)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [projectSearchRequest, setProjectSearchRequest] = useState(0)
  const [projects, setProjects] = useState<GitProjectView[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [commits, setCommits] = useState<GitCommit[]>(failed ? [] : initial.commits)
  const [hasMore, setHasMore] = useState(failed ? false : initial.hasMore)
  const [focusRequest, setFocusRequest] = useState<{ hash: string } | null>(initialCommitHash ? { hash: initialCommitHash } : null)
  const [selectedHash, setSelectedHash] = useState(initialCommitHash || '')
  const [selectedFile, setSelectedFile] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [sidebarWidth, setSidebarWidth] = useGitUiPref('layout.sidebarWidth', 256, isPositiveNumber)
  const [treeWidth, setTreeWidth] = useGitUiPref('layout.treeWidth', 320, isPositiveNumber)
  const [remoteCheck, setRemoteCheck] = useState<GitRemoteCheck | null>(null)
  const [remoteProbing, setRemoteProbing] = useState(false)
  const worldRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const projectFindRef = useRef<HTMLDivElement>(null)
  useGitFindShortcut(worldRef)

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
  const onPage = useCallback((pageScope: string, next: GitCommit[], more: boolean) => {
    if (pageScope !== scopeRef.current) return
    setCommits(next)
    setHasMore(more)
  }, [])

  const applyCatalog = useCallback((body: { projects?: GitProjectView[]; folders?: string[] }) => {
    if (Array.isArray(body.projects)) setProjects(body.projects)
    if (Array.isArray(body.folders)) setFolders(body.folders)
  }, [])

  const refreshProjects = useCallback(async () => {
    const response = await fetch('/api/git/projects')
    const body = (await response.json()) as { ok?: boolean; projects?: GitProjectView[]; folders?: string[] }
    if (response.ok && body.ok !== false) applyCatalog(body)
  }, [applyCatalog])

  useEffect(() => {
    void refreshProjects()
  }, [refreshProjects, view?.repo])

  const probeRemotes = useCallback(async (repo: string) => {
    setRemoteProbing(true)
    try {
      const params = new URLSearchParams({ repo })
      const response = await fetch(`/api/git/remote-check?${params.toString()}`)
      const body = (await response.json()) as GitRemoteCheck & { ok?: boolean }
      if (!response.ok || body.ok === false) return
      setRemoteCheck(body)
    } catch {
      /* keep last successful probe */
    } finally {
      setRemoteProbing(false)
    }
  }, [])

  useEffect(() => {
    if (!view?.repo) {
      setRemoteCheck(null)
      return
    }
    const repo = view.repo
    void probeRemotes(repo)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void probeRemotes(repo)
    }, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void probeRemotes(repo)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [probeRemotes, view?.repo])

  function applyView(next: GitLogView) {
    const nextSelection = readGitUiPref(repoPrefKey(next.repo, 'selection'), isGitSelection) || selectionFor(next)
    setView(next)
    setSelection(nextSelection)
    setCommits(next.commits)
    setHasMore(next.hasMore)
    setSelectedHash('')
    setSelectedFile('')
    setSelectedStatus('')
    setFocusRequest(null)
    const url = new URL(window.location.href)
    if (url.searchParams.get('repo') !== next.repo) {
      url.searchParams.set('repo', next.repo)
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
    }
  }

  function select(next: GitSelection) {
    setSelection(next)
    setFocusRequest(view ? { hash: gitSelectionHash(view, next) } : null)
  }

  const scope = view ? '*' : ''
  const selectedStash = view?.stashes.find((item) => item.hash === selectedHash)
  const selected =
    selectedHash === GIT_WORKTREE_HASH ? GIT_WORKTREE_COMMIT : selectedStash ? gitStashAsCommit(selectedStash) : commits.find((commit) => commit.hash === selectedHash) || null
  const selectedIsWorktree = selectedHash === GIT_WORKTREE_HASH
  const sidebarWidthRef = useRef(sidebarWidth)
  const treeWidthRef = useRef(treeWidth)
  const selectedRef = useRef(!!selected)
  const selectedFileRef = useRef(!!selectedFile)
  selectedRef.current = !!selected
  selectedFileRef.current = !!selectedFile
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
    if (targetUrl && parseRemoteUrl(targetUrl)) {
      const parsed = parseRemoteUrl(targetUrl)!
      const existing = projects.find((p) => (p.httpsUrl && p.httpsUrl === parsed.remoteUrl) || p.name === parsed.name)
      if (existing?.localPath) {
        void load(existing.localPath)
      } else {
        addTemporaryRepo(parsed)
        void load(parsed.remoteUrl)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !view?.repo) return
    const path = window.location.pathname
    if (path.startsWith('/repo/')) {
      const shareUrl = makeShareUrl(view.repo, selectedHash || undefined)
      if (window.location.pathname !== shareUrl) {
        window.history.replaceState(window.history.state, '', shareUrl)
      }
    } else {
      const url = new URL(window.location.href)
      if (selectedHash) url.searchParams.set('commit', selectedHash)
      else url.searchParams.delete('commit')
      if (url.toString() !== window.location.href) {
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
      }
    }
  }, [selectedHash, view?.repo])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (event.defaultPrevented) return

      if (menuOpen) return

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
  }, [menuOpen])
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
  const commitSidebar = useCallback(() => setSidebarWidth(sidebarWidthRef.current), [])
  const commitTree = useCallback(() => setTreeWidth(treeWidthRef.current), [])
  const fitSidebar = useCallback(() => {
    const panel = frameRef.current?.querySelector('[data-git-sidebar]') as HTMLElement | null
    if (!panel) return
    const fitted = Math.max(SIDEBAR_MIN, measurePanelFit(panel, '[data-git-sidebar-label]', 16))
    setSidebarWidth(applySidebar(fitted))
  }, [applySidebar])
  const fitTree = useCallback(() => {
    const panel = frameRef.current?.querySelector('[data-git-tree]') as HTMLElement | null
    if (!panel) return
    const fitted = Math.max(TREE_MIN, measurePanelFit(panel, '[data-git-tree-label]', 20))
    setTreeWidth(applyTree(fitted))
  }, [applyTree])
  scopeRef.current = scope

  async function load(repo: string) {
    setBusy(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (repo) params.set('repo', repo)
      const response = await fetch(`/api/git/log?${params.toString()}`)
      const body = (await response.json()) as GitLogView & { ok?: boolean; error?: { message?: string } }
      if (!response.ok || body.ok === false) {
        setError(readApiErrorMessage(body, t('git.errors.readGit')))
        return
      }
      applyView(body)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('git.errors.readGit'))
    } finally {
      setBusy(false)
    }
  }

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

  async function chooseFolder() {
    setError('')
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

  async function addRemote(input: { url: string; token?: string; syncAccount?: boolean }) {
    setBusy(true)
    try {
      const response = await fetch('/api/git/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const body = (await response.json()) as { ok?: boolean; projects?: GitProjectView[]; folders?: string[] }
      if (!response.ok || body.ok === false) return readApiErrorMessage(body, t('git.errors.addRemoteFailed'))
      applyCatalog(body)
      return ''
    } catch {
      return t('git.errors.addRemoteFailed')
    } finally {
      setBusy(false)
    }
  }

  async function createFolder(name: string) {
    setBusy(true)
    try {
      const response = await fetch('/api/git/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createFolder', folder: name }),
      })
      const body = (await response.json()) as { ok?: boolean; projects?: GitProjectView[]; folders?: string[] }
      if (!response.ok || body.ok === false) return readApiErrorMessage(body, t('git.errors.createFolderFailed'))
      applyCatalog(body)
      return ''
    } catch {
      return t('git.errors.createFolderFailed')
    } finally {
      setBusy(false)
    }
  }

  async function moveProject(id: string, group: string, beforeId?: string) {
    setBusy(true)
    try {
      const response = await fetch('/api/git/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'moveProject', id, group, beforeId }),
      })
      const body = (await response.json()) as { ok?: boolean; projects?: GitProjectView[]; folders?: string[] }
      if (!response.ok || body.ok === false) return readApiErrorMessage(body, t('git.errors.moveFailed'))
      applyCatalog(body)
      return ''
    } catch {
      return t('git.errors.moveFailed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteFolder(name: string) {
    setBusy(true)
    try {
      const response = await fetch('/api/git/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteFolder', folder: name }),
      })
      const body = (await response.json()) as {
        ok?: boolean
        projects?: GitProjectView[]
        folders?: string[]
        removedCount?: number
      }
      if (!response.ok || body.ok === false) return { error: readApiErrorMessage(body, t('git.errors.deleteFolderFailed')) }
      applyCatalog(body)
      return { error: '', removedCount: body.removedCount || 0 }
    } catch {
      return { error: t('git.errors.deleteFolderFailed') }
    } finally {
      setBusy(false)
    }
  }

  async function cloneProject(project: GitProjectView) {
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
      className="flex h-full min-h-0 flex-1 flex-col bg-paper text-ink"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 70% 45% at 12% -10%, color-mix(in oklab, var(--wt-primary) 12%, transparent), transparent 55%), radial-gradient(ellipse 50% 40% at 88% 110%, color-mix(in oklab, var(--wt-secondary) 14%, transparent), transparent 50%)',
      }}
    >
      {process.env.NODE_ENV === 'development' ? <GitDebug /> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-panel/80">
        <header className="flex shrink-0 items-center gap-3 border-b border-line bg-panel-2/60 px-3 py-1.5">
          <BrandLogo href="/" className="shrink-0" markClassName="size-7" wordmarkClassName="text-[0.95rem]" />
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
                <LuFolderGit2 className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
                <span className="min-w-0 truncate text-[0.8125rem] font-semibold">{view ? repoName(view.repo) : t('git.header.noRepo')}</span>
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
                void load(path)
              }}
              onAddLocal={() => void chooseFolder()}
              onAddRemote={addRemote}
              onClone={cloneProject}
              onCreateFolder={createFolder}
              onDeleteFolder={deleteFolder}
              onMoveProject={moveProject}
            />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ThemeSwitcher compact />
            <LocaleSwitcher compact />
          </div>
        </header>

        {error && !view ? (
          <EmptyState title={t('git.page.repoUnreadable')} message={error} hint={t('git.page.repoUnreadableHint')}>
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
          <div ref={frameRef} className="flex min-h-0 flex-1 overflow-hidden" style={frameStyle}>
            {selected && selectedFile ? (
              <GitFileDiff
                repo={view.repo}
                hash={selected.hash}
                path={selectedFile}
                status={selectedStatus}
                onClose={() => {
                  setSelectedFile('')
                  setSelectedStatus('')
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
                  remoteProbing={remoteProbing}
                  onProbeRemotes={() => void probeRemotes(view.repo)}
                  onSelect={select}
                  onOpenRepo={(repo) => void load(repo)}
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
                <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-line" aria-label={t('git.section.history')}>
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
                      scope={scope}
                      commits={commits}
                      hasMore={hasMore}
                      worktree={view.worktree}
                      stashes={view.stashes}
                      highlight={highlight}
                      remoteNames={[...new Set(view.remotes.map((item) => item.remote))]}
                      worktreeBranches={view.worktrees.filter((item) => item.branch && !item.current).map((item) => item.branch)}
                      selectedHash={selectedHash}
                      focusRequest={focusRequest}
                      onSelect={(commit) => {
                        setSelectedHash(commit.hash)
                        setSelectedFile('')
                        setSelectedStatus('')
                      }}
                      onSelectWorktree={() => {
                        setSelectedHash(GIT_WORKTREE_HASH)
                        setSelectedFile('')
                        setSelectedStatus('')
                      }}
                      onPage={onPage}
                    />
                  )}
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
                  commit={selected}
                  width={treeWidth}
                  title={selectedIsWorktree ? t('git.panel.worktree') : t('git.panel.files')}
                  selectedPath={selectedFile}
                  onSelect={(path, status) => {
                    setSelectedFile(path)
                    setSelectedStatus(status)
                  }}
                  onClose={() => {
                    setSelectedHash('')
                    setSelectedFile('')
                    setSelectedStatus('')
                  }}
                />
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
