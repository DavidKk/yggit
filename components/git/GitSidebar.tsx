'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  LuArchive,
  LuArchiveRestore,
  LuArrowDownToLine,
  LuArrowUpFromLine,
  LuBoxes,
  LuCheck,
  LuChevronDown,
  LuChevronRight,
  LuChevronsDownUp,
  LuChevronsUpDown,
  LuCircleAlert,
  LuCloud,
  LuCopy,
  LuEye,
  LuEyeOff,
  LuFolder,
  LuFolderGit2,
  LuGitBranch,
  LuGitBranchPlus,
  LuGitCommitHorizontal,
  LuGitMerge,
  LuHash,
  LuInbox,
  LuPencil,
  LuPlus,
  LuRefreshCw,
  LuTag,
  LuText,
  LuTrash2,
  LuUser,
} from 'react-icons/lu'

import { GitSearchDropdown } from '@/components/git/GitSearchDropdown'
import { FloatingMenu, type FloatingMenuItem } from '@/components/git/RefChipsCell'
import { handleTreeExpandKey, handleTreeParentKey } from '@/components/git/treeExpandKey'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, EmptyState, Modal, Tooltip, VirtualList } from '@/components/sk'
import { copyToClipboard } from '@/lib/clipboard'
import { stripRemotePrefix } from '@/lib/git/branch-context-menu'
import { getGitDriver, useGitDriver } from '@/lib/git/driver'
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
  onAddWorktree?: () => void
  onBranchHoverStart?: (branchName: string) => void
  onBranchHoverEnd?: () => void
  onRefresh?: () => Promise<void> | void
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
  tip?: string
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

type BranchRow = { node: BranchNode; depth: number; parentId: string }

function visibleBranchRows(nodes: BranchNode[], prefix: string, folderOpen: (id: string) => boolean, depth: number, parentId: string): BranchRow[] {
  const rows: BranchRow[] = []
  const visit = (items: BranchNode[], level: number, parent: string) => {
    for (const node of items) {
      rows.push({ node, depth: level, parentId: parent })
      if (node.children.length && folderOpen(`${prefix}:${node.id}`)) visit(node.children, level + 1, `${prefix}:${node.id}`)
    }
  }
  visit(nodes, depth, parentId)
  return rows
}

type SidebarRow = { id: string; render: () => ReactNode }

function collectFolderIds(nodes: BranchNode[], idPrefix: string, into: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length === 0) continue
    into.push(`${idPrefix}:${node.id}`)
    collectFolderIds(node.children, idPrefix, into)
  }
  return into
}

