'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LuChevronDown, LuChevronRight, LuChevronsDownUp, LuChevronsUpDown, LuEllipsis, LuFolderTree, LuList, LuPencil, LuX } from 'react-icons/lu'
import { TbFileStack } from 'react-icons/tb'
import { TiMinusOutline, TiPlusOutline } from 'react-icons/ti'

import { GitSearchDropdown } from '@/components/git/GitSearchDropdown'
import { FloatingMenu } from '@/components/git/RefChipsCell'
import { handleTreeExpandKey, handleTreeParentKey } from '@/components/git/treeExpandKey'
import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, EmptyState, ScrollArea, SegmentedNav } from '@/components/sk'
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
  selectedPath: string
  onSelect: (path: string, status: string) => void
  onClose: () => void
}

type TreeNode = {
  name: string
  path: string
  file?: GitFileChange
  children: TreeNode[]
}

type ChangeCounts = { add: number; edit: number; del: number }
type FileView = 'path' | 'tree' | 'all'

function isFileView(value: unknown): value is FileView {
  return value === 'path' || value === 'tree' || value === 'all'
}

type PathGroup = { dir: string; files: GitFileChange[] }

type TFn = ReturnType<typeof useT>

function statusKind(status: string): keyof ChangeCounts | null {
  if (!status) return null
  if (status === 'A' || status === 'C') return 'add'
  if (status === 'D') return 'del'
  return 'edit'
}

