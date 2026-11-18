'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LuChevronDown,
  LuChevronRight,
  LuChevronsDownUp,
  LuChevronsUpDown,
  LuCopy,
  LuExternalLink,
  LuFileText,
  LuFolder,
  LuFolderTree,
  LuList,
  LuPanelsTopLeft,
  LuPencil,
  LuTriangleAlert,
  LuX,
} from 'react-icons/lu'
import { TbFileStack } from 'react-icons/tb'
import { TiMinusOutline, TiPlusOutline } from 'react-icons/ti'

import { GitSearchDropdown } from '@/components/git/GitSearchDropdown'
import { FloatingMenu, type FloatingMenuItem } from '@/components/git/RefChipsCell'
import { handleTreeExpandKey, handleTreeParentKey } from '@/components/git/treeExpandKey'
import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, EmptyState, VirtualList } from '@/components/sk'
import { getGitDriver } from '@/lib/git/driver'
import { GIT_WORKTREE_HASH, type GitCommit, type GitCommitChanges, type GitFileChange } from '@/lib/git/types'
import { isBoolean, useGitUiPref } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'

type Props = {
  repo: string
  remoteUrl?: string
  commit: GitCommit
  width: number
  /** Panel heading; defaults to 「文件」. */
  title?: string
  conflictFiles?: string[]
  conflictFileCounts?: Record<string, number | null>
  selectedPath: string
  onSelect: (path: string, status: string) => void
  onFilesLoaded?: (files: GitFileChange[]) => void
  onClose: () => void
}

type TreeNode = {
  name: string
  path: string
  file?: GitFileChange
  children: TreeNode[]
}

type ChangeCounts = { add: number; edit: number; del: number; conflict?: number | null }
type ConflictCounts = Record<string, number | null>
type ChangeKind = 'add' | 'edit' | 'del'
type FileView = 'path' | 'tree' | 'all'

function isFileView(value: unknown): value is FileView {
  return value === 'path' || value === 'tree' || value === 'all'
}

type PathGroup = { dir: string; files: GitFileChange[] }

type TFn = ReturnType<typeof useT>

function statusKind(status: string): ChangeKind | null {
  if (!status) return null
  if (status === 'A' || status === 'C') return 'add'
  if (status === 'D') return 'del'
  return 'edit'
}

function statusOf(status: string, t: TFn): { label: string; className: string; Icon: typeof TiPlusOutline; kind: ChangeKind } | null {
  if (!status) return null
  if (status === 'A' || status === 'C') return { label: t('git.status.add'), className: 'text-ok', Icon: TiPlusOutline, kind: 'add' }
  if (status === 'D') return { label: t('git.status.delete'), className: 'text-fail', Icon: TiMinusOutline, kind: 'del' }
  return {
    label: status === 'R' ? t('git.status.rename') : t('git.status.modify'),
    className: 'text-warn',
    Icon: LuPencil,
    kind: 'edit',
  }
}

function buildTree(files: GitFileChange[]): TreeNode[] {
  const root: TreeNode[] = []
  const directories = new Map<TreeNode[], Map<string, TreeNode>>()
  for (const file of files) {
    const parts = file.path.split('/')
    let list = root
    let path = ''
    parts.forEach((name, index) => {
      path = path ? `${path}/${name}` : name
      let siblings = directories.get(list)
      if (!siblings) {
        siblings = new Map()
        directories.set(list, siblings)
      }
      let node = siblings.get(name)
      if (!node) {
        node = { name, path, children: [] }
        list.push(node)
        siblings.set(name, node)
      }
      if (index === parts.length - 1) node.file = file
      list = node.children
    })
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((left, right) => Number(right.children.length > 0) - Number(left.children.length > 0) || left.name.localeCompare(right.name))
    nodes.forEach((node) => sort(node.children))
  }
  sort(root)
  return root
}

function groupByPath(files: GitFileChange[]): PathGroup[] {
  const map = new Map<string, GitFileChange[]>()
  for (const file of files) {
    const slash = file.path.lastIndexOf('/')
    const dir = slash >= 0 ? `${file.path.slice(0, slash + 1)}` : ''
    const list = map.get(dir) || []
    list.push(file)
    map.set(dir, list)
  }
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dir, items]) => ({
      dir,
      files: items.slice().sort((left, right) => left.path.localeCompare(right.path)),
    }))
}

