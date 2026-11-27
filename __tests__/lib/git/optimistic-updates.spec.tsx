/** @jest-environment jsdom */
import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { useGitBranchActions } from '@/components/git/hooks/useGitBranchActions'
import { useGitProjectActions } from '@/components/git/hooks/useGitProjectActions'
import { useOptimisticGitActions } from '@/components/git/hooks/useOptimisticGitActions'
import { useBranchContextMenu } from '@/components/git/sidebar/useBranchContextMenu'
import { useSidebarContextMenus } from '@/components/git/sidebar/useSidebarContextMenus'
import { DEFAULT_CONTEXT_MENU_CONFIG } from '@/lib/git/context-menu-config'
import { getGitDriver } from '@/lib/git/driver'
import {
  applyIncrementalCommitSuccess,
  applyOptimisticBranchCreate,
  applyOptimisticBranchDelete,
  applyOptimisticClearFolder,
  applyOptimisticCreateFolder,
  applyOptimisticDeleteFolder,
  applyOptimisticMoveProject,
  applyOptimisticRemoteAdd,
  applyOptimisticRemoteRemove,
  applyOptimisticRemoteUpdate,
  applyOptimisticRemoveProject,
  applyOptimisticRenameFolder,
  applyOptimisticSetProjectLabel,
  applyOptimisticTagCreate,
  applyOptimisticTagDelete,
} from '@/lib/git/optimistic-updates'
import type { GitCommit, GitLogView, GitProjectCatalog, GitProjectView } from '@/lib/git/types'

jest.mock('@/lib/git/driver', () => ({
  getGitDriver: jest.fn(),
  getDriverMode: jest.fn(() => 'local'),
}))
jest.mock('@/components/i18n/LocaleProvider', () => {
  const t = (key: string) => key
  return { useT: () => t, useLocaleCode: () => 'en' }
})

function createDeferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeView(): GitLogView {
  return {
    repo: '/tmp/sample',
    displayPath: '/tmp/sample',
    remoteUrl: 'https://github.com/org/repo.git',
    head: 'main',
    branch: 'main',
    branches: [
      { name: 'main', current: true, tip: 'aaaaaaa111111111111111111111111111111111', upstream: 'origin/main', ahead: 0, behind: 0 },
      { name: 'feat/old', current: false, tip: 'bbbbbbb111111111111111111111111111111111', upstream: '' },
    ],
    remotes: [{ name: 'origin/main', remote: 'origin', branch: 'main', tip: 'aaaaaaa111111111111111111111111111111111' }],
    remoteSources: [{ name: 'origin', url: 'https://github.com/org/repo.git' }],
    tags: [{ name: 'v1.0.0', tip: 'bbbbbbb111111111111111111111111111111111' }],
    stashes: [],
    worktrees: [],
    submodules: [],
    commits: [],
    hasMore: false,
    marks: {},
    worktree: { files: 2, insertions: 4, deletions: 1 },
  }
}

function makeCommits(): GitCommit[] {
  return [
    {
      hash: 'aaaaaaa111111111111111111111111111111111',
      short: 'aaaaaaa',
      parents: ['bbbbbbb111111111111111111111111111111111'],
      author: 'Dev User',
      date: '2026-11-27T00:00:00Z',
      refs: ['HEAD -> main', 'origin/main'],
      subject: 'feat: tip',
    },
    {
      hash: 'bbbbbbb111111111111111111111111111111111',
      short: 'bbbbbbb',
      parents: [],
      author: 'Dev User',
      date: '2026-11-26T00:00:00Z',
      refs: ['feat/old', 'tag: v1.0.0'],
      subject: 'init',
    },
  ]
}

function makeCatalog(): GitProjectCatalog {
  const projects: GitProjectView[] = [
    {
      id: '/tmp/p1',
      name: 'p1',
      group: 'Team',
      host: 'github',
      localPath: '/tmp/p1',
      httpsUrl: 'https://github.com/org/p1.git',
      local: true,
      remote: false,
      authorized: true,
    },
    {
      id: '/tmp/p2',
      name: 'p2',
      group: '',
      host: 'local',
      localPath: '/tmp/p2',
      httpsUrl: '',
      local: true,
      remote: false,
      authorized: true,
    },
  ]
  return { projects, folders: ['Team'] }
}

