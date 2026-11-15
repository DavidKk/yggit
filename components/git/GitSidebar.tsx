'use client'

import { type ReactNode, useMemo, useState } from 'react'
import {
  LuArchive,
  LuBoxes,
  LuCheck,
  LuChevronDown,
  LuChevronRight,
  LuChevronsDownUp,
  LuChevronsUpDown,
  LuCloud,
  LuFolder,
  LuFolderGit2,
  LuGitBranch,
  LuRefreshCw,
  LuTag,
} from 'react-icons/lu'

import { GitSearchDropdown } from '@/components/git/GitSearchDropdown'
import { handleTreeExpandKey, handleTreeParentKey } from '@/components/git/treeExpandKey'
import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, EmptyState, ScrollArea } from '@/components/sk'
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
}

type SectionId = 'local' | 'remote' | 'stash' | 'tag' | 'worktree' | 'submodule'

const SECTION_DEFAULT: Record<SectionId, boolean> = { local: true, remote: false, stash: false, tag: false, worktree: false, submodule: false }

function isSectionMap(value: unknown): value is Record<SectionId, boolean> {
  if (!isRecordBoolean(value)) return false
  // Accept partial maps written by older builds; merge happens at read site.
  return true
}

function sectionsOf(value: Record<SectionId, boolean> | Record<string, boolean>): Record<SectionId, boolean> {
  return { ...SECTION_DEFAULT, ...(value as Partial<Record<SectionId, boolean>>) }
}

function isSectionQueries(value: unknown): value is Partial<Record<SectionId, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string')
}

type BranchItem = {
  name: string
  path: string
  current?: boolean
  title?: string
}

type BranchNode = {
  id: string
  label: string
  item?: BranchItem
  children: BranchNode[]
}

function selectionKey(selection: GitSelection): string {
  if (selection.kind === 'all') return 'all'
  if (selection.kind === 'worktree') return `worktree:${selection.path}`
  return `${selection.kind}:${selection.name}`
}

function groupRemotes(remotes: GitLogView['remotes']): Array<{ source: string; branches: GitLogView['remotes'] }> {
  const map = new Map<string, GitLogView['remotes']>()
  for (const remote of remotes) {
    const list = map.get(remote.remote) || []
    list.push(remote)
    map.set(remote.remote, list)
  }
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([source, branches]) => ({
      source,
      branches: branches.slice().sort((left, right) => left.branch.localeCompare(right.branch) || left.name.localeCompare(right.name)),
    }))
}

function buildBranchTree(items: BranchItem[]): BranchNode[] {
  type Raw = { name: string; item?: BranchItem; kids: Map<string, Raw> }
  const root = new Map<string, Raw>()

  for (const item of items) {
    const parts = item.path.split('/').filter(Boolean)
    if (parts.length === 0) continue
    let map = root
    for (let index = 0; index < parts.length; index += 1) {
      const name = parts[index]
      let raw = map.get(name)
      if (!raw) {
        raw = { name, kids: new Map() }
        map.set(name, raw)
      }
      if (index === parts.length - 1) raw.item = item
      map = raw.kids
    }
  }

  const toNode = (raw: Raw, prefix: string): BranchNode => {
    const id = prefix ? `${prefix}/${raw.name}` : raw.name
    const children = [...raw.kids.values()]
      .map((child) => toNode(child, id))
      .sort((left, right) => Number(right.children.length > 0) - Number(left.children.length > 0) || left.label.localeCompare(right.label))
    return { id, label: raw.name, item: raw.item, children }
  }

  return [...root.values()]
    .map((raw) => toNode(raw, ''))
    .sort((left, right) => Number(right.children.length > 0) - Number(left.children.length > 0) || left.label.localeCompare(right.label))
}

function collectFolderIds(nodes: BranchNode[], idPrefix: string, into: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length === 0) continue
    into.push(`${idPrefix}:${node.id}`)
    collectFolderIds(node.children, idPrefix, into)
  }
  return into
}

function nameMatch(value: string, needle: string) {
  return !needle || value.toLowerCase().includes(needle)
}