function tally(node: TreeNode, conflicts: ConflictCounts, index?: Map<string, ChangeCounts>): ChangeCounts {
  const counts: ChangeCounts = { add: 0, edit: 0, del: 0, conflict: conflicts[node.path] }
  const kind = node.file ? statusKind(node.file.status) : null
  if (kind) counts[kind] += 1
  for (const child of node.children) {
    const next = tally(child, conflicts, index)
    counts.add += next.add
    counts.edit += next.edit
    counts.del += next.del
    if (next.conflict !== undefined) {
      counts.conflict = counts.conflict === null || next.conflict === null ? null : (counts.conflict ?? 0) + next.conflict
    }
  }
  index?.set(node.path, counts)
  return counts
}

function folderPaths(nodes: TreeNode[], into: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      into.push(node.path)
      folderPaths(node.children, into)
    }
  }
  return into
}

function fileName(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash >= 0 ? path.slice(slash + 1) : path
}

function ConflictMark({ count }: { count: number | null | undefined }) {
  const t = useT()
  if (count === undefined) return null
  const label = count === null ? t('git.commit.conflictCountUnknown') : t('git.commit.conflictLocations', { count })
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 text-warn tabular-nums" title={label} aria-label={label}>
      <LuTriangleAlert className="size-3" aria-hidden />
      {count ?? '?'}
    </span>
  )
}

function CountMarks({ counts }: { counts: ChangeCounts }) {
  return (
    <span className="ml-1.5 flex shrink-0 items-center gap-2 tabular-nums">
      {counts.edit > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-warn">
          <LuPencil className="size-3" aria-hidden />
          {counts.edit}
        </span>
      ) : null}
      {counts.add > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-ok">
          <TiPlusOutline className="size-3" aria-hidden />
          {counts.add}
        </span>
      ) : null}
      {counts.del > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-fail">
          <TiMinusOutline className="size-3" aria-hidden />
          {counts.del}
        </span>
      ) : null}
      <ConflictMark count={counts.conflict} />
    </span>
  )
}

