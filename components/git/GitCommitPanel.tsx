'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LuChevronDown, LuChevronRight, LuChevronsDownUp, LuChevronsUpDown, LuFolderTree, LuGitMerge, LuList, LuPencil, LuX } from 'react-icons/lu'
import { TbFileStack } from 'react-icons/tb'
import { TiMinusOutline, TiPlusOutline } from 'react-icons/ti'

import { handleTreeExpandKey, handleTreeParentKey } from '@/components/git/treeExpandKey'
import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, EmptyState, ScrollArea, SegmentedNav } from '@/components/sk'
import { getGitDriver } from '@/lib/git/driver'
import { analyzeMergeTopology } from '@/lib/git/topology'
import { GIT_WORKTREE_HASH, type GitCommit, type GitCommitChanges, type GitFileChange } from '@/lib/git/types'
import { isBoolean, useGitUiPref } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'

type Props = {
  repo: string
  remoteUrl?: string
  commit: GitCommit
  allCommits?: GitCommit[]
  isLineageHighlighted?: boolean
  onToggleHighlightLineage?: (hashes: string[]) => void
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

export function GitCommitPanel({ repo, commit, allCommits, isLineageHighlighted, onToggleHighlightLineage, width, title, selectedPath, onSelect, onClose }: Props) {
  const t = useT()
  const topology = useMemo(() => {
    if (!commit.parents || commit.parents.length < 2) return null
    const map = allCommits ? new Map(allCommits.map((c) => [c.hash, c])) : undefined
    return analyzeMergeTopology(commit, map)
  }, [commit, allCommits])
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
  const [view, setView] = useGitUiPref('commit.fileView', 'tree' as FileView, isFileView)
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

  const changedFiles = changes?.files || []
  const changedTree = useMemo(() => buildTree(changedFiles), [changedFiles])
  const pathGroups = useMemo(() => groupByPath(changedFiles), [changedFiles])
  const allTree = useMemo(() => buildTree(allFiles || []), [allFiles])
  const activeTree = view === 'all' ? allTree : changedTree
  const folders = useMemo(() => folderPaths(activeTree), [activeTree])
  const allOpen = folders.length > 0 && folders.every((path) => openPaths.has(path))
  const canExpand = (view === 'tree' || view === 'all') && folders.length > 0
  const badgeCount = view === 'all' ? (allFiles?.length ?? changedFiles.length) : changedFiles.length
  // 变窄时按优先级隐藏：文件个数 → 全部展开 → 视窗切换；关闭按钮始终保留
  const showCount = panelWidth >= 260
  const showExpand = canExpand && panelWidth >= 220
  const showViews = panelWidth >= 180
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

  useEffect(() => {
    if (isWorktree && view === 'all') setView('tree')
  }, [isWorktree, view, setView])

  return (
    <aside
      ref={panelRef}
      data-git-tree
      data-git-tree-root
      className="relative z-20 flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-line bg-panel"
      style={{ width: `var(--git-tree-w, ${width}px)` }}
      aria-label={panelTitle}
    >
      <header
        className={cn(
          'grid h-10 shrink-0 items-center gap-2 border-b border-line px-2',
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
        {showViews ? <SegmentedNav aria-label={t('git.commit.fileViewsAria')} className="justify-self-center" items={viewItems} value={view} onChange={setView} /> : null}
        <div className="flex items-center justify-end gap-1">
          {showExpand ? (
            <Button
              variant="plain"
              size="icon"
              aria-label={allOpen ? t('git.commit.collapseAll') : t('git.commit.expandAll')}
              aria-pressed={allOpen}
              onClick={() => {
                const next = !allOpen
                setExpandDefault(next)
                setOpenPaths(next ? new Set(folders) : new Set())
              }}
            >
              {allOpen ? <LuChevronsDownUp aria-hidden /> : <LuChevronsUpDown aria-hidden />}
            </Button>
          ) : null}
          <Button variant="plain" size="icon" aria-label={t('git.commit.closeTree')} onClick={onClose}>
            <LuX aria-hidden />
          </Button>
        </div>
      </header>
      {topology?.isMerge ? (
        <div className="flex items-center gap-1.5 border-b border-line bg-[var(--overlay-04)] px-3 py-1.5 text-xs font-mono">
          <LuGitMerge className="size-3.5 shrink-0 text-accent" aria-hidden />
          <span className="text-ink-soft">{t('git.commit.mergeLineage')}:</span>
          <span className="font-medium text-accent">{topology.sourceBranchHint || 'feature'}</span>
          <span className="text-ink-soft">➔</span>
          <span className="font-medium text-ink">{topology.targetBranchHint || 'main'}</span>
          {topology.commitsIncluded.length > 0 ? (
            <button
              type="button"
              className={cn(
                'ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-sans font-medium transition-all duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-accent',
                isLineageHighlighted
                  ? 'bg-accent text-accent-contrast shadow-sm'
                  : 'bg-[color-mix(in_oklab,var(--accent)_15%,transparent)] text-accent hover:bg-[color-mix(in_oklab,var(--accent)_25%,transparent)]'
              )}
              title={isLineageHighlighted ? t('git.commit.clearHighlight') : t('git.commit.highlightLineage')}
              onClick={() => {
                onToggleHighlightLineage?.(isLineageHighlighted ? [] : topology.commitsIncluded)
              }}
            >
              <span>
                {topology.commitsIncluded.length} {t('git.commit.commitsCount')}
              </span>
              <span className="opacity-75">{isLineageHighlighted ? '✕' : '👁'}</span>
            </button>
          ) : null}
        </div>
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
            changedFiles.length === 0 ? (
              <EmptyState
                density="compact"
                className="px-3 py-8"
                title={isWorktree ? t('git.commit.cleanWorktree') : t('git.commit.noChanges')}
                message={isWorktree ? t('git.commit.cleanWorktreeMsg') : t('git.commit.noChangesMsg')}
              />
            ) : (
              <div role="list" aria-label={t('git.commit.pathListAria')}>
                <PathRows groups={pathGroups} selected={selectedPath} onSelect={onSelect} />
              </div>
            )
          ) : view === 'all' ? (
            allTree.length === 0 ? (
              <EmptyState
                density="compact"
                className="px-3 py-8"
                title={isWorktree ? t('git.commit.cleanWorktree') : t('git.commit.noFiles')}
                message={isWorktree ? t('git.commit.cleanWorktreeMsg') : t('git.commit.noFilesMsg')}
              />
            ) : (
              <div role="tree" aria-label={t('git.commit.allFilesAria')}>
                <TreeRows nodes={allTree} depth={0} open={openPaths} selected={selectedPath} onToggle={toggleFolder} onSetOpen={setFolderOpen} onSelect={onSelect} />
              </div>
            )
          ) : changedFiles.length === 0 ? (
            <EmptyState
              density="compact"
              className="px-3 py-8"
              title={isWorktree ? t('git.commit.cleanWorktree') : t('git.commit.noChanges')}
              message={isWorktree ? t('git.commit.cleanWorktreeMsg') : t('git.commit.noChangesMsg')}
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
