'use client'

import React, { useMemo } from 'react'
import { LuArchive, LuBoxes, LuChevronDown, LuChevronRight, LuCloud, LuEyeOff, LuFolderGit2, LuGitBranch, LuTag } from 'react-icons/lu'

import { AnimatedCounter } from '@/components/git/AnimatedCounter'
import { useT } from '@/components/i18n/LocaleProvider'
import { Badge } from '@/components/sk'
import type { GitLogView, GitRemoteProbe, GitSelection } from '@/lib/git/types'
import { cn } from '@/lib/utils'

import { BranchTree } from './BranchTree'
import { SidebarRow } from './SidebarRow'
import { type BranchItem, type BranchNode, type SectionId, type SidebarRowType, visibleBranchRows } from './sidebarUtils'

const MAX_SIDEBAR_BRANCHES = 300

export interface SidebarSectionItem {
  id: SectionId
  title: string
  total: number
  matchCount: number
  icon: any
  rows: SidebarRowType[]
  notice?: number
  expand?: { allOpen: boolean; disabled: boolean; onToggle: () => void }
  searchPlaceholder: string
}

export interface UseSidebarSectionsOptions {
  view: GitLogView
  localMatchCount: number
  localAllOpen: boolean
  localFolderIds: string[]
  toggleLocalAll: () => void
  localTree: BranchNode[]
  folderOpen: (id: string) => boolean
  toggleFolder: (id: string) => void
  setFolderOpen: (id: string, next: boolean) => void
  onSelect: (selection: GitSelection) => void
  handleBranchContextMenu: (e: React.MouseEvent, item: BranchItem, kind: 'local' | 'remote') => void
  handleFolderContextMenu: (e: React.MouseEvent, node: BranchNode, kind: 'local' | 'remote', folderId: string, expanded: boolean) => void
  onCheckoutBranch?: (branch: string, isRemote?: boolean) => Promise<void> | void
  setSetUpstreamBranch: (branch: string | null) => void
  soloBranch?: string | null
  onBranchHoverStart?: (branchName: string) => void
  onBranchHoverEnd?: () => void
  remoteMatchCount: number
  remoteUpdates: GitRemoteProbe[]
  remoteAllOpen: boolean
  remoteTrees: Array<{ source: string; count: number; tree: BranchNode[]; branches: GitLogView['remotes'] }>
  remoteFolderIds: string[]
  toggleRemoteAll: () => void
  remoteNeedle: string
  openRemotes: Record<string, boolean>
  remoteDefault: boolean
  updatesByRemote: Map<string, number>
  setOpenRemotes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  handleRemoteGroupContextMenu: (e: React.MouseEvent, group: { source: string; count: number; tree: BranchNode[] }) => void
  soloRemote?: string | null
  hiddenRemotes?: string[]
  updateByName: Map<string, GitRemoteProbe>
  filteredStashes: GitLogView['stashes']
  active: string
  handleStashContextMenu: (e: React.MouseEvent, stash: { name: string; subject?: string; hash: string }) => void
  filteredTags: GitLogView['tags']
  handleTagContextMenu: (e: React.MouseEvent, tag: { name: string; tip: string }) => void
  filteredWorktrees: GitLogView['worktrees']
  handleWorktreeContextMenu: (e: React.MouseEvent, entry: { path: string; branch?: string; head: string }) => void
  filteredSubmodules: GitLogView['submodules']
  onOpenRepo: (repo: string) => void
}