function TreeRows({
  nodes,
  depth,
  open,
  selected,
  conflictCounts,
  onToggle,
  onSetOpen,
  onSelect,
  parentId,
  counts,
  onFileContextMenu,
  onFolderContextMenu,
}: {
  nodes: TreeNode[]
  depth: number
  open: Set<string>
  selected: string
  conflictCounts: ConflictCounts
  onToggle: (path: string) => void
  onSetOpen: (path: string, next: boolean) => void
  onSelect: (path: string, status: string) => void
  parentId?: string
  counts?: Map<string, ChangeCounts>
  onFileContextMenu?: (event: React.MouseEvent, path: string, name: string, status: string) => void
  onFolderContextMenu?: (event: React.MouseEvent, path: string, name: string) => void
}) {
  const t = useT()
  return nodes.map((node) => {
    const folder = node.children.length > 0
    const expanded = folder && open.has(node.path)
    if (folder) {
      return (
        <div key={node.path}>
          <Button
            variant="plain"
            data-git-tree-id={node.path}
            className="h-7 w-full justify-start gap-1.5 rounded-none px-2 font-normal text-ink"
            style={{ paddingLeft: 8 + depth * 14 }}
            aria-expanded={expanded}
            onClick={() => onToggle(node.path)}
            onContextMenu={(event) => {
              event.preventDefault()
              onFolderContextMenu?.(event, node.path, node.name)
            }}
            onKeyDown={(event) => {
              if (handleTreeExpandKey(event, expanded, (next) => onSetOpen(node.path, next))) return
              handleTreeParentKey(event, parentId)
            }}
          >
            {expanded ? <LuChevronDown className="size-3 shrink-0 text-ink-soft" aria-hidden /> : <LuChevronRight className="size-3 shrink-0 text-ink-soft" aria-hidden />}
            <span data-git-tree-label className="min-w-0 truncate whitespace-nowrap text-left text-xs">
              {node.name}
            </span>
            <CountMarks counts={counts?.get(node.path) ?? tally(node, conflictCounts)} />
          </Button>
        </div>
      )
    }
    const mark = statusOf(node.file?.status || '', t)
    const active = selected === node.path
    const status = node.file?.status || ''
    return (
      <Button
        key={node.path}
        variant="plain"
        aria-pressed={active}
        aria-label={mark ? `${mark.label} ${node.name}` : node.name}
        className={cn(
          'h-7 w-full justify-start gap-1.5 rounded-none px-2 font-normal',
          mark ? 'text-ink' : 'text-ink-soft',
          active && 'bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-ink'
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(node.path, status || 'M')}
        onContextMenu={(event) => {
          event.preventDefault()
          onFileContextMenu?.(event, node.path, node.name, status || 'M')
        }}
        onKeyDown={(event) => handleTreeParentKey(event, parentId)}
      >
        {mark ? <mark.Icon className={cn('size-3 shrink-0', mark.className)} aria-hidden /> : <span className="size-3 shrink-0" aria-hidden />}
        <span data-git-tree-label className="min-w-0 truncate whitespace-nowrap text-left text-xs">
          {node.name}
        </span>
        <ConflictMark count={conflictCounts[node.path]} />
      </Button>
    )
  })
}

function PathRows({
  groups,
  headerOnly = false,
  fileOnly = false,
  selected,
  conflictCounts,
  onSelect,
  onFileContextMenu,
  onFolderContextMenu,
}: {
  groups: PathGroup[]
  headerOnly?: boolean
  fileOnly?: boolean
  selected: string
  conflictCounts: ConflictCounts
  onSelect: (path: string, status: string) => void
  onFileContextMenu?: (event: React.MouseEvent, path: string, name: string, status: string) => void
  onFolderContextMenu?: (event: React.MouseEvent, path: string, name: string) => void
}) {
  const t = useT()
  return groups.map((group) => (
    <div key={group.dir || '.'} className="h-7">
      {!fileOnly && (
        <p
          className="m-0 flex items-center whitespace-nowrap px-2 py-1 text-[11px] font-medium text-ink cursor-default"
          title={group.dir || '/'}
          onContextMenu={(event) => {
            event.preventDefault()
            onFolderContextMenu?.(event, group.dir || '.', group.dir || '/')
          }}
        >
          <span className="min-w-0 truncate">{group.dir || '/'}</span>
          <CountMarks counts={tally({ name: '', path: '', children: group.files.map((file) => ({ name: file.path, path: file.path, file, children: [] })) }, conflictCounts)} />
        </p>
      )}
      {!headerOnly &&
        group.files.map((file) => {
          const mark = statusOf(file.status, t)
          const name = fileName(file.path)
          const active = selected === file.path
          return (
            <Button
              key={file.path}
              variant="plain"
              aria-pressed={active}
              aria-label={mark ? `${mark.label} ${file.path}` : file.path}
              title={file.path}
              className={cn('h-7 w-full justify-start gap-1.5 rounded-none px-2 font-normal text-ink', active && 'bg-[color-mix(in_oklab,var(--accent)_18%,transparent)]')}
              onClick={() => onSelect(file.path, file.status || 'M')}
              onContextMenu={(event) => {
                event.preventDefault()
                onFileContextMenu?.(event, file.path, name, file.status || 'M')
              }}
            >
              {mark ? <mark.Icon className={cn('size-3 shrink-0', mark.className)} aria-hidden /> : <span className="size-3 shrink-0" aria-hidden />}
              <span data-git-tree-label className="min-w-0 truncate whitespace-nowrap text-left text-xs">
                {name}
              </span>
              <ConflictMark count={conflictCounts[file.path]} />
            </Button>
          )
        })}
    </div>
  ))
}

export function GitCommitPanel({ repo, commit, width, title, conflictFiles, conflictFileCounts, selectedPath, onSelect, onFilesLoaded, onClose }: Props) {
  const t = useT()
  const panelTitle = title ?? t('git.panel.files')
  const isWorktree = commit.hash === GIT_WORKTREE_HASH
  const panelRef = useRef<HTMLElement>(null)
  const [changes, setChanges] = useState<GitCommitChanges | null>(null)
  const [allFiles, setAllFiles] = useState<GitFileChange[] | null>(null)
  const [error, setError] = useState('')
  const [fileQuery, setFileQuery] = useState('')
  const [conflictsOnly, setConflictsOnly] = useState(false)
  const conflictCounts = useMemo<ConflictCounts>(
    () => Object.assign(Object.create(null), Object.fromEntries((conflictFiles ?? []).map((file) => [file, conflictFileCounts?.[file] ?? null]))),
    [conflictFiles, conflictFileCounts]
  )
  const conflictFileCount = Object.keys(conflictCounts).length
  const filterConflicts = conflictsOnly && conflictFileCount > 0
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    anchor: { x: number; y: number }
    items: FloatingMenuItem[]
    ariaLabel: string
  } | null>(null)
  const fileNeedle = fileQuery.trim().toLowerCase()
  const [preferredView, setView] = useGitUiPref('commit.fileView', 'tree' as FileView, isFileView)
  // Working trees have no committed snapshot; keep the shared preference intact.
  const view = isWorktree && preferredView === 'all' ? 'tree' : preferredView
  const [expandDefault, setExpandDefault] = useGitUiPref('commit.treeExpandDefault', true, isBoolean)
  const [openPaths, setOpenPaths] = useState<Set<string>>(() => new Set())
  const expandDefaultRef = useRef(expandDefault)
  expandDefaultRef.current = expandDefault

  useEffect(() => {
    let cancelled = false
    setChanges(null)
    setAllFiles(null)
    setError('')
    setFileQuery('')
    setConflictsOnly(false)
    setOpenPaths(new Set())
    const driver = getGitDriver()
    driver
      .readCommitDiff({ repo, hash: commit.hash, tree: true })
      .then((body) => {
        if (cancelled) return
        if (!body || !body.files) {
          setError(t('git.errors.readChanges'))
          return
        }
        setChanges(body)
        onFilesLoaded?.(body.files || [])
        setOpenPaths(expandDefaultRef.current ? new Set(folderPaths(buildTree(body.files))) : new Set())
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('git.errors.readChanges'))
      })
    return () => {
      cancelled = true
    }
  }, [repo, commit.hash, t, onFilesLoaded])

  useEffect(() => {
    if (view !== 'all' || allFiles || !changes) return
    let cancelled = false
    const driver = getGitDriver()
    driver
      .readCommitDiff({ repo, hash: commit.hash, tree: true, all: true })
      .then((body) => {
        if (cancelled) return
        if (!body || !body.files) {
          setError(t('git.errors.readTree'))
          return
        }
        setAllFiles(body.files)
        setOpenPaths(expandDefaultRef.current ? new Set(folderPaths(buildTree(body.files))) : new Set())
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('git.errors.readTree'))
      })
    return () => {
      cancelled = true
    }
  }, [view, allFiles, changes, repo, commit.hash, t])

  // A merge can resolve a conflict to the first parent's content, omitting it
  // from the regular commit diff. Keep that file available in conflict filtering.
  const changedFiles = useMemo(() => {
    const files = [...new Map((changes?.files || []).map((file) => [file.path, file])).values()]
    const paths = new Set(files.map((file) => file.path))
    return [
      ...files,
      ...Object.keys(conflictCounts)
        .filter((path) => !paths.has(path))
        .map((path) => ({ path, oldPath: '', status: 'M' })),
    ]
  }, [changes?.files, conflictCounts])
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
  const treeRows = useMemo(() => {
    const rows: Array<{ node: TreeNode; depth: number; parentId?: string }> = []
    const visit = (nodes: TreeNode[], depth: number, parentId?: string) => {
      for (const node of nodes) {
        rows.push({ node, depth, parentId })
        if (node.children.length && openPaths.has(node.path)) visit(node.children, depth + 1, node.path)
      }
    }
    visit(activeTree, 0)
    return rows
  }, [activeTree, openPaths])
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

  // Move view controls to the overflow menu before header groups can overlap.

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

  const handleFileContextMenu = (e: React.MouseEvent, filePath: string, fileName: string, status: string) => {
    const absPath = repo ? `${repo.replace(/\/+$/, '')}/${filePath}` : filePath
    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: fileName,
      items: [
        {
          key: 'copy-relative',
          label: '复制相对路径',
          icon: <LuCopy className="size-3.5" />,
          onSelect: () => void navigator.clipboard?.writeText(filePath),
        },
        {
          key: 'copy-name',
          label: '复制文件名',
          icon: <LuFileText className="size-3.5" />,
          onSelect: () => void navigator.clipboard?.writeText(fileName),
        },
        {
          key: 'copy-absolute',
          label: '复制绝对路径',
          icon: <LuCopy className="size-3.5" />,
          onSelect: () => void navigator.clipboard?.writeText(absPath),
        },
        {
          key: 'view-diff',
          label: '查看文件差异',
          icon: <LuExternalLink className="size-3.5 text-accent" />,
          dividerBefore: true,
          onSelect: () => onSelect(filePath, status || 'M'),
        },
      ],
    })
  }

  const handleFolderContextMenu = (e: React.MouseEvent, folderPath: string, folderName: string) => {
    const absPath = repo ? `${repo.replace(/\/+$/, '')}/${folderPath}` : folderPath
    const isOpen = openPaths.has(folderPath)
    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: folderName,
      items: [
        {
          key: 'copy-folder-path',
          label: '复制文件夹路径',
          icon: <LuCopy className="size-3.5" />,
          onSelect: () => void navigator.clipboard?.writeText(folderPath),
        },
        {
          key: 'copy-folder-name',
          label: '复制文件夹名',
          icon: <LuFolder className="size-3.5" />,
          onSelect: () => void navigator.clipboard?.writeText(folderName),
        },
        {
          key: 'copy-abs-folder',
          label: '复制绝对路径',
          icon: <LuCopy className="size-3.5" />,
          onSelect: () => void navigator.clipboard?.writeText(absPath),
        },
        {
          key: 'toggle-folder',
          label: isOpen ? '折叠文件夹' : '展开文件夹',
          icon: isOpen ? <LuChevronDown className="size-3.5" /> : <LuChevronRight className="size-3.5" />,
          dividerBefore: true,
          onSelect: () => toggleFolder(folderPath),
        },
      ],
    })
  }

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
      <header className="grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 border-b border-line px-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="m-0 shrink-0 whitespace-nowrap text-xs font-medium text-ink">{panelTitle}</h2>
          {changes ? (
            <Badge tone="neutral" size="mini" dot={false}>
              {badgeCount}
            </Badge>
          ) : null}
        </div>
        <div className="flex h-8 items-center justify-end gap-1 [&_button]:size-6">
          <GitSearchDropdown
            className="mr-0 size-6"
            label="搜索文件"
            description="按名称或路径快速过滤"
            placeholder="搜索文件路径或名称…"
            value={fileQuery}
            onChange={setFileQuery}
          />
          {
            <Button
              variant="plain"
              size="icon"
              className="size-6 text-ink-soft hover:enabled:bg-[var(--overlay-08)]"
              aria-label="视图与展开选项"
              tooltip="视图与展开选项"
              onClick={(e) => {
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                setMoreMenuAnchor((prev) => (prev ? null : { x: rect.right, y: rect.bottom + 4 }))
              }}
            >
              <LuPanelsTopLeft className="size-3.5" aria-hidden="true" />
            </Button>
          }
          {canExpand ? (
            <Button
              variant="plain"
              size="icon"
              aria-label={allOpen ? t('git.commit.collapseAll') : t('git.commit.expandAll')}
              aria-pressed={allOpen}
              tooltip={allOpen ? t('git.commit.collapseAll') : t('git.commit.expandAll')}
              onClick={() => {
                const next = !allOpen
                setExpandDefault(next)
                setOpenPaths(next ? new Set(folders) : new Set())
              }}
            >
              {allOpen ? <LuChevronsDownUp className="size-3.5" aria-hidden /> : <LuChevronsUpDown className="size-3.5" aria-hidden />}
            </Button>
          ) : null}
          <Button variant="plain" size="icon" aria-label={t('git.commit.closeTree')} onClick={onClose}>
            <LuX className="size-3.5" aria-hidden />
          </Button>
        </div>
      </header>
      {moreMenuAnchor ? (
        <FloatingMenu
          anchor={moreMenuAnchor}
          ariaLabel="视图与展开选项"
          color="var(--accent)"
          onClose={() => setMoreMenuAnchor(null)}
          items={[
            {
              key: 'view-tree',
              label: t('git.commit.treeView'),
              icon: <LuFolderTree className="size-3.5 text-accent" />,
              checked: view === 'tree',
              group: t('git.commit.fileViewsAria'),
              onSelect: () => setView('tree'),
            },
            {
              key: 'view-path',
              label: t('git.commit.pathView'),
              icon: <LuList className="size-3.5 text-accent" />,
              checked: view === 'path',
              group: t('git.commit.fileViewsAria'),
              onSelect: () => setView('path'),
            },
            ...(!isWorktree
              ? [
                  {
                    key: 'view-all',
                    label: t('git.commit.allFiles'),
                    icon: <TbFileStack className="size-3.5 text-accent" />,
                    checked: view === 'all',
                    group: t('git.commit.fileViewsAria'),
                    onSelect: () => setView('all'),
                  },
                ]
              : []),
            ...(conflictFileCount > 0
              ? [
                  {
                    key: 'conflicts-only',
                    label: t('git.commit.conflictsOnly'),
                    icon: <LuTriangleAlert className="size-3.5 text-warn" />,
                    checked: filterConflicts,
                    group: t('git.commit.conflictsOnly'),
                    onSelect: () => setConflictsOnly((value) => !value),
                  },
                ]
              : []),
          ]}
        />
      ) : null}
      {error ? (
        <p className="m-0 px-3 py-2 text-xs text-fail">{error}</p>
      ) : !changes || (view === 'all' && !allFiles) ? (
        <div className="flex flex-col gap-2 px-3 py-2" aria-hidden>
          <div className="h-7 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
          <div className="h-7 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
          <div className="h-7 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]" />
        </div>
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
              />
            )
          }}
        />
      )}

      {contextMenu ? (
        <FloatingMenu anchor={contextMenu.anchor} ariaLabel={contextMenu.ariaLabel} color="var(--accent)" onClose={() => setContextMenu(null)} items={contextMenu.items} />
      ) : null}
    </aside>
  )
}