describe('lib/git/optimistic-updates pure state transitions', () => {
  it('optimistically creates and deletes tags across view.tags and commit.refs', () => {
    const initial = { view: makeView(), commits: makeCommits() }
    const created = applyOptimisticTagCreate(initial, 'v1.1.0', 'main')
    expect(created.view.tags).toEqual([
      { name: 'v1.0.0', tip: 'bbbbbbb111111111111111111111111111111111' },
      { name: 'v1.1.0', tip: 'aaaaaaa111111111111111111111111111111111' },
    ])
    expect(created.commits[0].refs).toContain('tag: v1.1.0')

    const deleted = applyOptimisticTagDelete(created, 'v1.1.0')
    expect(deleted.view.tags).toEqual([{ name: 'v1.0.0', tip: 'bbbbbbb111111111111111111111111111111111' }])
    expect(deleted.commits[0].refs).not.toContain('tag: v1.1.0')
  })

  it('optimistically creates and deletes local branches across view.branches and commit.refs', () => {
    const initial = { view: makeView(), commits: makeCommits() }
    const created = applyOptimisticBranchCreate(initial, 'feat/new', 'main', false)
    expect(created.view.branches.map((b) => b.name)).toContain('feat/new')
    expect(created.commits[0].refs).toContain('feat/new')
    expect(created.view.branch).toBe('main')

    const deleted = applyOptimisticBranchDelete(created, 'feat/new')
    expect(deleted.view.branches.map((b) => b.name)).not.toContain('feat/new')
    expect(deleted.commits[0].refs).not.toContain('feat/new')
  })

  it('optimistically adds, updates/renames, and removes remotes', () => {
    const viewWithAdd = applyOptimisticRemoteAdd(makeView(), 'upstream', 'https://github.com/up/repo.git')
    expect(viewWithAdd.remoteSources).toHaveLength(2)

    const updated = applyOptimisticRemoteUpdate({ view: viewWithAdd, commits: makeCommits() }, 'origin', 'primary', 'https://github.com/org/renamed.git')
    expect(updated.view.remoteSources?.find((s) => s.name === 'primary')?.url).toBe('https://github.com/org/renamed.git')
    expect(updated.view.remotes[0]).toMatchObject({ remote: 'primary', name: 'primary/main', branch: 'main' })
    expect(updated.commits[0].refs).toContain('primary/main')

    const removed = applyOptimisticRemoteRemove(updated, 'primary')
    expect(removed.view.remotes).toHaveLength(0)
    expect(removed.view.remoteSources?.map((s) => s.name)).toEqual(['upstream'])
    expect(removed.commits[0].refs).not.toContain('primary/main')
  })

  it('applies post-ack incremental commit prepend and moves HEAD branch tip', () => {
    const initial = { view: makeView(), commits: makeCommits() }
    const next = applyIncrementalCommitSuccess(initial, {
      hash: 'ccccccc111111111111111111111111111111111',
      subject: 'feat: instant commit',
      remainingFilesCount: 0,
    })
    expect(next.commits).toHaveLength(3)
    expect(next.commits[0]).toMatchObject({
      hash: 'ccccccc111111111111111111111111111111111',
      subject: 'feat: instant commit',
      refs: ['HEAD -> main'],
      parents: ['aaaaaaa111111111111111111111111111111111'],
    })
    expect(next.commits[1].refs).toEqual(['origin/main'])
    expect(next.view.branches.find((b) => b.name === 'main')?.tip).toBe('ccccccc111111111111111111111111111111111')
    expect(next.view.worktree).toBeNull()
  })

  it('optimistically updates folders and projects in catalog helpers', () => {
    const base = makeCatalog()
    const c1 = applyOptimisticCreateFolder(base, 'Backend')
    expect(c1.folders).toEqual(['Team', 'Backend'])

    const c2 = applyOptimisticMoveProject(c1, '/tmp/p2', 'Backend', '/tmp/p1')
    expect(c2.projects[0]).toMatchObject({ id: '/tmp/p2', group: 'Backend' })

    const c3 = applyOptimisticSetProjectLabel(c2, '/tmp/p2', 'Core Service')
    expect(c3.projects[0].label).toBe('Core Service')

    const c4 = applyOptimisticRenameFolder(c3, 'Backend', 'Platform')
    expect(c4.folders).toContain('Platform')
    expect(c4.projects[0].group).toBe('Platform')

    const c5 = applyOptimisticClearFolder(c4, 'Platform')
    expect(c5.projects[0].group).toBe('')

    const { catalog: c6, removedCount } = applyOptimisticDeleteFolder(c5, 'Team')
    expect(removedCount).toBe(1)
    expect(c6.folders).toEqual(['Platform'])
    expect(c6.projects.map((p) => p.id)).toEqual(['/tmp/p2'])

    const c7 = applyOptimisticRemoveProject(c6, '/tmp/p2')
    expect(c7.projects).toHaveLength(0)
  })
})

