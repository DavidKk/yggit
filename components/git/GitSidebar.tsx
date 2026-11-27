'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuChevronDown, LuChevronRight, LuChevronsDownUp, LuChevronsUpDown, LuCrosshair, LuPlus } from 'react-icons/lu'

import { AnimatedCounter } from '@/components/git/AnimatedCounter'
import { GitSearchDropdown } from '@/components/git/GitSearchDropdown'
import type { RunWithGraphRollback } from '@/components/git/hooks/useOptimisticGitActions'
import { FloatingMenu, type FloatingMenuItem } from '@/components/git/RefChipsCell'
import { SidebarModals } from '@/components/git/sidebar/SidebarModals'
import {
  buildBranchTree,
  collectFolderIds,
  groupRemotes,
  isSectionMap,
  isSectionQueries,
  nameMatch,
  SECTION_DEFAULT,
  SECTION_EMPTY_KEY,
  type SectionId,
  sectionsOf,
  selectionKey,
} from '@/components/git/sidebar/sidebarUtils'
import { useBranchContextMenu } from '@/components/git/sidebar/useBranchContextMenu'
import { useSidebarContextMenus } from '@/components/git/sidebar/useSidebarContextMenus'
import { useSidebarSections } from '@/components/git/sidebar/useSidebarSections'
import { handleTreeExpandKey } from '@/components/git/treeExpandKey'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, EmptyState, VirtualList } from '@/components/sk'
import { copyToClipboard } from '@/lib/clipboard'
import { useContextMenuConfig } from '@/lib/git/context-menu-config'
import { useGitDriver } from '@/lib/git/driver'
import type { GitLogView, GitRemoteProbe, GitSelection } from '@/lib/git/types'
import { isBoolean, isRecordBoolean, repoPrefKey, useGitUiPref, useGitUiReady } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'

type Props = {
  view: GitLogView
  selection: GitSelection
  width: number
  remoteUpdates?: GitRemoteProbe[]
  remoteProbing?: boolean
  onProbeRemotes?: () => void
  onSelect: (selection: GitSelection) => void
  onOpenRepo: (repo: string) => void
  onCheckoutBranch?: (branch: string, isRemote?: boolean) => Promise<void> | void
  onCreateBranch?: (branch: string, startPoint?: string) => void
  onDeleteBranch?: (branch: string) => void
  onRenameBranch?: (oldName: string) => void
  onMergeBranch?: (branch: string) => void
  onRebaseBranch?: (branch: string) => void
  onPushBranch?: (branch: string) => void
  onPullBranch?: (branch: string) => void
  onStashAction?: (action: 'apply' | 'pop' | 'drop', index: number) => void
  soloBranch?: string | null
  onSoloBranch?: (branch: string | null) => void
  soloRemote?: string | null
  onSoloRemote?: (remote: string | null) => void
  hiddenRemotes?: string[]
  onToggleHideRemote?: (remote: string) => void
  onAddWorktree?: () => void
  onBranchHoverStart?: (branchName: string) => void
  onBranchHoverEnd?: () => void
  onRefresh?: () => Promise<void> | void
  runWithGraphRollback?: RunWithGraphRollback
}