function statusOf(status: string, t: TFn): { label: string; className: string; Icon: typeof TiPlusOutline; kind: keyof ChangeCounts } | null {
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
  for (const file of files) {
    const parts = file.path.split('/')
    let list = root
    let path = ''
    parts.forEach((name, index) => {
      path = path ? `${path}/${name}` : name
      let node = list.find((item) => item.name === name)
      if (!node) {
        node = { name, path, children: [] }
        list.push(node)
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

function tally(node: TreeNode): ChangeCounts {
  const counts: ChangeCounts = { add: 0, edit: 0, del: 0 }
  const kind = node.file ? statusKind(node.file.status) : null
  if (kind) counts[kind] += 1
  for (const child of node.children) {
    const next = tally(child)
    counts.add += next.add
    counts.edit += next.edit
    counts.del += next.del
  }
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
    </span>
  )
}

function TreeRows({
  nodes,
  depth,
  open,
  selected,
  onToggle,
  onSetOpen,
  onSelect,
  parentId,
}: {
  nodes: TreeNode[]
  depth: number
  open: Set<string>
  selected: string
  onToggle: (path: string) => void
  onSetOpen: (path: string, next: boolean) => void
  onSelect: (path: string, status: string) => void
  parentId?: string
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
            onKeyDown={(event) => {
              if (handleTreeExpandKey(event, expanded, (next) => onSetOpen(node.path, next))) return
              handleTreeParentKey(event, parentId)
            }}
          >
            {expanded ? <LuChevronDown className="size-3 shrink-0 text-ink-soft" aria-hidden /> : <LuChevronRight className="size-3 shrink-0 text-ink-soft" aria-hidden />}
            <span data-git-tree-label className="min-w-0 truncate whitespace-nowrap text-left text-xs">
              {node.name}
            </span>
            <CountMarks counts={tally(node)} />
          </Button>
          {expanded ? (
            <TreeRows nodes={node.children} depth={depth + 1} open={open} selected={selected} onToggle={onToggle} onSetOpen={onSetOpen} onSelect={onSelect} parentId={node.path} />
          ) : null}
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
        onKeyDown={(event) => handleTreeParentKey(event, parentId)}
      >
        {mark ? <mark.Icon className={cn('size-3 shrink-0', mark.className)} aria-hidden /> : <span className="size-3 shrink-0" aria-hidden />}
        <span data-git-tree-label className="min-w-0 truncate whitespace-nowrap text-left text-xs">
          {node.name}
        </span>
      </Button>
    )
  })
}

function PathRows({ groups, selected, onSelect }: { groups: PathGroup[]; selected: string; onSelect: (path: string, status: string) => void }) {
  const t = useT()
  return groups.map((group) => (
    <div key={group.dir || '.'} className="mb-2">
      <p className="m-0 truncate whitespace-nowrap px-2 py-1 text-[11px] font-medium text-ink" title={group.dir || '/'}>
        {group.dir || '/'}
      </p>
      {group.files.map((file) => {
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
          >
            {mark ? <mark.Icon className={cn('size-3 shrink-0', mark.className)} aria-hidden /> : <span className="size-3 shrink-0" aria-hidden />}
            <span data-git-tree-label className="min-w-0 truncate whitespace-nowrap text-left text-xs">
              {name}
            </span>
          </Button>
        )
      })}
    </div>
  ))
}

export function GitCommitPanel({ repo, commit, width, title, selectedPath, onSelect, onClose }: Props) {
  const t = useT()
  const panelTitle = title ?? t('git.panel.files')
  const isWorktree = commit.hash === GIT_WORKTREE_HASH
  const viewItems = useMemo(() => {
    const items = [
      { id: 'path' as const, label: t('git.commit.pathView'), icon: <LuList /> },
      { id: 'tree' as const, label: t('git.commit.treeView'), icon: <LuFolderTree /> },
      { id: 'all' as const, label: t('git.commit.allFiles'), icon: <TbFileStack /> },
    ]
    return isWorktree ? items.filter((item) => item.id !== 'all') : items
  }, [isWorktree, t])
  const panelRef = useRef<HTMLElement>(null)
  const [panelWidth, setPanelWidth] = useState(width)
  const [changes, setChanges] = useState<GitCommitChanges | null>(null)
  const [allFiles, setAllFiles] = useState<GitFileChange[] | null>(null)
  const [error, setError] = useState('')
  const [fileQuery, setFileQuery] = useState('')
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<{ x: number; y: number } | null>(null)
  const fileNeedle = fileQuery.trim().toLowerCase()
  const [preferredView, setView] = useGitUiPref('commit.fileView', 'tree' as FileView, isFileView)
  // Working trees have no committed snapshot; keep the shared preference intact.
  const view = isWorktree && preferredView === 'all' ? 'tree' : preferredView
  const [expandDefault, setExpandDefault] = useGitUiPref('commit.treeExpandDefault', true, isBoolean)
  const [openPaths, setOpenPaths] = useState<Set<string>>(() => new Set())
  const expandDefaultRef = useRef(expandDefault)
  expandDefaultRef.current = expandDefault

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || typeof ResizeObserver === 'undefined') return
    const sync = () => setPanelWidth(panel.clientWidth)
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    setChanges(null)
    setAllFiles(null)
    setError('')
    setFileQuery('')
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
        setOpenPaths(expandDefaultRef.current ? new Set(folderPaths(buildTree(body.files))) : new Set())
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('git.errors.readChanges'))
      })
    return () => {
      cancelled = true
    }
  }, [repo, commit.hash, t])

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

  const changedFiles = useMemo(() => changes?.files || [], [changes?.files])
  const filteredChangedFiles = useMemo(() => {
    if (!fileNeedle) return changedFiles
    return changedFiles.filter((f) => f.path.toLowerCase().includes(fileNeedle))
  }, [changedFiles, fileNeedle])

  const filteredAllFiles = useMemo(() => {
    if (!allFiles) return null
    if (!fileNeedle) return allFiles
    return allFiles.filter((f) => f.path.toLowerCase().includes(fileNeedle))
  }, [allFiles, fileNeedle])

  const changedTree = useMemo(() => buildTree(filteredChangedFiles), [filteredChangedFiles])
  const pathGroups = useMemo(() => groupByPath(filteredChangedFiles), [filteredChangedFiles])
  const allTree = useMemo(() => buildTree(filteredAllFiles || []), [filteredAllFiles])
  const activeTree = view === 'all' ? allTree : changedTree
  const folders = useMemo(() => folderPaths(activeTree), [activeTree])
  const allOpen = folders.length > 0 && folders.every((path) => openPaths.has(path))
  const canExpand = (view === 'tree' || view === 'all') && folders.length > 0
  const badgeCount = view === 'all' ? (filteredAllFiles?.length ?? filteredChangedFiles.length) : filteredChangedFiles.length

  useEffect(() => {
    if (fileNeedle && folders.length > 0) {
      setOpenPaths(new Set(folders))
    }
  }, [fileNeedle, folders])

  // 变窄时按优先级转为二级菜单或隐藏，防止视图 Tabs 与右侧操作冲突重合
  const isNarrow = panelWidth < 310
  const showCount = panelWidth >= 260
  const showExpand = !isNarrow && canExpand && panelWidth >= 220
  const showViews = !isNarrow && panelWidth >= 180
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
      <header
        className={cn(
          'grid h-10 shrink-0 items-center gap-1.5 border-b border-line px-2',
          showViews ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_auto]'
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="m-0 shrink-0 whitespace-nowrap text-xs font-medium text-ink">{panelTitle}</h2>
          {changes && showCount ? (
            <Badge tone="neutral" size="mini" dot={false}>
              {badgeCount}
            </Badge>
          ) : null}
        </div>
        {showViews ? (
          <SegmentedNav aria-label={t('git.commit.fileViewsAria')} className="justify-self-center" size="mini" items={viewItems} value={view} onChange={setView} />
        ) : null}
        <div className="flex items-center justify-end gap-1">
          <GitSearchDropdown
            className="mr-0 size-6"
            label="搜索文件"
            description="按名称或路径快速过滤"
            placeholder="搜索文件路径或名称…"
            value={fileQuery}
            onChange={setFileQuery}
          />
          {isNarrow ? (
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
              <LuEllipsis className="size-3.5" aria-hidden="true" />
            </Button>
          ) : showExpand ? (
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
              label: `${view === 'tree' ? '✓ ' : ''}${t('git.commit.treeView') || '目录树'}`,
              icon: <LuFolderTree className="size-3.5 text-accent" />,
              onSelect: () => setView('tree'),
            },
            {
              key: 'view-path',
              label: `${view === 'path' ? '✓ ' : ''}${t('git.commit.pathView') || '路径列表'}`,
              icon: <LuList className="size-3.5 text-accent" />,
              onSelect: () => setView('path'),
            },
            ...(!isWorktree
              ? [
                  {
                    key: 'view-all',
                    label: `${view === 'all' ? '✓ ' : ''}${t('git.commit.allFiles') || '提交快照'}`,
                    icon: <TbFileStack className="size-3.5 text-accent" />,
                    onSelect: () => setView('all'),
                  },
                ]
              : []),
            ...(canExpand
              ? [
                  {
                    key: 'toggle-expand',
                    label: allOpen ? t('git.commit.collapseAll') || '全部折叠' : t('git.commit.expandAll') || '全部展开',
                    icon: allOpen ? <LuChevronsDownUp className="size-3.5" /> : <LuChevronsUpDown className="size-3.5" />,
                    onSelect: () => {
                      const next = !allOpen
                      setExpandDefault(next)
                      setOpenPaths(next ? new Set(folders) : new Set())
                    },
                    dividerBefore: true,
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
      ) : (
        <ScrollArea className="min-h-0 flex-1" indicator="vertical" reserveGutter={false}>
          {view === 'path' ? (
            filteredChangedFiles.length === 0 ? (
              <EmptyState
                density="compact"
                className="px-3 py-8"
                title={fileNeedle ? '未找到匹配的文件' : isWorktree ? t('git.commit.cleanWorktree') : t('git.commit.noChanges')}
                message={fileNeedle ? '换个关键词试试。' : isWorktree ? t('git.commit.cleanWorktreeMsg') : t('git.commit.noChangesMsg')}
              />
            ) : (
              <div role="list" aria-label={t('git.commit.pathListAria')}>
                <PathRows groups={pathGroups} selected={selectedPath} onSelect={onSelect} />
              </div>
            )
          ) : view === 'all' ? (
            (filteredAllFiles?.length ?? 0) === 0 ? (
              <EmptyState
                density="compact"
                className="px-3 py-8"
                title={fileNeedle ? '未找到匹配的文件' : isWorktree ? t('git.commit.cleanWorktree') : t('git.commit.noFiles')}
                message={fileNeedle ? '换个关键词试试。' : isWorktree ? t('git.commit.cleanWorktreeMsg') : t('git.commit.noFilesMsg')}
              />
            ) : (
              <div role="tree" aria-label={t('git.commit.allFilesAria')}>
                <TreeRows nodes={allTree} depth={0} open={openPaths} selected={selectedPath} onToggle={toggleFolder} onSetOpen={setFolderOpen} onSelect={onSelect} />
              </div>
            )
          ) : filteredChangedFiles.length === 0 ? (
            <EmptyState
              density="compact"
              className="px-3 py-8"
              title={fileNeedle ? '未找到匹配的文件' : isWorktree ? t('git.commit.cleanWorktree') : t('git.commit.noChanges')}
              message={fileNeedle ? '换个关键词试试。' : isWorktree ? t('git.commit.cleanWorktreeMsg') : t('git.commit.noChangesMsg')}
            />
          ) : (
            <div role="tree" aria-label={t('git.commit.treeAria')}>
              <TreeRows nodes={changedTree} depth={0} open={openPaths} selected={selectedPath} onToggle={toggleFolder} onSetOpen={setFolderOpen} onSelect={onSelect} />
            </div>
          )}
        </ScrollArea>
      )}
    </aside>
  )
}