function collectAllBranchItems(node: BranchNode): BranchItem[] {
  const list: BranchItem[] = []
  if (node.item) list.push(node.item)
  for (const child of node.children) {
    list.push(...collectAllBranchItems(child))
  }
  return list
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

export function GitSidebar({
  view,
  selection,
  width,
  remoteUpdates = [],
  remoteProbing = false,
  onProbeRemotes,
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
  onAddWorktree,
  onBranchHoverStart,
  onBranchHoverEnd,
  onRefresh,
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
  const [deletingFolderBranches, setDeletingFolderBranches] = useState(false)

  const handleConfirmDeleteFolderBranches = async () => {
    if (!deleteFolderModal || deletingFolderBranches) return
    setDeletingFolderBranches(true)
    const { branchesToDelete } = deleteFolderModal
    const driver = getGitDriver()
    let successCount = 0
    let failedCount = 0

    for (const b of branchesToDelete) {
      try {
        await driver.deleteBranch(view.repo, b, true)
        successCount++
      } catch (err) {
        console.error(`Failed to delete branch ${b}:`, err)
        failedCount++
      }
    }

    setDeletingFolderBranches(false)
    setDeleteFolderModal(null)

    if (successCount > 0) {
      notify.success(t('git.operations.deleteFolderBranchesSuccess', { count: successCount }) || `成功删除 ${successCount} 个分支`)
      await onRefresh?.()
    }
    if (failedCount > 0) {
      notify.error(t('git.operations.deleteFolderBranchesPartialFail', { count: failedCount }) || `${failedCount} 个分支删除失败`)
    }
  }
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
                tip: remote.tip,
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
    if (ok) notify.success(t('common.copied') || '已复制')
    else notify.error(t('common.copyFailed') || '复制失败')
  }

  const handleBranchContextMenu = (e: React.MouseEvent, item: BranchItem, kind: 'local' | 'remote') => {
    e.preventDefault()
    e.stopPropagation()

    const tipCommit = view.commits.find((c) => c.hash === item.tip)
    const isCurrent = item.current || item.name === view.branch || item.name === view.head

    const actionItems: FloatingMenuItem[] = []

    if (kind === 'local') {
      actionItems.push(
        {
          key: 'checkout-branch',
          label: isCurrent ? t('git.operations.currentBranchLabel', { branch: item.name }) : t('git.operations.checkoutBranchAction', { branch: item.name }),
          icon: <LuGitBranch className="size-3.5 shrink-0 text-accent" />,
          disabled: isCurrent,
          onSelect: () => void onCheckoutBranch?.(item.name, false),
          group: t('git.operations.groupBranchOps'),
        },
        {
          key: 'new-branch',
          label: t('git.operations.newBranchFrom'),
          icon: <LuGitBranchPlus className="size-3.5 shrink-0 text-ink" />,
          onSelect: () => void onCreateBranch?.(item.name, item.tip),
          group: t('git.operations.groupBranchOps'),
        },
        {
          key: 'rename-branch',
          label: t('git.operations.renameBranchAction'),
          icon: <LuPencil className="size-3.5 shrink-0 text-ink-soft" />,
          onSelect: () => void onRenameBranch?.(item.name),
          group: t('git.operations.groupBranchOps'),
        },
        {
          key: 'merge-branch',
          label: t('git.operations.mergeIntoCurrent', { branch: view.head || view.branch }),
          icon: <LuGitMerge className="size-3.5 shrink-0 text-ink-soft" />,
          disabled: isCurrent,
          onSelect: () => void onMergeBranch?.(item.name),
          group: t('git.operations.groupBranchOps'),
        },
        {
          key: 'rebase-branch',
          label: t('git.operations.rebaseOntoCurrent', { branch: view.head || view.branch }),
          icon: <LuGitCommitHorizontal className="size-3.5 shrink-0 text-ink-soft" />,
          disabled: isCurrent,
          onSelect: () => void onRebaseBranch?.(item.name),
          group: t('git.operations.groupBranchOps'),
        },
        {
          key: 'push-branch',
          label: t('git.operations.pushBranchAction', { branch: item.name }),
          icon: <LuArrowUpFromLine className="size-3.5 shrink-0 text-ink-soft" />,
          onSelect: () => void onPushBranch?.(item.name),
          group: t('git.operations.groupRemoteSync'),
        },
        {
          key: 'pull-branch',
          label: t('git.operations.pullBranchAction', { branch: item.name }),
          icon: <LuArrowDownToLine className="size-3.5 shrink-0 text-ink-soft" />,
          onSelect: () => void onPullBranch?.(item.name),
          group: t('git.operations.groupRemoteSync'),
        }
      )
    } else {
      actionItems.push(
        {
          key: 'checkout-remote',
          label: t('git.operations.checkoutRemoteBranch', { branch: item.name }),
          icon: <LuGitBranch className="size-3.5 shrink-0 text-accent" />,
          onSelect: () => void onCheckoutBranch?.(item.name, true),
          group: t('git.operations.groupBranchOps'),
        },
        {
          key: 'new-branch-from-remote',
          label: t('git.operations.newBranchFromRemote'),
          icon: <LuGitBranchPlus className="size-3.5 shrink-0 text-ink" />,
          onSelect: () => void onCreateBranch?.(item.name, item.tip),
          group: t('git.operations.groupBranchOps'),
        },
        {
          key: 'merge-remote',
          label: t('git.operations.mergeIntoCurrent', { branch: view.head || view.branch }),
          icon: <LuGitMerge className="size-3.5 shrink-0 text-ink-soft" />,
          onSelect: () => void onMergeBranch?.(item.name),
          group: t('git.operations.groupBranchOps'),
        },
        {
          key: 'rebase-remote',
          label: t('git.operations.rebaseOntoCurrent', { branch: view.head || view.branch }),
          icon: <LuGitCommitHorizontal className="size-3.5 shrink-0 text-ink-soft" />,
          onSelect: () => void onRebaseBranch?.(item.name),
          group: t('git.operations.groupBranchOps'),
        },
        {
          key: 'pull-remote',
          label: t('git.operations.pullBranchAction', { branch: item.name }),
          icon: <LuArrowDownToLine className="size-3.5 shrink-0 text-ink-soft" />,
          onSelect: () => void onPullBranch?.(item.name),
          group: t('git.operations.groupRemoteSync'),
        }
      )
    }

    const isSolo = soloBranch === item.name
    if (onSoloBranch) {
      actionItems.push({
        key: 'solo-branch',
        label: isSolo ? t('git.operations.unsoloBranch') || '退出 SOLO' : t('git.operations.soloBranch') || 'SOLO 分支',
        icon: isSolo ? <LuEyeOff className="size-3.5 shrink-0 text-accent" /> : <LuEye className="size-3.5 shrink-0 text-accent" />,
        checked: isSolo,
        dividerBefore: true,
        onSelect: () => void onSoloBranch(isSolo ? null : item.name),
        group: t('git.operations.groupView') || '视图',
      })
    }

    const remoteNames = view.remotes.map((r) => r.remote)
    const copyBranchName = kind === 'remote' ? stripRemotePrefix(item.path || item.name, remoteNames) : item.name

    const copyItems: FloatingMenuItem[] = [
      {
        key: 'copy-branch-name',
        label: `${t('git.graph.copyBranchName')} (${copyBranchName})`,
        icon: <LuCopy className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void copyValue(copyBranchName),
      },
    ]

    if (kind === 'remote' || (item.title && item.title !== item.name)) {
      const fullPath = item.title || item.name
      if (fullPath !== copyBranchName) {
        copyItems.push({
          key: 'copy-full-name',
          label: `${t('git.operations.copyFullPathAction', { path: fullPath })}`,
          icon: <LuCopy className="size-3.5 shrink-0" />,
          onSelect: () => void copyValue(fullPath),
        })
      }
    }

    if (tipCommit) {
      copyItems.push(
        {
          key: 'copy-subject',
          label: `${t('git.graph.copyCommitSubject')} (${tipCommit.subject})`,
          icon: <LuText className="size-3.5 shrink-0 text-ink-soft" />,
          onSelect: () => void copyValue(tipCommit.subject),
        },
        {
          key: 'copy-hash',
          label: `${t('git.graph.copyCommitHash')} (${tipCommit.short || tipCommit.hash.slice(0, 7)})`,
          icon: <LuHash className="size-3.5 shrink-0 text-ink-soft" />,
          onSelect: () => void copyValue(tipCommit.hash),
        },
        {
          key: 'copy-author',
          label: `${t('git.graph.copyAuthor')} (${tipCommit.author})`,
          icon: <LuUser className="size-3.5 shrink-0 text-ink-soft" />,
          onSelect: () => void copyValue(tipCommit.author),
        }
      )
    } else if (item.tip) {
      const tipHash = item.tip
      copyItems.push({
        key: 'copy-hash',
        label: `${t('git.graph.copyCommitHash')} (${tipHash.slice(0, 7)})`,
        icon: <LuHash className="size-3.5 shrink-0 text-ink-soft" />,
        onSelect: () => void copyValue(tipHash),
      })
    }

    actionItems.push({
      key: 'copy-menu-group',
      label: t('git.operations.groupCopy') || '复制',
      icon: <LuCopy className="size-3.5 shrink-0 text-ink-soft" />,
      dividerBefore: true,
      children: copyItems,
    })

    if (kind === 'local') {
      actionItems.push({
        key: 'delete-branch',
        label: t('git.operations.deleteBranchAction', { branch: item.name }),
        icon: <LuTrash2 className="size-3.5 shrink-0 text-fail" />,
        danger: true,
        disabled: isCurrent,
        dividerBefore: true,
        onSelect: () => void onDeleteBranch?.(item.name),
        group: t('git.operations.groupDangerous'),
      })
    }

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: item.name,
      items: actionItems,
    })
  }

  const handleTagContextMenu = (e: React.MouseEvent, tag: { name: string; tip: string }) => {
    e.preventDefault()
    e.stopPropagation()
    const commit = view.commits.find((c) => c.hash === tag.tip)
    const items: FloatingMenuItem[] = [
      {
        key: 'copy-tag-name',
        label: t('git.operations.copyTagNameAction', { tag: tag.name }),
        icon: <LuTag className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void copyValue(tag.name),
        group: t('git.operations.groupCopy'),
      },
      {
        key: 'copy-hash',
        label: `${t('git.graph.copyCommitHash')} (${tag.tip.slice(0, 7)})`,
        icon: <LuHash className="size-3.5 shrink-0 text-ink-soft" />,
        onSelect: () => void copyValue(tag.tip),
        group: t('git.operations.groupCopy'),
      },
    ]
    if (commit?.subject) {
      items.push({
        key: 'copy-subject',
        label: `${t('git.graph.copyCommitSubject')} (${commit.subject})`,
        icon: <LuText className="size-3.5 shrink-0 text-ink-soft" />,
        onSelect: () => void copyValue(commit.subject),
        group: t('git.operations.groupCopy'),
      })
    }
    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: tag.name,
      items,
    })
  }

  const handleStashContextMenu = (e: React.MouseEvent, stash: { name: string; subject?: string; hash: string }) => {
    e.preventDefault()
    e.stopPropagation()
    const idx = Number(stash.name.match(/\d+/)?.[0] ?? 0)
    const items: FloatingMenuItem[] = [
      {
        key: 'apply-stash',
        label: t('git.operations.applyStashAction', { stash: stash.name }),
        icon: <LuArchive className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void onStashAction?.('apply', idx),
        group: t('git.operations.groupActions'),
      },
      {
        key: 'pop-stash',
        label: t('git.operations.popStashAction', { stash: stash.name }),
        icon: <LuArchiveRestore className="size-3.5 shrink-0 text-ok" />,
        onSelect: () => void onStashAction?.('pop', idx),
        group: t('git.operations.groupActions'),
      },
      {
        key: 'drop-stash',
        label: t('git.operations.deleteStashAction', { stash: stash.name }),
        icon: <LuTrash2 className="size-3.5 shrink-0 text-fail" />,
        danger: true,
        dividerBefore: true,
        onSelect: () => void onStashAction?.('drop', idx),
        group: t('git.operations.groupActions'),
      },
      {
        key: 'copy-stash-name',
        label: t('git.operations.copyStashNameAction', { stash: stash.name }),
        icon: <LuInbox className="size-3.5 shrink-0 text-accent" />,
        dividerBefore: true,
        onSelect: () => void copyValue(stash.name),
        group: t('git.operations.groupCopy'),
      },
    ]
    if (stash.subject) {
      const subj = stash.subject
      items.push({
        key: 'copy-subject',
        label: `${t('git.graph.copyCommitSubject')} (${subj})`,
        icon: <LuText className="size-3.5 shrink-0 text-ink-soft" />,
        onSelect: () => void copyValue(subj),
        group: t('git.operations.groupCopy'),
      })
    }
    items.push({
      key: 'copy-hash',
      label: `${t('git.graph.copyCommitHash')} (${stash.hash.slice(0, 7)})`,
      icon: <LuHash className="size-3.5 shrink-0 text-ink-soft" />,
      onSelect: () => void copyValue(stash.hash),
      group: t('git.operations.groupCopy'),
    })
    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: stash.name,
      items,
    })
  }

  const handleWorktreeContextMenu = (e: React.MouseEvent, entry: { path: string; branch?: string; head: string }) => {
    e.preventDefault()
    e.stopPropagation()
    const items: FloatingMenuItem[] = [
      {
        key: 'copy-path',
        label: t('git.operations.copyLocalPathAction', { path: entry.path }),
        icon: <LuFolder className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void copyValue(entry.path),
        group: t('git.operations.groupCopy'),
      },
    ]
    if (entry.branch) {
      const br = entry.branch
      items.push({
        key: 'copy-branch',
        label: `${t('git.graph.copyBranchName')} (${br})`,
        icon: <LuGitBranch className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void copyValue(br),
        group: t('git.operations.groupCopy'),
      })
    }
    items.push({
      key: 'copy-head',
      label: `${t('git.graph.copyCommitHash')} (${entry.head.slice(0, 7)})`,
      icon: <LuHash className="size-3.5 shrink-0 text-ink-soft" />,
      onSelect: () => void copyValue(entry.head),
      group: t('git.operations.groupCopy'),
    })
    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: entry.branch || entry.path,
      items,
    })
  }

  const handleFolderContextMenu = (e: React.MouseEvent, node: BranchNode, kind: 'local' | 'remote', folderId: string, expanded: boolean) => {
    e.preventDefault()
    e.stopPropagation()

    const branchItems = collectAllBranchItems(node)
    const items: FloatingMenuItem[] = []

    if (node.children.length > 0) {
      items.push({
        key: 'toggle-folder',
        label: expanded ? t('git.operations.collapseGroup') || '折叠该组' : t('git.operations.expandGroup') || '展开该组',
        icon: expanded ? <LuChevronDown className="size-3.5 shrink-0" /> : <LuChevronRight className="size-3.5 shrink-0" />,
        onSelect: () => toggleFolder(folderId),
      })
    }

    const copyChildren: FloatingMenuItem[] = [
      {
        key: 'copy-folder-name',
        label: (t('git.operations.copyGroupName') || '复制组名称 ({name})').replace('{name}', node.label),
        icon: <LuFolder className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void copyValue(node.label),
      },
    ]

    if (node.id && node.id !== node.label) {
      copyChildren.push({
        key: 'copy-folder-path',
        label: (t('git.operations.copyGroupPath') || '复制完整分组路径 ({path})').replace('{path}', node.id),
        icon: <LuCopy className="size-3.5 shrink-0" />,
        onSelect: () => void copyValue(node.id),
      })
    }

    if (branchItems.length > 0) {
      copyChildren.push({
        key: 'copy-branches-list',
        label: (t('git.operations.copyGroupBranches') || '复制组内分支名称 ({count} 个)').replace('{count}', String(branchItems.length)),
        icon: <LuGitBranch className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void copyValue(branchItems.map((b) => b.name).join('\n')),
      })
    }

    if (node.item) {
      const tipCommit = view.commits.find((c) => c.hash === node.item?.tip)
      if (tipCommit) {
        copyChildren.push(
          {
            key: 'copy-commit-subject',
            label: `${t('git.graph.copyCommitSubject') || '复制提交信息'} (${tipCommit.subject})`,
            icon: <LuText className="size-3.5 shrink-0 text-ink-soft" />,
            onSelect: () => void copyValue(tipCommit.subject),
          },
          {
            key: 'copy-commit-hash',
            label: `${t('git.graph.copyCommitHash') || '复制 Commit SHA'} (${tipCommit.short || tipCommit.hash.slice(0, 7)})`,
            icon: <LuHash className="size-3.5 shrink-0 text-ink-soft" />,
            onSelect: () => void copyValue(tipCommit.hash),
          }
        )
      } else if (node.item.tip) {
        const hash = node.item.tip
        copyChildren.push({
          key: 'copy-commit-hash',
          label: `${t('git.graph.copyCommitHash') || '复制 Commit SHA'} (${hash.slice(0, 7)})`,
          icon: <LuHash className="size-3.5 shrink-0 text-ink-soft" />,
          onSelect: () => void copyValue(hash),
        })
      }
    }

    if (copyChildren.length > 0) {
      items.push({
        key: 'copy-folder-group',
        label: t('git.operations.groupCopy') || '复制',
        icon: <LuCopy className="size-3.5 shrink-0 text-ink-soft" />,
        dividerBefore: items.length > 0,
        children: copyChildren,
      })
    }

    if (kind === 'local' && branchItems.length > 0) {
      const allBranchNames = branchItems.map((b) => b.name)
      const currentBranch = view.head || view.branch
      const isCurrentInFolder = allBranchNames.includes(currentBranch)
      const branchesToDelete = allBranchNames.filter((b) => b !== currentBranch)

      if (branchesToDelete.length > 0) {
        items.push({
          key: 'delete-folder-branches',
          label: t('git.operations.deleteFolderBranches', { count: branchesToDelete.length }) || `删除文件夹下所有分支 (${branchesToDelete.length} 个)`,
          icon: <LuTrash2 className="size-3.5 shrink-0 text-fail" />,
          danger: true,
          dividerBefore: true,
          onSelect: () => {
            setDeleteFolderModal({
              open: true,
              folderLabel: node.label,
              branchesToDelete,
              skippedCurrentBranch: isCurrentInFolder ? currentBranch : null,
            })
          },
        })
      }
    }

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: node.label,
      items,
    })
  }

  const handleRemoteGroupContextMenu = (e: React.MouseEvent, group: { source: string; count: number; tree: BranchNode[] }) => {
    e.preventDefault()
    e.stopPropagation()

    const allRemoteBranches = group.tree.flatMap(collectAllBranchItems)
    const expanded = openRemotes[group.source] ?? remoteDefault
    const items: FloatingMenuItem[] = [
      {
        key: 'fetch-remote',
        label: (t('git.operations.fetchRemoteAction') || '抓取此远程 (git fetch --prune {remote})').replace('{remote}', group.source),
        icon: <LuRefreshCw className="size-3.5 shrink-0 text-accent" />,
        onSelect: async () => {
          try {
            notify.info((t('git.operations.fetchingRemote') || '正在抓取 {remote}...').replace('{remote}', group.source))
            const driver = getGitDriver()
            const res = await driver.fetch(view.repo, { remote: group.source, prune: true })
            notify.success(res.message || (t('git.operations.fetchRemoteSuccess') || '已完成抓取 {remote}').replace('{remote}', group.source))
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : '抓取失败')
          }
        },
      },
      {
        key: 'pull-remote-ff',
        label: (t('git.operations.pullRemoteFfAction') || '快进拉取此远程 (git pull --ff-only {remote})').replace('{remote}', group.source),
        icon: <LuArrowDownToLine className="size-3.5 shrink-0 text-ok" />,
        onSelect: async () => {
          try {
            notify.info((t('git.operations.pullingRemote') || '正在拉取 {remote}...').replace('{remote}', group.source))
            const driver = getGitDriver()
            const res = await driver.pull(view.repo, { remote: group.source, ffOnly: true })
            notify.success(res.message || t('git.operations.pullSuccess') || '拉取成功 (Fast-forward only)')
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : '拉取失败')
          }
        },
      },
      {
        key: 'copy-remote-name',
        label: (t('git.operations.copyRemoteSourceName') || '复制远程源名称 ({source})').replace('{source}', group.source),
        icon: <LuCloud className="size-3.5 shrink-0 text-accent" />,
        dividerBefore: true,
        onSelect: () => void copyValue(group.source),
      },
    ]

    if (allRemoteBranches.length > 0) {
      items.push({
        key: 'copy-remote-branches',
        label: (t('git.operations.copyAllRemoteBranches') || '复制该远程下所有分支名 ({count} 个)').replace('{count}', String(allRemoteBranches.length)),
        icon: <LuGitBranch className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void copyValue(allRemoteBranches.map((b) => b.name).join('\n')),
      })
    }

    items.push({
      key: 'toggle-remote-group',
      label: expanded ? t('git.operations.collapseRemote') || '折叠该远程' : t('git.operations.expandRemote') || '展开该远程',
      icon: expanded ? <LuChevronDown className="size-3.5 shrink-0" /> : <LuChevronRight className="size-3.5 shrink-0" />,
      onSelect: () => setOpenRemotes((prev) => ({ ...prev, [group.source]: !expanded })),
    })

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: group.source,
      items,
    })
  }

  const sections = useMemo(
    (): Array<{
      id: SectionId
      title: string
      total: number
      matchCount: number
      icon: typeof LuGitBranch
      rows: SidebarRow[]
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
        rows: visibleBranchRows(localTree, 'local', folderOpen, 0, 'section:local').map((row) => ({
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
              soloBranch={soloBranch}
              parentId={row.parentId}
              onBranchHoverStart={onBranchHoverStart}
              onBranchHoverEnd={onBranchHoverEnd}
            />
          ),
        })),
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
        rows: remoteTrees.flatMap((group): SidebarRow[] => {
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
                  className="flex h-8 w-full cursor-pointer select-text items-center justify-start gap-1.5 rounded-none px-2 font-normal text-xs text-ink-soft hover:bg-[var(--overlay-06)] outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  onClick={() => {
                    const sel = typeof window !== 'undefined' ? window.getSelection() : null
                    if (sel && sel.toString().trim().length > 0) return
                    setOpenRemotes((prev) => ({ ...prev, [group.source]: !(prev[group.source] ?? remoteDefault) }))
                  }}
                  onContextMenu={(e) => handleRemoteGroupContextMenu(e, group)}
                  onKeyDown={(event) => {
                    if (handleTreeExpandKey(event, expanded, (next) => setOpenRemotes((prev) => ({ ...prev, [group.source]: next })))) return
                    handleTreeParentKey(event, 'section:remote')
                  }}
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
                  {sourceUpdates > 0 ? (
                    <Badge tone="accent" size="mini" dot={false} className="shrink-0 select-none" title={t('git.sidebar.remoteBranchUpdates', { count: sourceUpdates })}>
                      {sourceUpdates}
                    </Badge>
                  ) : (
                    <span className="shrink-0 whitespace-nowrap tabular-nums text-[11px] select-none text-ink-soft">{group.count}</span>
                  )}
                </div>
              ),
            },
            ...(expanded
              ? visibleBranchRows(group.tree, `remote:${group.source}`, folderOpen, 1, sourceId).map((row) => ({
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
                      updateByName={updateByName}
                      onBranchHoverStart={onBranchHoverStart}
                      onBranchHoverEnd={onBranchHoverEnd}
                    />
                  ),
                }))
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
            <Row
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
            <Row
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
            <Row
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
          render: () => <Row key={sub.path} label={sub.path} title={sub.describe || sub.hash} active={false} parentId="section:submodule" onClick={() => onOpenRepo(sub.repo)} />,
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
      remoteProbing,
      onProbeRemotes,
    ]
  )

  // SSR: headers only (all collapsed). Client: real prefs on first paint — auto-expand when searching.
  const expandedOf = (id: SectionId) => {
    if (!ready) return false
    const needle = id === 'local' ? localNeedle : id === 'remote' ? remoteNeedle : needleOf(id)
    if (needle) return true
    return Boolean(open[id])
  }

  return (
    <aside
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
                  {!(section.id === 'worktree' && isEdge) ? (
                    <Badge tone="neutral" size="mini" dot={false} className="shrink-0">
                      {badgeCount}
                    </Badge>
                  ) : null}
                  {section.notice && section.notice > 0 ? (
                    <Badge tone="accent" size="mini" dot={false} className="shrink-0" title={t('git.sidebar.remotePending')}>
                      {section.notice}
                    </Badge>
                  ) : null}
                </Button>
                {section.id === 'worktree' && isEdge ? (
                  <Tooltip content={t('git.sidebar.worktreeEdgeUnsupportedMsg')} placement="left">
                    <span
                      className="mr-2 flex size-6 shrink-0 cursor-help items-center justify-center text-fail hover:text-fail/80"
                      aria-label={t('git.sidebar.worktreeEdgeUnsupportedMsg')}
                    >
                      <LuCircleAlert className="size-3.5 text-fail" aria-hidden="true" />
                    </span>
                  </Tooltip>
                ) : null}
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
                  {section.id === 'worktree' && !isEdge && onAddWorktree ? (
                    <Button
                      variant="plain"
                      size="icon"
                      className="size-6 shrink-0 text-ink-soft hover:enabled:bg-[var(--overlay-08)]"
                      aria-label={t('git.sidebar.addWorktree') || '添加 Worktree'}
                      tooltip={t('git.sidebar.addWorktree') || '添加 Worktree'}
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddWorktree()
                      }}
                    >
                      <LuPlus className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                  {!(section.id === 'worktree' && isEdge) && (
                    <GitSearchDropdown
                      label={section.searchPlaceholder}
                      description={section.searchPlaceholder}
                      placeholder={
                        section.id === 'local' && !rawLocalNeedle && rawRemoteNeedle
                          ? `${section.searchPlaceholder} (${rawRemoteNeedle})`
                          : section.id === 'remote' && !rawRemoteNeedle && rawLocalNeedle
                            ? `${section.searchPlaceholder} (${rawLocalNeedle})`
                            : section.searchPlaceholder
                      }
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
      {deleteFolderModal?.open ? (
        <Modal
          open={deleteFolderModal.open}
          title={t('git.operations.deleteFolderBranchesConfirmTitle') || '批量删除分支'}
          description={
            t('git.operations.deleteFolderBranchesConfirmDesc', {
              folder: deleteFolderModal.folderLabel,
              count: deleteFolderModal.branchesToDelete.length,
            }) || `确定要删除文件夹 "${deleteFolderModal.folderLabel}" 下的 ${deleteFolderModal.branchesToDelete.length} 个本地分支吗？此操作不可逆。`
          }
          onClose={() => {
            if (!deletingFolderBranches) setDeleteFolderModal(null)
          }}
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="plain" size="md" disabled={deletingFolderBranches} onClick={() => setDeleteFolderModal(null)}>
                {t('common.cancel') || '取消'}
              </Button>
              <Button variant="fail" size="md" loading={deletingFolderBranches} onClick={() => void handleConfirmDeleteFolderBranches()}>
                {t('git.operations.confirmDeleteCount', { count: deleteFolderModal.branchesToDelete.length }) || `删除 ${deleteFolderModal.branchesToDelete.length} 个分支`}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 py-1">
            {deleteFolderModal.skippedCurrentBranch ? (
              <div className="flex items-center gap-2 rounded border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
                <LuCircleAlert className="size-4 shrink-0 text-warn" />
                <span>
                  {t('git.operations.deleteFolderBranchesSkippedCurrent', {
                    branch: deleteFolderModal.skippedCurrentBranch,
                  }) || `当前分支 "${deleteFolderModal.skippedCurrentBranch}" 将被跳过，不会被删除。`}
                </span>
              </div>
            ) : null}
            <div className="text-xs text-ink-soft">{t('git.operations.branchesToBeDeleted') || '将被删除的分支列表：'}</div>
            <div className="max-h-48 overflow-y-auto rounded border border-line bg-surface-panel p-2 flex flex-col gap-1">
              {deleteFolderModal.branchesToDelete.map((b) => (
                <div key={b} className="flex items-center gap-1.5 text-xs text-fail font-mono">
                  <LuGitBranch className="size-3.5 shrink-0" />
                  <span className="truncate">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
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
  onContextMenu,
  onFolderContextMenu,
  onCheckoutBranch,
  soloBranch,
  idPrefix = kind,
  parentId,
  updateByName,
  onBranchHoverStart,
  onBranchHoverEnd,
}: {
  nodes: BranchNode[]
  depth: number
  active: string
  kind: 'local' | 'remote'
  folderOpen: (id: string) => boolean
  onToggleFolder: (id: string) => void
  onSetFolder: (id: string, next: boolean) => void
  onSelect: (selection: GitSelection) => void
  onContextMenu?: (e: React.MouseEvent, item: BranchItem, kind: 'local' | 'remote') => void
  onFolderContextMenu?: (e: React.MouseEvent, node: BranchNode, kind: 'local' | 'remote', folderId: string, expanded: boolean) => void
  onCheckoutBranch?: (branch: string, isRemote?: boolean) => Promise<void> | void
  soloBranch?: string | null
  idPrefix?: string
  parentId?: string
  updateByName?: Map<string, GitRemoteProbe>
  onBranchHoverStart?: (branchName: string) => void
  onBranchHoverEnd?: () => void
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
              isSolo={soloBranch === node.item.name}
              active={active === `${kind}:${node.item.name}`}
              depth={depth}
              parentId={parentId}
              notice={Boolean(probe)}
              onClick={() => onSelect({ kind, name: node.item!.name })}
              onDoubleClick={() => onCheckoutBranch?.(node.item!.name, kind === 'remote')}
              onContextMenu={(e) => onContextMenu?.(e, node.item!, kind)}
              onPointerEnter={() => onBranchHoverStart?.(node.item!.name)}
              onPointerLeave={() => onBranchHoverEnd?.()}
            />
          )
        }

        const expanded = folderOpen(folderId)
        const branchActive = node.item ? active === `${kind}:${node.item.name}` : false
        return (
          <div key={folderId}>
            <div
              role="treeitem"
              tabIndex={0}
              data-git-tree-id={folderId}
              title={node.item?.title && node.item.title !== node.label ? node.item.title : undefined}
              aria-expanded={expanded}
              aria-selected={branchActive}
              aria-current={branchActive ? 'true' : undefined}
              className={cn(
                'group/folder flex h-8 w-full cursor-pointer select-text items-center justify-start gap-1.5 rounded-none px-2 font-normal text-xs text-ink-soft transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent',
                branchActive
                  ? 'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-accent font-medium hover:bg-[color-mix(in_oklab,var(--accent)_24%,transparent)]'
                  : 'hover:bg-[color-mix(in_oklab,var(--accent)_9%,transparent)]'
              )}
              style={depth > 0 ? { paddingLeft: 8 + depth * 14 } : undefined}
              onClick={() => {
                const sel = typeof window !== 'undefined' ? window.getSelection() : null
                if (sel && sel.toString().trim().length > 0) return
                if (node.item) onSelect({ kind, name: node.item.name })
                else onToggleFolder(folderId)
              }}
              onDoubleClick={() => {
                if (node.item) onCheckoutBranch?.(node.item.name, kind === 'remote')
              }}
              onPointerEnter={() => {
                if (node.item) onBranchHoverStart?.(node.item.name)
              }}
              onPointerLeave={() => {
                if (node.item) onBranchHoverEnd?.()
              }}
              onContextMenu={(e) => {
                if (node.item) {
                  onContextMenu?.(e, node.item, kind)
                } else {
                  onFolderContextMenu?.(e, node, kind, folderId, expanded)
                }
              }}
              onKeyDown={(event) => {
                if (handleTreeExpandKey(event, expanded, (next) => onSetFolder(folderId, next))) return
                handleTreeParentKey(event, parentId)
              }}
            >
              <span
                role="button"
                tabIndex={-1}
                className="inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center select-none"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleFolder(folderId)
                }}
              >
                {expanded ? <LuChevronDown className="size-3" aria-hidden /> : <LuChevronRight className="size-3" aria-hidden />}
              </span>
              <LuFolder className="size-3 shrink-0 select-none text-ink-soft" aria-hidden />
              <span data-git-sidebar-label className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-xs select-text">
                {node.label}
              </span>
              {node.item ? (
                <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
                  {soloBranch === node.item.name ? <span className="rounded bg-accent/20 px-1 py-0.2 text-[10px] font-semibold text-accent select-none">SOLO</span> : null}
                  <LuCheck
                    className={cn('size-3 shrink-0 text-accent select-none transition-opacity duration-150', node.item.current ? 'opacity-100' : 'pointer-events-none opacity-0')}
                    aria-hidden
                  />
                </div>
              ) : null}
            </div>
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
  isSolo,
  active,
  depth = 0,
  parentId,
  notice,
  onClick,
  onDoubleClick,
  onContextMenu,
  onPointerEnter,
  onPointerLeave,
}: {
  label: string
  title?: string
  current?: boolean
  isSolo?: boolean
  active: boolean
  depth?: number
  parentId?: string
  notice?: boolean
  onClick: () => void
  onDoubleClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}) {
  const t = useT()
  return (
    <div
      role="treeitem"
      tabIndex={0}
      title={title && title !== label ? title : undefined}
      aria-selected={active}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group/row flex h-8 w-full cursor-pointer select-text items-center justify-start px-2 font-normal text-xs text-ink transition-colors rounded-none outline-none focus-visible:ring-1 focus-visible:ring-accent',
        active
          ? 'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-accent font-medium hover:bg-[color-mix(in_oklab,var(--accent)_24%,transparent)]'
          : 'hover:bg-[color-mix(in_oklab,var(--accent)_9%,transparent)]'
      )}
      style={depth > 0 ? { paddingLeft: 8 + depth * 14 } : undefined}
      onClick={() => {
        const sel = typeof window !== 'undefined' ? window.getSelection() : null
        if (sel && sel.toString().trim().length > 0) return
        onClick()
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
          return
        }
        handleTreeParentKey(event, parentId)
      }}
    >
      <span data-git-sidebar-label className="min-w-0 flex-1 truncate whitespace-nowrap text-left select-text">
        {label}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
        {isSolo ? <span className="rounded bg-accent/20 px-1 py-0.2 text-[10px] font-semibold text-accent select-none">SOLO</span> : null}
        {notice ? <span className="size-1.5 shrink-0 rounded-full bg-accent select-none" aria-label={t('git.sidebar.remoteNewAria')} /> : null}
        <LuCheck
          className={cn('size-3.5 shrink-0 text-accent select-none transition-opacity duration-150', current ? 'opacity-100' : 'pointer-events-none opacity-0')}
          aria-hidden
        />
      </div>
    </div>
  )
}