const SECTION_EMPTY_KEY: Record<SectionId, `git.sidebar.empty.${SectionId}`> = {
  local: 'git.sidebar.empty.local',
  remote: 'git.sidebar.empty.remote',
  stash: 'git.sidebar.empty.stash',
  tag: 'git.sidebar.empty.tag',
  worktree: 'git.sidebar.empty.worktree',
  submodule: 'git.sidebar.empty.submodule',
}

export function GitSidebar({ view, selection, width, remoteUpdates = [], remoteProbing = false, onProbeRemotes, onSelect, onOpenRepo }: Props) {
  const t = useT()
  const ready = useGitUiReady()
  const { isEdge } = useGitDriver()
  const [openRaw, setOpen] = useGitUiPref(repoPrefKey(view.repo, 'sections'), SECTION_DEFAULT, isSectionMap)
  const open = sectionsOf(openRaw)
  const [openRemotes, setOpenRemotes] = useGitUiPref(repoPrefKey(view.repo, 'remotes'), {} as Record<string, boolean>, isRecordBoolean)
  const [openFolders, setOpenFolders] = useGitUiPref(repoPrefKey(view.repo, 'folders'), {} as Record<string, boolean>, isRecordBoolean)
  const [folderDefault, setFolderDefault] = useGitUiPref(repoPrefKey(view.repo, 'folderDefault'), true, isBoolean)
  const [remoteDefault, setRemoteDefault] = useGitUiPref(repoPrefKey(view.repo, 'remoteDefault'), true, isBoolean)
  const [queries, setQueries] = useGitUiPref(repoPrefKey(view.repo, 'sectionQueries'), {} as Partial<Record<SectionId, string>>, isSectionQueries)
  const [searchMenuOpen, setSearchMenuOpen] = useState<Partial<Record<SectionId, boolean>>>({})
  const active = selectionKey(selection)

  function needleOf(id: SectionId) {
    return (queries[id] || '').trim().toLowerCase()
  }

  const localNeedle = needleOf('local')
  const remoteNeedle = needleOf('remote')
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
            tree: buildBranchTree(
              branches.map((remote) => ({
                name: remote.name,
                path: remote.branch || remote.name,
                title: remote.name,
              }))
            ),
          }
        })
        .filter((group) => !remoteNeedle || group.count > 0),
    [remoteGroups, remoteNeedle]
  )

  const filteredStashes = useMemo(
    () => view.stashes.filter((stash) => nameMatch(stash.name, stashNeedle) || nameMatch(stash.subject || '', stashNeedle)),
    [stashNeedle, view.stashes]
  )
  const filteredTags = useMemo(() => view.tags.filter((tag) => nameMatch(tag.name, tagNeedle)), [tagNeedle, view.tags])
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

  const folderOpen = (id: string) => openFolders[id] ?? folderDefault
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

  const sections = useMemo(
    (): Array<{
      id: SectionId
      title: string
      total: number
      matchCount: number
      icon: typeof LuGitBranch
      body: ReactNode
      notice?: number
      expand?: { allOpen: boolean; disabled: boolean; onToggle: () => void }
      probe?: boolean
      searchPlaceholder: string
    }> => [
      {
        id: 'local',
        title: t('git.sidebar.sections.local'),
        total: view.branches.length,
        matchCount: localMatchCount,
        icon: LuGitBranch,
        searchPlaceholder: t('git.sidebar.search.branch'),
        expand: { allOpen: localAllOpen, disabled: localFolderIds.length === 0, onToggle: toggleLocalAll },
        body: (
          <BranchTree
            nodes={localTree}
            depth={0}
            active={active}
            kind="local"
            folderOpen={folderOpen}
            onToggleFolder={toggleFolder}
            onSetFolder={setFolderOpen}
            onSelect={onSelect}
            parentId="section:local"
          />
        ),
      },
      {
        id: 'remote',
        title: t('git.sidebar.sections.remote'),
        total: view.remotes.length,
        matchCount: remoteMatchCount,
        icon: LuCloud,
        searchPlaceholder: t('git.sidebar.search.remote'),
        notice: remoteUpdates.length,
        probe: true,
        expand: {
          allOpen: remoteAllOpen,
          disabled: remoteTrees.length === 0 && remoteFolderIds.length === 0,
          onToggle: toggleRemoteAll,
        },
        body: remoteTrees.map((group) => {
          const sourceId = `remote-source:${group.source}`
          const expanded = openRemotes[group.source] ?? remoteDefault
          const sourceUpdates = updatesByRemote.get(group.source) || 0
          return (
            <div key={group.source}>
              <Button
                variant="plain"
                data-git-tree-id={sourceId}
                className="h-7 w-full justify-start gap-1.5 rounded-none px-2 font-normal text-ink-soft"
                aria-expanded={expanded}
                onClick={() => setOpenRemotes((prev) => ({ ...prev, [group.source]: !(prev[group.source] ?? remoteDefault) }))}
                onKeyDown={(event) => {
                  if (handleTreeExpandKey(event, expanded, (next) => setOpenRemotes((prev) => ({ ...prev, [group.source]: next })))) return
                  handleTreeParentKey(event, 'section:remote')
                }}
              >
                {expanded ? <LuChevronDown className="size-3 shrink-0" aria-hidden /> : <LuChevronRight className="size-3 shrink-0" aria-hidden />}
                <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-xs">{group.source}</span>
                {sourceUpdates > 0 ? (
                  <Badge tone="accent" size="mini" dot={false} className="shrink-0" title={t('git.sidebar.remoteBranchUpdates', { count: sourceUpdates })}>
                    {sourceUpdates}
                  </Badge>
                ) : (
                  <span className="shrink-0 whitespace-nowrap tabular-nums text-[11px]">{group.count}</span>
                )}
              </Button>
              {expanded ? (
                <BranchTree
                  nodes={group.tree}
                  depth={1}
                  active={active}
                  kind="remote"
                  folderOpen={folderOpen}
                  onToggleFolder={toggleFolder}
                  onSetFolder={setFolderOpen}
                  onSelect={onSelect}
                  idPrefix={`remote:${group.source}`}
                  parentId={sourceId}
                  updateByName={updateByName}
                />
              ) : null}
            </div>
          )
        }),
      },
      {
        id: 'stash',
        title: t('git.sidebar.sections.stash'),
        total: view.stashes.length,
        matchCount: filteredStashes.length,
        icon: LuArchive,
        searchPlaceholder: t('git.sidebar.search.stash'),
        body: filteredStashes.map((stash) => (
          <Row
            key={stash.name}
            label={stash.subject || stash.name}
            title={stash.name}
            active={active === `stash:${stash.name}`}
            parentId="section:stash"
            onClick={() => onSelect({ kind: 'stash', name: stash.name })}
          />
        )),
      },
      {
        id: 'tag',
        title: t('git.sidebar.sections.tag'),
        total: view.tags.length,
        matchCount: filteredTags.length,
        icon: LuTag,
        searchPlaceholder: t('git.sidebar.search.tag'),
        body: filteredTags.map((tag) => (
          <Row key={tag.name} label={tag.name} active={active === `tag:${tag.name}`} parentId="section:tag" onClick={() => onSelect({ kind: 'tag', name: tag.name })} />
        )),
      },
      {
        id: 'worktree',
        title: t('git.sidebar.sections.worktree'),
        total: view.worktrees.length,
        matchCount: filteredWorktrees.length,
        icon: LuFolderGit2,
        searchPlaceholder: t('git.sidebar.search.worktree'),
        body: filteredWorktrees.map((entry) => (
          <Row
            key={entry.path}
            label={entry.branch || t('git.sidebar.detached')}
            title={entry.path}
            current={entry.current}
            active={active === `worktree:${entry.path}`}
            parentId="section:worktree"
            onClick={() => onSelect({ kind: 'worktree', path: entry.path })}
          />
        )),
      },
      {
        id: 'submodule',
        title: t('git.sidebar.sections.submodule'),
        total: view.submodules.length,
        matchCount: filteredSubmodules.length,
        icon: LuBoxes,
        searchPlaceholder: t('git.sidebar.search.submodule'),
        body: filteredSubmodules.map((sub) => (
          <Row key={sub.path} label={sub.path} title={sub.describe || sub.hash} active={false} parentId="section:submodule" onClick={() => onOpenRepo(sub.repo)} />
        )),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      t,
      view,
      localMatchCount,
      localAllOpen,
      localFolderIds,
      localTree,
      folderOpen,
      toggleLocalAll,
      toggleFolder,
      setFolderOpen,
      active,
      onSelect,
      remoteMatchCount,
      remoteAllOpen,
      remoteTrees,
      remoteFolderIds,
      remoteDefault,
      openRemotes,
      remoteUpdates,
      updatesByRemote,
      updateByName,
      filteredStashes,
      filteredTags,
      filteredWorktrees,
      filteredSubmodules,
      remoteProbing,
      onProbeRemotes,
    ]
  )

  // SSR: headers only (all collapsed). Client: real prefs on first paint — no skeleton / no forced local-open.
  const expandedOf = (id: SectionId) => (ready ? Boolean(open[id]) : false)

  return (
    <aside data-git-sidebar data-git-tree-root className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden" style={{ width: `var(--git-sidebar-w, ${width}px)` }}>
      <nav aria-label={t('git.sidebar.navAria')} className="flex min-h-0 flex-1 flex-col pt-1 pb-2" aria-busy={!ready || undefined}>
        {sections.map((section) => {
          const expanded = expandedOf(section.id)
          const Icon = section.icon
          const sectionId = `section:${section.id}`
          const needle = needleOf(section.id)
          const empty = section.total === 0
          const noMatch = !empty && Boolean(needle) && section.matchCount === 0
          const badgeCount = ready && needle ? section.matchCount : section.total
          const toolsPinned = Boolean(needle) || Boolean(searchMenuOpen[section.id])
          return (
            <section
              key={section.id}
              data-git-find={`sidebar-${section.id}`}
              className={cn('group/sec flex flex-col', expanded && 'min-h-0 flex-1 border-b border-transparent hover:border-line')}
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
                  {section.id === 'worktree' && isEdge ? (
                    <Badge
                      tone="neutral"
                      size="mini"
                      dot={false}
                      className="shrink-0 text-[10px] text-ink-soft/80 bg-[var(--overlay-06)]"
                      title={t('git.sidebar.worktreeEdgeUnsupportedMsg')}
                    >
                      {t('git.sidebar.worktreeEdgeUnsupported')}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="mini" dot={false} className="shrink-0">
                      {badgeCount}
                    </Badge>
                  )}
                  {section.notice && section.notice > 0 ? (
                    <Badge tone="accent" size="mini" dot={false} className="shrink-0" title={t('git.sidebar.remotePending')}>
                      {section.notice}
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
                  {section.probe && onProbeRemotes ? (
                    <Button
                      variant="plain"
                      size="icon"
                      className="size-6 shrink-0 text-ink-soft hover:enabled:bg-[var(--overlay-08)]"
                      aria-label={t('git.sidebar.probeRemote')}
                      tooltip={t('git.sidebar.probeRemoteTooltip')}
                      loading={remoteProbing}
                      onClick={onProbeRemotes}
                    >
                      <LuRefreshCw className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
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
                  {!(section.id === 'worktree' && isEdge) && (
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
                  )}
                </div>
              </div>
              {expanded ? (
                section.id === 'worktree' && isEdge ? (
                  <EmptyState
                    density="panel"
                    className="min-h-32 px-3 py-6"
                    title={t('git.sidebar.worktreeEdgeUnsupported')}
                    message={t('git.sidebar.worktreeEdgeUnsupportedMsg')}
                  />
                ) : empty || noMatch ? (
                  <EmptyState
                    density="panel"
                    className="min-h-32 px-3 py-6"
                    title={empty ? t(SECTION_EMPTY_KEY[section.id]) : t('git.sidebar.noMatches')}
                    message={empty ? undefined : t('git.sidebar.noMatchesHint')}
                  />
                ) : (
                  <ScrollArea className="min-h-0 flex-1" indicator="vertical" reserveGutter={false} scrollClassName="px-2">
                    {section.body}
                  </ScrollArea>
                )
              ) : null}
            </section>
          )
        })}
      </nav>
    </aside>
  )
}

function BranchTree({
  nodes,
  depth,
  active,
  kind,
  folderOpen,
  onToggleFolder,
  onSetFolder,
  onSelect,
  idPrefix = kind,
  parentId,
  updateByName,
}: {
  nodes: BranchNode[]
  depth: number
  active: string
  kind: 'local' | 'remote'
  folderOpen: (id: string) => boolean
  onToggleFolder: (id: string) => void
  onSetFolder: (id: string, next: boolean) => void
  onSelect: (selection: GitSelection) => void
  idPrefix?: string
  parentId?: string
  updateByName?: Map<string, GitRemoteProbe>
}) {
  const t = useT()
  return (
    <>
      {nodes.map((node) => {
        const folderId = `${idPrefix}:${node.id}`
        if (node.children.length === 0 && node.item) {
          const probe = updateByName?.get(node.item.name)
          return (
            <Row
              key={folderId}
              label={node.label}
              title={
                probe
                  ? t('git.sidebar.remoteNewTip', {
                      label: node.item.title || node.item.name,
                      tip: probe.remoteTip.slice(0, 7),
                    })
                  : node.item.title
              }
              current={node.item.current}
              active={active === `${kind}:${node.item.name}`}
              depth={depth}
              parentId={parentId}
              notice={Boolean(probe)}
              onClick={() => onSelect({ kind, name: node.item!.name })}
            />
          )
        }

        const expanded = folderOpen(folderId)
        const branchActive = node.item ? active === `${kind}:${node.item.name}` : false
        return (
          <div key={folderId}>
            <Button
              variant="plain"
              data-git-tree-id={folderId}
              tooltip={node.item?.title && node.item.title !== node.label ? node.item.title : undefined}
              aria-expanded={expanded}
              aria-current={branchActive ? 'true' : undefined}
              className={cn(
                'h-7 w-full justify-start gap-1.5 rounded-none px-2 font-normal text-ink-soft',
                branchActive && 'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-accent'
              )}
              style={depth > 0 ? { paddingLeft: 8 + depth * 14 } : undefined}
              onClick={() => {
                if (node.item) onSelect({ kind, name: node.item.name })
                else onToggleFolder(folderId)
              }}
              onKeyDown={(event) => {
                if (handleTreeExpandKey(event, expanded, (next) => onSetFolder(folderId, next))) return
                handleTreeParentKey(event, parentId)
              }}
            >
              <span
                className="inline-flex size-3.5 shrink-0 items-center justify-center"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleFolder(folderId)
                }}
              >
                {expanded ? <LuChevronDown className="size-3" aria-hidden /> : <LuChevronRight className="size-3" aria-hidden />}
              </span>
              <LuFolder className="size-3 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-xs">{node.label}</span>
              {node.item?.current ? <LuCheck className="size-3 shrink-0 text-accent" aria-hidden /> : null}
            </Button>
            {expanded ? (
              <BranchTree
                nodes={node.children}
                depth={depth + 1}
                active={active}
                kind={kind}
                folderOpen={folderOpen}
                onToggleFolder={onToggleFolder}
                onSetFolder={onSetFolder}
                onSelect={onSelect}
                idPrefix={idPrefix}
                parentId={folderId}
                updateByName={updateByName}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

function Row({
  label,
  title,
  current,
  active,
  depth = 0,
  parentId,
  notice,
  onClick,
}: {
  label: string
  title?: string
  current?: boolean
  active: boolean
  depth?: number
  parentId?: string
  notice?: boolean
  onClick: () => void
}) {
  const t = useT()
  return (
    <Button
      variant="plain"
      tooltip={title && title !== label ? title : undefined}
      aria-current={active ? 'true' : undefined}
      className={cn('h-8 w-full justify-start px-2 font-normal text-ink', active && 'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-accent')}
      style={depth > 0 ? { paddingLeft: 8 + depth * 14 } : undefined}
      onClick={onClick}
      onKeyDown={(event) => handleTreeParentKey(event, parentId)}
    >
      {current ? <LuCheck className="size-3.5 shrink-0 text-accent" aria-hidden /> : <span className="size-3.5 shrink-0" aria-hidden />}
      <span data-git-sidebar-label className="min-w-0 flex-1 truncate whitespace-nowrap text-left">
        {label}
      </span>
      {notice ? <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label={t('git.sidebar.remoteNewAria')} /> : null}
    </Button>
  )
}