describe('Git optimistic hooks rollback & error-only toast behavior', () => {
  let root: Root
  let container: HTMLDivElement

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    jest.clearAllMocks()
  })

  it('updates branch state immediately without success toast and rolls back with error toast on reject', async () => {
    const createDeferredOp = createDeferred<{ ok: boolean; message: string }>()
    const deleteDeferredOp = createDeferred<{ ok: boolean; message: string }>()
    const mockDriver = {
      createBranch: jest.fn(() => createDeferredOp.promise),
      deleteBranch: jest.fn(() => deleteDeferredOp.promise),
    }
    jest.mocked(getGitDriver).mockReturnValue(mockDriver as unknown as ReturnType<typeof getGitDriver>)

    const notification = { success: jest.fn(), error: jest.fn() }
    const setBusy = jest.fn()
    const loadRef = { current: jest.fn(async () => {}) }
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    let api!: ReturnType<typeof useGitBranchActions> & {
      getView: () => GitLogView | null
      getCommits: () => GitCommit[]
    }

    function Harness() {
      const [view, setView] = useState<GitLogView | null>(() => makeView())
      const [commits, setCommits] = useState<GitCommit[]>(() => makeCommits())
      const viewRef = useRef(view)
      viewRef.current = view
      const commitsRef = useRef(commits)
      commitsRef.current = commits

      const { runWithGraphRollback } = useOptimisticGitActions({
        viewRef,
        commitsRef,
        setView,
        setCommits,
        onError: notification.error,
      })

      const actions = useGitBranchActions({
        view,
        loadRef,
        notification,
        setBusy,
        setProgressStage: jest.fn(),
        setRenameModal: jest.fn(),
        setCreateBranchModal: jest.fn(),
        runWithGraphRollback,
      })

      api = {
        ...actions,
        getView: () => viewRef.current,
        getCommits: () => commitsRef.current,
      }
      return null
    }

    await act(async () => {
      root.render(<Harness />)
    })

    // Create branch without checkout -> 0ms update, no busy spinner, no success toast
    let createPromise!: Promise<void>
    await act(async () => {
      createPromise = api.executeCreateBranch('feat/instant', 'main', false)
    })

    expect(setBusy).not.toHaveBeenCalled()
    expect(api.getView()?.branches.map((b) => b.name)).toContain('feat/instant')
    expect(api.getCommits()[0].refs).toContain('feat/instant')

    await act(async () => {
      createDeferredOp.resolve({ ok: true, message: 'Created' })
      await createPromise
    })
    expect(notification.success).not.toHaveBeenCalled()
    expect(notification.error).not.toHaveBeenCalled()

    // Delete branch rejects -> immediate removal followed by clean rollback & error toast
    let deletePromise!: Promise<void>
    await act(async () => {
      deletePromise = api.handleDeleteBranch('feat/old')
    })
    expect(api.getView()?.branches.map((b) => b.name)).not.toContain('feat/old')
    expect(api.getCommits()[1].refs).not.toContain('feat/old')

    await act(async () => {
      deleteDeferredOp.reject(new Error('Branch is unmerged'))
      await deletePromise
    })

    expect(api.getView()?.branches.map((b) => b.name)).toContain('feat/old')
    expect(api.getCommits()[1].refs).toContain('feat/old')
    expect(notification.error).toHaveBeenCalledWith('Branch is unmerged')
    expect(notification.success).not.toHaveBeenCalled()
    expect(loadRef.current).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('mutates project/folder catalog optimistically without busy lockouts and rolls back on failure', async () => {
    const renameDeferred = createDeferred<GitProjectCatalog>()
    const setLabelDeferred = createDeferred<GitProjectCatalog>()
    const mockDriver = {
      renameFolder: jest.fn(() => renameDeferred.promise),
      setProjectLabel: jest.fn(() => setLabelDeferred.promise),
    }
    jest.mocked(getGitDriver).mockReturnValue(mockDriver as unknown as ReturnType<typeof getGitDriver>)

    const notification = { success: jest.fn(), error: jest.fn() }
    const setBusy = jest.fn()

    let catalogActions!: ReturnType<typeof useGitProjectActions>
    let getCatalog!: () => GitProjectCatalog

    function CatalogHarness() {
      const [projects, setProjects] = useState<GitProjectView[]>(() => makeCatalog().projects)
      const [folders, setFolders] = useState<string[]>(() => makeCatalog().folders)
      const projectsRef = useRef(projects)
      projectsRef.current = projects
      const foldersRef = useRef(folders)
      foldersRef.current = folders

      catalogActions = useGitProjectActions({
        view: makeView(),
        scope: '/tmp/sample',
        t: ((key: string) => key) as never,
        notification,
        applyCatalog: (body) => {
          if (body.projects) setProjects(body.projects)
          if (body.folders) setFolders(body.folders)
        },
        projectsRef,
        foldersRef,
        refreshProjects: jest.fn(async () => {}),
        closeMenu: jest.fn(),
        load: jest.fn(async () => {}),
        setPicking: jest.fn(),
        setBusy,
        setProgressStage: jest.fn(),
        setError: jest.fn(),
        setView: jest.fn(),
        setCommits: jest.fn(),
        setHasMore: jest.fn(),
        setSelection: jest.fn(),
        setSelectedHash: jest.fn(),
        setSelectedFile: jest.fn(),
      })

      getCatalog = () => ({ projects: projectsRef.current, folders: foldersRef.current })
      return null
    }

    await act(async () => {
      root.render(<CatalogHarness />)
    })

    let renamePromise!: Promise<string>
    await act(async () => {
      renamePromise = catalogActions.renameFolder('Team', 'CoreTeam')
    })

    expect(setBusy).not.toHaveBeenCalled()
    expect(getCatalog().folders).toEqual(['CoreTeam'])
    expect(getCatalog().projects[0].group).toBe('CoreTeam')

    await act(async () => {
      renameDeferred.resolve(getCatalog())
      const err = await renamePromise
      expect(err).toBe('')
    })
    expect(notification.success).not.toHaveBeenCalled()

    // Failed label update rolls back cleanly and returns error string
    let labelPromise!: Promise<string>
    await act(async () => {
      labelPromise = catalogActions.setProjectLabel('/tmp/p1', 'Broken Alias')
    })
    expect(getCatalog().projects[0].label).toBe('Broken Alias')

    let errMsg = ''
    await act(async () => {
      setLabelDeferred.reject(new Error('Catalog write denied'))
      errMsg = await labelPromise
    })
    expect(errMsg).toBe('Catalog write denied')
    expect(getCatalog().projects[0].label).toBeUndefined()
  })

  it('updates tags & remotes optimistically across context menus and rolls back on failure without success toasts', async () => {
    const createTagDeferred = createDeferred<{ ok: boolean; message: string }>()
    const removeRemoteDeferred = createDeferred<{ ok: boolean; message: string }>()
    const mockDriver = {
      createTag: jest.fn(() => createTagDeferred.promise),
      deleteTag: jest.fn(async () => ({ ok: true, message: 'Deleted tag' })),
      removeRemote: jest.fn(() => removeRemoteDeferred.promise),
    }
    jest.mocked(getGitDriver).mockReturnValue(mockDriver as unknown as ReturnType<typeof getGitDriver>)

    const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() }
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('v2.0.0')
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    type MenuNode = { key?: string; onSelect?: () => void | Promise<void>; children?: MenuNode[] }
    const findMenuItem = (items: MenuNode[], key: string): MenuNode | undefined => {
      for (const item of items) {
        if (item.key === key) return item
        if (item.children) {
          const hit = findMenuItem(item.children, key)
          if (hit) return hit
        }
      }
      return undefined
    }

    let latestMenus: MenuNode[] = []
    let openTagMenu!: (e: React.MouseEvent, tag: { name: string; tip: string }) => void
    let openRemoteMenu!: ReturnType<typeof useSidebarContextMenus>['handleRemoteGroupContextMenu']
    let getView!: () => GitLogView | null
    let getCommits!: () => GitCommit[]
    let openBranchMenu!: ReturnType<typeof useBranchContextMenu>

    function ContextHarness() {
      const [view, setView] = useState<GitLogView | null>(() => makeView())
      const [commits, setCommits] = useState<GitCommit[]>(() => makeCommits())
      const viewRef = useRef(view)
      viewRef.current = view
      const commitsRef = useRef(commits)
      commitsRef.current = commits

      const { runWithGraphRollback } = useOptimisticGitActions({
        viewRef,
        commitsRef,
        setView,
        setCommits,
        onError: notify.error,
      })

      openBranchMenu = useBranchContextMenu({
        view: view!,
        isEdge: false,
        contextConfig: DEFAULT_CONTEXT_MENU_CONFIG,
        notify,
        runWithGraphRollback,
        setSetUpstreamBranch: jest.fn(),
        setPinnedBranches: jest.fn(),
        pinnedBranches: [],
        setHiddenBranches: jest.fn(),
        hiddenBranches: [],
        onSelect: jest.fn(),
        setContextMenu: (m) => {
          latestMenus = (m?.items || []) as typeof latestMenus
        },
      })

      const sidebarMenus = useSidebarContextMenus({
        view: view!,
        soloRemote: null,
        hiddenRemotes: [],
        openRemotes: {},
        setOpenRemotes: jest.fn(),
        remoteDefault: false,
        toggleFolder: jest.fn(),
        setContextMenu: (m) => {
          latestMenus = (m?.items || []) as typeof latestMenus
        },
        setHiddenStashes: jest.fn(),
        copyValue: jest.fn(),
        setDeleteFolderModal: jest.fn(),
        setEditRemoteState: jest.fn(),
        notify,
        runWithGraphRollback,
      })

      openTagMenu = sidebarMenus.handleTagContextMenu
      openRemoteMenu = sidebarMenus.handleRemoteGroupContextMenu
      getView = () => viewRef.current
      getCommits = () => commitsRef.current

      return null
    }

    await act(async () => {
      root.render(<ContextHarness />)
    })

    // Exercise actual useBranchContextMenu handler -> invokes buildBranchContextMenu internally
    const fakeEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn(), clientX: 0, clientY: 0 } as unknown as React.MouseEvent
    await act(async () => {
      openBranchMenu(fakeEvent, { name: 'main', path: 'main', current: true, tip: 'aaaaaaa111111111111111111111111111111111', upstream: '' }, 'local')
    })

    const createTagItem = findMenuItem(latestMenus, 'create-tag')
    expect(createTagItem).toBeDefined()

    let tagPromise!: Promise<void> | void
    await act(async () => {
      tagPromise = createTagItem?.onSelect?.()
    })
    expect(getView()?.tags.map((t) => t.name)).toContain('v2.0.0')
    expect(getCommits()[0].refs).toContain('tag: v2.0.0')

    await act(async () => {
      createTagDeferred.resolve({ ok: true, message: 'Tagged' })
      await tagPromise
    })
    expect(notify.success).not.toHaveBeenCalled()

    // Delete tag immediately removes v2.0.0 from view & commit.refs
    await act(async () => {
      openTagMenu(fakeEvent, { name: 'v2.0.0', tip: 'aaaaaaa111111111111111111111111111111111' })
    })
    const deleteTagItem = latestMenus.find((i) => i.key === 'delete-tag')
    await act(async () => {
      await deleteTagItem?.onSelect?.()
    })
    expect(getView()?.tags.map((t) => t.name)).not.toContain('v2.0.0')
    expect(getCommits()[0].refs).not.toContain('tag: v2.0.0')
    expect(notify.success).not.toHaveBeenCalled()

    // Remote removal optimistic -> rejects -> restores origin remote + remotes + commit refs
    await act(async () => {
      openRemoteMenu(fakeEvent, { source: 'origin', count: 1, tree: [] })
    })
    const removeRemoteItem = latestMenus.find((i) => i.key === 'remove-remote')
    let removePromise!: Promise<void> | void
    await act(async () => {
      removePromise = removeRemoteItem?.onSelect?.()
    })
    expect(getView()?.remoteSources).toHaveLength(0)
    expect(getView()?.remotes).toHaveLength(0)
    expect(getCommits()[0].refs).not.toContain('origin/main')

    await act(async () => {
      removeRemoteDeferred.reject(new Error('Config lock failed'))
      await removePromise
    })
    expect(getView()?.remoteSources).toHaveLength(1)
    expect(getView()?.remotes).toHaveLength(1)
    expect(getCommits()[0].refs).toContain('origin/main')
    expect(notify.error).toHaveBeenCalledWith('Config lock failed')
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.info).not.toHaveBeenCalled()

    promptSpy.mockRestore()
    confirmSpy.mockRestore()
  })
})