export function GitSidebar({
  view,
  selection,
  width,
  remoteUpdates = [],
  onSelect,
  onOpenRepo,
  onCheckoutBranch,
  onCreateBranch,
  onDeleteBranch,
  onRenameBranch,
  onMergeBranch,
  onRebaseBranch,
  onPushBranch,
  onPullBranch,
  onStashAction,
  soloBranch,
  onSoloBranch,
  soloRemote,
  onSoloRemote,
  hiddenRemotes,
  onToggleHideRemote,
  onAddWorktree,
  onBranchHoverStart,
  onBranchHoverEnd,
  onRefresh,
  runWithGraphRollback,
}: Props) {
  const t = useT()
  const ready = useGitUiReady()
  const { isEdge } = useGitDriver()
  const [deleteFolderModal, setDeleteFolderModal] = useState<{
    open: boolean
    folderLabel: string
    branchesToDelete: string[]
    skippedCurrentBranch: string | null
  } | null>(null)
  const [editRemoteState, setEditRemoteState] = useState<{ open: boolean; remote: string; url: string }>({ open: false, remote: '', url: '' })
  const [addRemoteOpen, setAddRemoteOpen] = useState(false)
  const [setUpstreamBranch, setSetUpstreamBranch] = useState<string | null>(null)
  const [openRaw, setOpen] = useGitUiPref(repoPrefKey(view.repo, 'sections'), SECTION_DEFAULT, isSectionMap)
  const open = sectionsOf(openRaw)
  const [openRemotes, setOpenRemotes] = useGitUiPref(repoPrefKey(view.repo, 'remotes'), {} as Record<string, boolean>, isRecordBoolean)
  const [openFolders, setOpenFolders] = useGitUiPref(repoPrefKey(view.repo, 'folders'), {} as Record<string, boolean>, isRecordBoolean)
  const [folderDefault, setFolderDefault] = useGitUiPref(repoPrefKey(view.repo, 'folderDefault'), true, isBoolean)
  const [remoteDefault, setRemoteDefault] = useGitUiPref(repoPrefKey(view.repo, 'remoteDefault'), true, isBoolean)
  const [queries, setQueries] = useGitUiPref(repoPrefKey(view.repo, 'sectionQueries'), {} as Partial<Record<SectionId, string>>, isSectionQueries)
  const [searchMenuOpen, setSearchMenuOpen] = useState<Partial<Record<SectionId, boolean>>>({})
  const active = selectionKey(selection)

  useEffect(() => {
    function onClearSearches() {
      setQueries({})
      setSearchMenuOpen({})
    }
    window.addEventListener('yggit:clear_searches', onClearSearches)
    return () => window.removeEventListener('yggit:clear_searches', onClearSearches)
  }, [setQueries])

  useEffect(() => {
    setQueries({})
    setSearchMenuOpen({})
  }, [view.repo, setQueries])

  useEffect(() => {
    function onUiNavigate(e: Event) {
      const customEvent = e as CustomEvent<{ target: string }>
      const target = customEvent.detail?.target
      if (target === 'panel_worktree') {
        setOpen((prev) => ({ ...prev, worktree: true }))
      } else if (target === 'panel_branches') {
        setOpen((prev) => ({ ...prev, local: true, remote: true }))
      } else if (target === 'panel_stash') {
        setOpen((prev) => ({ ...prev, stash: true }))
      } else if (target === 'panel_tags') {
        setOpen((prev) => ({ ...prev, tag: true }))
      }
    }
    window.addEventListener('yggit:ui_navigate', onUiNavigate)
    return () => window.removeEventListener('yggit:ui_navigate', onUiNavigate)
  }, [setOpen])

  function needleOf(id: SectionId) {
    return (queries[id] || '').trim().toLowerCase()
  }

  const rawLocalNeedle = needleOf('local')
  const rawRemoteNeedle = needleOf('remote')
  const localNeedle = rawLocalNeedle || rawRemoteNeedle
  const remoteNeedle = rawRemoteNeedle || rawLocalNeedle
  const stashNeedle = needleOf('stash')
  const tagNeedle = needleOf('tag')
  const worktreeNeedle = needleOf('worktree')
  const submoduleNeedle = needleOf('submodule')

  const localTree = useMemo(
    () =>
      buildBranchTree(
        view.branches
          .filter((branch) => nameMatch(branch.name, localNeedle))
          .map((branch) => ({
            name: branch.name,
            path: branch.name,
            current: branch.current,
            tip: branch.tip,
            ahead: branch.ahead,
            behind: branch.behind,
            upstream: branch.upstream,
          }))
      ),
    [localNeedle, view.branches]
  )

  const remoteGroups = useMemo(() => groupRemotes(view.remotes), [view.remotes])
  const remoteTrees = useMemo(
    () =>
      remoteGroups
        .map((group) => {
          const branches = group.branches.filter(
            (remote) => nameMatch(remote.name, remoteNeedle) || nameMatch(remote.branch || '', remoteNeedle) || nameMatch(remote.remote, remoteNeedle)
          )
          return {
            source: group.source,
            count: branches.length,
            branches: group.branches,
            tree: buildBranchTree(
              branches.map((remote) => ({
                name: remote.name,
                path: remote.branch || remote.name,
                title: remote.name,
                tip: remote.tip,
              }))
            ),
          }
        })
        .filter((group) => !remoteNeedle || group.count > 0),
    [remoteGroups, remoteNeedle]
  )

  const [hiddenStashes, setHiddenStashes] = useGitUiPref(repoPrefKey(view.repo, 'hiddenStashes'), [] as string[], Array.isArray)
  const [hiddenTags, _setHiddenTags] = useGitUiPref(repoPrefKey(view.repo, 'hiddenTags'), [] as string[], Array.isArray)
  const [hiddenBranches, setHiddenBranches] = useGitUiPref(repoPrefKey(view.repo, 'hiddenBranches'), [] as string[], Array.isArray)
  const [pinnedBranches, setPinnedBranches] = useGitUiPref(repoPrefKey(view.repo, 'pinnedBranches'), [] as string[], Array.isArray)

  const filteredStashes = useMemo(
    () => view.stashes.filter((stash) => !hiddenStashes.includes(stash.name)).filter((stash) => nameMatch(stash.name, stashNeedle) || nameMatch(stash.subject || '', stashNeedle)),
    [stashNeedle, view.stashes, hiddenStashes]
  )
  const filteredTags = useMemo(() => view.tags.filter((tag) => !hiddenTags.includes(tag.name)).filter((tag) => nameMatch(tag.name, tagNeedle)), [tagNeedle, view.tags, hiddenTags])
  const filteredWorktrees = useMemo(
    () => view.worktrees.filter((entry) => nameMatch(entry.branch || '', worktreeNeedle) || nameMatch(entry.path, worktreeNeedle)),
    [view.worktrees, worktreeNeedle]
  )
  const filteredSubmodules = useMemo(
    () => view.submodules.filter((sub) => nameMatch(sub.path, submoduleNeedle) || nameMatch(sub.describe || '', submoduleNeedle)),
    [submoduleNeedle, view.submodules]
  )

  const localMatchCount = useMemo(() => view.branches.filter((branch) => nameMatch(branch.name, localNeedle)).length, [localNeedle, view.branches])
  const remoteMatchCount = useMemo(
    () => view.remotes.filter((remote) => nameMatch(remote.name, remoteNeedle) || nameMatch(remote.branch || '', remoteNeedle)).length,
    [remoteNeedle, view.remotes]
  )

  const localFolderIds = useMemo(() => collectFolderIds(localTree, 'local'), [localTree])
  const remoteFolderIds = useMemo(() => remoteTrees.flatMap((group) => collectFolderIds(group.tree, `remote:${group.source}`)), [remoteTrees])

  const isBranchSearching = Boolean(localNeedle || remoteNeedle || rawLocalNeedle || rawRemoteNeedle)
  const folderOpen = (id: string) => {
    if (isBranchSearching) return true
    return openFolders[id] ?? folderDefault
  }
  const setFolderOpen = (id: string, next: boolean) => setOpenFolders((prev) => ({ ...prev, [id]: next }))
  const toggleFolder = (id: string) => setFolderOpen(id, !(openFolders[id] ?? folderDefault))

  const localAllOpen = localFolderIds.length > 0 && localFolderIds.every((id) => openFolders[id] ?? folderDefault)
  const remoteSourcesOpen = remoteTrees.length > 0 && remoteTrees.every((group) => openRemotes[group.source] ?? remoteDefault)
  const remoteFoldersOpen = remoteFolderIds.length === 0 || remoteFolderIds.every((id) => openFolders[id] ?? folderDefault)
  const remoteAllOpen = remoteSourcesOpen && remoteFoldersOpen && (remoteTrees.length > 0 || remoteFolderIds.length > 0)

  const setFolders = (ids: string[], next: boolean) => {
    setOpenFolders((prev) => {
      const copy = { ...prev }
      for (const id of ids) copy[id] = next
      return copy
    })
  }

  const toggleLocalAll = () => {
    const next = !localAllOpen
    setFolderDefault(next)
    setFolders(localFolderIds, next)
  }

  const toggleRemoteAll = () => {
    const next = !remoteAllOpen
    setRemoteDefault(next)
    setFolderDefault(next)
    setOpenRemotes((prev) => {
      const copy = { ...prev }
      for (const group of remoteTrees) copy[group.source] = next
      return copy
    })
    setFolders(remoteFolderIds, next)
  }

  const updateByName = useMemo(() => new Map(remoteUpdates.map((item) => [item.name, item])), [remoteUpdates])
  const updatesByRemote = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of remoteUpdates) map.set(item.remote, (map.get(item.remote) || 0) + 1)
    return map
  }, [remoteUpdates])

  const notify = useNotification()
  const [contextMenu, setContextMenu] = useState<{
    anchor: { x: number; y: number }
    ariaLabel: string
    items: FloatingMenuItem[]
  } | null>(null)

  const copyValue = async (value: string) => {
    const ok = await copyToClipboard(value)
    if (ok) notify.success(t('common.copied') || 'Copied')
    else notify.error(t('common.copyFailed') || 'Copy failed')
  }

  const [contextConfig] = useContextMenuConfig()
  const asideRef = useRef<HTMLElement>(null)

  const focusCurrentBranch = useCallback(() => {
    const currentBranch = view.branch || view.head
    if (!currentBranch) return

    setOpen((prev) => ({ ...prev, local: true }))

    const parts = currentBranch.split('/')
    if (parts.length > 1) {
      setOpenFolders((prev) => {
        const next = { ...prev }
        let accum = ''
        for (let i = 0; i < parts.length - 1; i++) {
          accum = accum ? `${accum}/${parts[i]}` : parts[i]
          next[`local:${accum}`] = true
        }
        return next
      })
    }

    setTimeout(() => {
      const safeBranch = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(currentBranch) : currentBranch.replace(/["\\]/g, '\\$&')
      const el = asideRef.current?.querySelector(`[data-git-sidebar-branch="${safeBranch}"]`) as HTMLElement | null
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        el.classList.add('ring-2', 'ring-accent', 'ring-offset-1')
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-accent', 'ring-offset-1')
        }, 1200)
      }
    }, 60)
  }, [view.branch, view.head, setOpen, setOpenFolders])

  const handleBranchContextMenu = useBranchContextMenu({
    view,
    isEdge,
    soloBranch,
    contextConfig,
    notify,
    onCheckoutBranch,
    onCreateBranch,
    onDeleteBranch,
    onRenameBranch,
    onMergeBranch,
    onRebaseBranch,
    onPushBranch,
    onPullBranch,
    onSoloBranch,
    onRefresh,
    runWithGraphRollback,
    setSetUpstreamBranch,
    setPinnedBranches,
    pinnedBranches,
    setHiddenBranches,
    hiddenBranches,
    onSelect,
    setContextMenu,
  })
  const { handleTagContextMenu, handleStashContextMenu, handleWorktreeContextMenu, handleFolderContextMenu, handleRemoteGroupContextMenu } = useSidebarContextMenus({
    view,
    onRefresh,
    onCheckoutBranch,
    onSoloRemote,
    onToggleHideRemote,
    onStashAction,
    soloRemote,
    hiddenRemotes,
    openRemotes,
    setOpenRemotes,
    remoteDefault,
    toggleFolder,
    setContextMenu,
    setHiddenStashes,
    copyValue,
    setDeleteFolderModal,
    setEditRemoteState,
    notify,
    runWithGraphRollback,
  })

  const sections = useSidebarSections({
    view,
    localMatchCount,
    localAllOpen,
    localFolderIds,
    toggleLocalAll,
    localTree,
    folderOpen,
    toggleFolder,
    setFolderOpen,
    onSelect,
    handleBranchContextMenu,
    handleFolderContextMenu,
    onCheckoutBranch,
    setSetUpstreamBranch,
    soloBranch,
    onBranchHoverStart,
    onBranchHoverEnd,
    remoteMatchCount,
    remoteUpdates,
    remoteAllOpen,
    remoteTrees,
    remoteFolderIds,
    toggleRemoteAll,
    remoteNeedle,
    openRemotes,
    remoteDefault,
    updatesByRemote,
    setOpenRemotes,
    handleRemoteGroupContextMenu,
    soloRemote,
    hiddenRemotes,
    updateByName,
    filteredStashes,
    active,
    handleStashContextMenu,
    filteredTags,
    handleTagContextMenu,
    filteredWorktrees,
    handleWorktreeContextMenu,
    filteredSubmodules,
    onOpenRepo,
  })
  const expandedOf = (id: SectionId) => {
    if (!ready) return false
    const needle = id === 'local' ? localNeedle : id === 'remote' ? remoteNeedle : needleOf(id)
    if (needle) return true
    return Boolean(open[id])
  }

  return (
    <aside
      ref={asideRef}
      data-git-sidebar
      data-git-tree-root
      className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden select-text"
      style={{ width: `var(--git-sidebar-w, ${width}px)` }}
      onPointerLeave={() => onBranchHoverEnd?.()}
    >
      <nav aria-label={t('git.sidebar.navAria')} className="flex min-h-0 flex-1 flex-col pt-1 pb-2" aria-busy={!ready || undefined}>
        {sections.map((section) => {
          const expanded = expandedOf(section.id)
          const Icon = section.icon
          const sectionId = `section:${section.id}`
          const rawNeedle = needleOf(section.id)
          const needle = section.id === 'local' ? localNeedle : section.id === 'remote' ? remoteNeedle : rawNeedle
          const empty = section.total === 0
          const noMatch = !empty && Boolean(needle) && section.matchCount === 0
          const badgeCount = ready && needle ? section.matchCount : section.total
          const toolsPinned = Boolean(needle) || Boolean(searchMenuOpen[section.id])
          return (
            <section
              key={section.id}
              data-git-find={`sidebar-${section.id}`}
              className={cn('group/sec flex flex-col', expanded ? 'min-h-8 flex-1 border-b border-transparent hover:border-line' : 'shrink-0')}
            >
              <div className="flex h-8 w-full shrink-0 items-center">
                <Button
                  variant="plain"
                  data-git-tree-id={sectionId}
                  className="h-8 min-w-0 flex-1 justify-start whitespace-nowrap px-3 font-normal text-ink-soft hover:enabled:bg-transparent"
                  aria-expanded={expanded}
                  onClick={() => setOpen((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                  onKeyDown={(event) => handleTreeExpandKey(event, expanded, (next) => setOpen((prev) => ({ ...prev, [section.id]: next })))}
                >
                  {expanded ? <LuChevronDown className="size-3.5 shrink-0" aria-hidden /> : <LuChevronRight className="size-3.5 shrink-0" aria-hidden />}
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span data-git-sidebar-label className="shrink-0 whitespace-nowrap">
                    {section.title}
                  </span>
                  <Badge tone="neutral" size="mini" dot={false} className="shrink-0">
                    <AnimatedCounter value={badgeCount} max={999} />
                  </Badge>
                  {section.notice && section.notice > 0 ? (
                    <Badge tone="accent" size="mini" dot={false} className="shrink-0" title={t('git.sidebar.remotePending')}>
                      <AnimatedCounter value={section.notice} max={99} />
                    </Badge>
                  ) : null}
                </Button>
                <div
                  className={cn(
                    'flex shrink-0 items-center transition-opacity',
                    toolsPinned
                      ? 'opacity-100'
                      : 'pointer-events-none opacity-0 group-hover/sec:pointer-events-auto group-hover/sec:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100'
                  )}
                >
                  {section.expand && !section.expand.disabled ? (
                    <Button
                      variant="plain"
                      size="icon"
                      className="size-6 shrink-0 text-ink-soft hover:enabled:bg-[var(--overlay-08)]"
                      aria-label={section.expand.allOpen ? t('git.sidebar.collapseAll') : t('git.sidebar.expandAll')}
                      aria-pressed={section.expand.allOpen}
                      tooltip={section.expand.allOpen ? t('git.sidebar.collapseAll') : t('git.sidebar.expandAll')}
                      onClick={section.expand.onToggle}
                    >
                      {section.expand.allOpen ? <LuChevronsDownUp className="size-3.5" aria-hidden /> : <LuChevronsUpDown className="size-3.5" aria-hidden />}
                    </Button>
                  ) : null}
                  {section.id === 'local' && (
                    <Button
                      variant="plain"
                      size="icon"
                      className="size-6 shrink-0 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-accent"
                      aria-label={t('git.operations.locateCurrentBranch') || 'Locate current branch'}
                      tooltip={t('git.operations.locateCurrentBranch') || 'Locate current branch'}
                      onClick={(e) => {
                        e.stopPropagation()
                        focusCurrentBranch()
                      }}
                    >
                      <LuCrosshair className="size-3.5" aria-hidden />
                    </Button>
                  )}
                  {section.id === 'remote' && (
                    <Button
                      variant="plain"
                      size="icon"
                      className="size-6 shrink-0 text-ink-soft hover:enabled:bg-[var(--overlay-08)]"
                      aria-label={t('git.operations.addRemoteTitle') || 'Add remote'}
                      tooltip={t('git.operations.addRemoteTitle') || 'Add remote'}
                      onClick={(e) => {
                        e.stopPropagation()
                        setAddRemoteOpen(true)
                      }}
                    >
                      <LuPlus className="size-3.5" aria-hidden />
                    </Button>
                  )}
                  {section.id === 'worktree' && onAddWorktree ? (
                    <Button
                      variant="plain"
                      size="icon"
                      className="size-6 shrink-0 text-ink-soft hover:enabled:bg-[var(--overlay-08)]"
                      aria-label={t('git.sidebar.addWorktree') || 'Add Worktree'}
                      tooltip={t('git.sidebar.addWorktree') || 'Add Worktree'}
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddWorktree()
                      }}
                    >
                      <LuPlus className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                  <GitSearchDropdown
                    label={section.searchPlaceholder}
                    placeholder={section.searchPlaceholder}
                    value={queries[section.id] || ''}
                    onOpenChange={(next) => {
                      setSearchMenuOpen((prev) => ({ ...prev, [section.id]: next }))
                      if (next) setOpen((prev) => ({ ...prev, [section.id]: true }))
                    }}
                    onChange={(next) => {
                      setQueries((prev) => ({ ...prev, [section.id]: next }))
                      if (next.trim()) setOpen((prev) => ({ ...prev, [section.id]: true }))
                    }}
                  />
                </div>
              </div>
              {expanded ? (
                empty || noMatch ? (
                  <EmptyState
                    density="panel"
                    className="min-h-32 px-3 py-6"
                    title={empty ? t(SECTION_EMPTY_KEY[section.id]) : t('git.sidebar.noMatches')}
                    message={empty ? undefined : t('git.sidebar.noMatchesHint')}
                  />
                ) : (
                  <VirtualList
                    key={section.id}
                    className="px-2"
                    count={section.rows.length}
                    rowHeight={32}
                    getRowId={(index) => section.rows[index].id}
                    renderRow={(index) => section.rows[index].render()}
                    aria-label={section.title}
                  />
                )
              ) : null}
            </section>
          )
        })}
      </nav>
      {contextMenu ? (
        <FloatingMenu anchor={contextMenu.anchor} ariaLabel={contextMenu.ariaLabel} color="var(--accent)" onClose={() => setContextMenu(null)} items={contextMenu.items} />
      ) : null}
      <SidebarModals
        view={view}
        onRefresh={onRefresh}
        runWithGraphRollback={runWithGraphRollback}
        notify={notify}
        deleteFolderModal={deleteFolderModal}
        setDeleteFolderModal={setDeleteFolderModal}
        editRemoteState={editRemoteState}
        setEditRemoteState={setEditRemoteState}
        addRemoteOpen={addRemoteOpen}
        setAddRemoteOpen={setAddRemoteOpen}
        setUpstreamBranch={setUpstreamBranch}
        setSetUpstreamBranch={setSetUpstreamBranch}
      />
    </aside>
  )
}