export function useSidebarSections({
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
}: UseSidebarSectionsOptions): SidebarSectionItem[] {
  const t = useT()

  return useMemo(
    (): SidebarSectionItem[] => [
      {
        id: 'local',
        title: t('git.sidebar.sections.local'),
        total: view.branches.length,
        matchCount: localMatchCount,
        icon: LuGitBranch,
        searchPlaceholder: t('git.sidebar.search.branch'),
        expand: { allOpen: localAllOpen, disabled: localFolderIds.length === 0, onToggle: toggleLocalAll },
        rows: (() => {
          const allRows = visibleBranchRows(localTree, 'local', folderOpen, 0, 'section:local')
          const visibleRows = allRows.slice(0, MAX_SIDEBAR_BRANCHES)
          const rows: SidebarRowType[] = visibleRows.map((row) => ({
            id: `local:${row.node.id}`,
            render: () => (
              <BranchTree
                nodes={[row.node]}
                depth={row.depth}
                active={active}
                kind="local"
                folderOpen={folderOpen}
                onToggleFolder={toggleFolder}
                onSetFolder={setFolderOpen}
                onSelect={onSelect}
                onContextMenu={handleBranchContextMenu}
                onFolderContextMenu={handleFolderContextMenu}
                onCheckoutBranch={onCheckoutBranch}
                onSetUpstream={(b) => setSetUpstreamBranch(b)}
                soloBranch={soloBranch}
                parentId={row.parentId}
                repo={view.repo}
                onBranchHoverStart={onBranchHoverStart}
                onBranchHoverEnd={onBranchHoverEnd}
              />
            ),
          }))
          if (allRows.length > MAX_SIDEBAR_BRANCHES) {
            rows.push({
              id: 'local:truncated_notice',
              render: () => (
                <div className="flex flex-col gap-1 px-3 py-2 text-[11px] text-ink-soft bg-panel-2/40 border-t border-line/40 select-none">
                  <span>
                    {t('git.sidebar.truncatedNotice', {
                      count: MAX_SIDEBAR_BRANCHES,
                      total: allRows.length,
                    }) || `已显示前 ${MAX_SIDEBAR_BRANCHES} 个分支（共 ${allRows.length} 个），建议使用上方搜索框精确查找。`}
                  </span>
                </div>
              ),
            })
          }
          return rows
        })(),
      },
      {
        id: 'remote',
        title: t('git.sidebar.sections.remote'),
        total: view.remotes.length,
        matchCount: remoteMatchCount,
        icon: LuCloud,
        searchPlaceholder: t('git.sidebar.search.remote'),
        notice: remoteUpdates.length,
        expand: {
          allOpen: remoteAllOpen,
          disabled: remoteTrees.length === 0 && remoteFolderIds.length === 0,
          onToggle: toggleRemoteAll,
        },
        rows: remoteTrees.flatMap((group): SidebarRowType[] => {
          const sourceId = `remote-source:${group.source}`
          const expanded = Boolean(remoteNeedle) || (openRemotes[group.source] ?? remoteDefault)
          const sourceUpdates = updatesByRemote.get(group.source) || 0
          return [
            {
              id: sourceId,
              render: () => (
                <div
                  role="treeitem"
                  tabIndex={0}
                  data-git-tree-id={sourceId}
                  aria-expanded={expanded}
                  aria-selected={false}
                  className={cn(
                    'group/remote flex h-8 w-full cursor-pointer select-text items-center justify-start gap-1.5 px-2 font-normal text-xs text-ink transition-colors hover:bg-[color-mix(in_oklab,var(--accent)_9%,transparent)] focus-visible:ring-1 focus-visible:ring-accent outline-none'
                  )}
                  onClick={() => setOpenRemotes((prev) => ({ ...prev, [group.source]: !(prev[group.source] ?? remoteDefault) }))}
                  onContextMenu={(e) => handleRemoteGroupContextMenu(e, group)}
                >
                  <span
                    role="button"
                    tabIndex={-1}
                    className="inline-flex size-3 shrink-0 cursor-pointer items-center justify-center select-none"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenRemotes((prev) => ({ ...prev, [group.source]: !(prev[group.source] ?? remoteDefault) }))
                    }}
                  >
                    {expanded ? <LuChevronDown className="size-3 shrink-0" aria-hidden /> : <LuChevronRight className="size-3 shrink-0" aria-hidden />}
                  </span>
                  <span data-git-sidebar-label className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-xs select-text">
                    {group.source}
                  </span>
                  {soloRemote === group.source ? (
                    <Badge tone="accent" size="mini" dot={false} className="shrink-0 select-none">
                      {t('git.operations.soloBadge') || 'Solo'}
                    </Badge>
                  ) : hiddenRemotes?.includes(group.source) ? (
                    <span className="shrink-0 text-ink-soft/70 text-[10px] flex items-center gap-0.5" title={t('git.operations.remoteHiddenTip') || 'Hidden remote'}>
                      <LuEyeOff className="size-3" />
                      {t('git.operations.hiddenBadge') || 'Hidden'}
                    </span>
                  ) : sourceUpdates > 0 ? (
                    <Badge tone="accent" size="mini" dot={false} className="shrink-0 select-none" title={t('git.sidebar.remoteBranchUpdates', { count: sourceUpdates })}>
                      <AnimatedCounter value={sourceUpdates} max={99} />
                    </Badge>
                  ) : (
                    <span className="shrink-0 whitespace-nowrap tabular-nums text-[11px] select-none text-ink-soft">
                      <AnimatedCounter value={group.count} />
                    </span>
                  )}
                </div>
              ),
            },
            ...(expanded
              ? (() => {
                  const allRows = visibleBranchRows(group.tree, `remote:${group.source}`, folderOpen, 1, sourceId)
                  const visibleRows = allRows.slice(0, MAX_SIDEBAR_BRANCHES)
                  const branchRows = visibleRows.map((row) => ({
                    id: `remote:${group.source}:${row.node.id}`,
                    render: () => (
                      <BranchTree
                        nodes={[row.node]}
                        depth={row.depth}
                        active={active}
                        kind="remote"
                        folderOpen={folderOpen}
                        onToggleFolder={toggleFolder}
                        onSetFolder={setFolderOpen}
                        onSelect={onSelect}
                        onContextMenu={handleBranchContextMenu}
                        onFolderContextMenu={handleFolderContextMenu}
                        onCheckoutBranch={onCheckoutBranch}
                        soloBranch={soloBranch}
                        idPrefix={`remote:${group.source}`}
                        parentId={row.parentId}
                        repo={view.repo}
                        updateByName={updateByName}
                        onBranchHoverStart={onBranchHoverStart}
                        onBranchHoverEnd={onBranchHoverEnd}
                      />
                    ),
                  }))
                  if (allRows.length > MAX_SIDEBAR_BRANCHES) {
                    branchRows.push({
                      id: `remote:${group.source}:truncated_notice`,
                      render: () => (
                        <div className="flex flex-col gap-1 px-3 py-2 text-[11px] text-ink-soft bg-panel-2/40 border-t border-line/40 select-none pl-6">
                          <span>
                            {t('git.sidebar.truncatedNotice', {
                              count: MAX_SIDEBAR_BRANCHES,
                              total: allRows.length,
                            }) || `已显示前 ${MAX_SIDEBAR_BRANCHES} 个分支（共 ${allRows.length} 个），建议使用上方搜索框精确查找。`}
                          </span>
                        </div>
                      ),
                    })
                  }
                  return branchRows
                })()
              : []),
          ]
        }),
      },
      {
        id: 'stash',
        title: t('git.sidebar.sections.stash'),
        total: view.stashes.length,
        matchCount: filteredStashes.length,
        icon: LuArchive,
        searchPlaceholder: t('git.sidebar.search.stash'),
        rows: filteredStashes.map((stash) => ({
          id: stash.name,
          render: () => (
            <SidebarRow
              key={stash.name}
              label={stash.subject || stash.name}
              title={stash.name}
              active={active === `stash:${stash.name}`}
              parentId="section:stash"
              onClick={() => onSelect({ kind: 'stash', name: stash.name })}
              onContextMenu={(e) => handleStashContextMenu(e, stash)}
            />
          ),
        })),
      },
      {
        id: 'tag',
        title: t('git.sidebar.sections.tag'),
        total: view.tags.length,
        matchCount: filteredTags.length,
        icon: LuTag,
        searchPlaceholder: t('git.sidebar.search.tag'),
        rows: filteredTags.map((tag) => ({
          id: tag.name,
          render: () => (
            <SidebarRow
              key={tag.name}
              label={tag.name}
              active={active === `tag:${tag.name}`}
              parentId="section:tag"
              onClick={() => onSelect({ kind: 'tag', name: tag.name })}
              onContextMenu={(e) => handleTagContextMenu(e, tag)}
            />
          ),
        })),
      },
      {
        id: 'worktree',
        title: t('git.sidebar.sections.worktree'),
        total: view.worktrees.length,
        matchCount: filteredWorktrees.length,
        icon: LuFolderGit2,
        searchPlaceholder: t('git.sidebar.search.worktree'),
        rows: filteredWorktrees.map((entry) => ({
          id: entry.path,
          render: () => (
            <SidebarRow
              key={entry.path}
              label={entry.branch || t('git.sidebar.detached')}
              title={entry.path}
              current={entry.current}
              active={active === `worktree:${entry.path}`}
              parentId="section:worktree"
              onClick={() => onSelect({ kind: 'worktree', path: entry.path })}
              onContextMenu={(e) => handleWorktreeContextMenu(e, entry)}
            />
          ),
        })),
      },
      {
        id: 'submodule',
        title: t('git.sidebar.sections.submodule'),
        total: view.submodules.length,
        matchCount: filteredSubmodules.length,
        icon: LuBoxes,
        searchPlaceholder: t('git.sidebar.search.submodule'),
        rows: filteredSubmodules.map((sub) => ({
          id: sub.path,
          render: () => (
            <SidebarRow key={sub.path} label={sub.path} title={sub.describe || sub.hash} active={false} parentId="section:submodule" onClick={() => onOpenRepo(sub.repo)} />
          ),
        })),
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
      soloRemote,
      hiddenRemotes,
    ]
  )
}
