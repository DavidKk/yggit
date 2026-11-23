'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuArchive,
  LuBot,
  LuChevronDown,
  LuChevronRight,
  LuChevronsDownUp,
  LuChevronsUpDown,
  LuColumns2,
  LuCopy,
  LuCrosshair,
  LuFileClock,
  LuFileCode,
  LuFilePlus,
  LuFileText,
  LuFingerprint,
  LuFolderOpen,
  LuFolderTree,
  LuGitCommitHorizontal,
  LuHistory,
  LuList,
  LuPanelsTopLeft,
  LuPencil,
  LuRows2,
  LuSettings,
  LuSparkles,
  LuTriangleAlert,
  LuUndo2,
  LuX,
} from 'react-icons/lu'
import { TbFileStack } from 'react-icons/tb'
import { TiMinusOutline, TiPlusOutline } from 'react-icons/ti'

import { useOptionalConfirm } from '@/components/confirm/ConfirmProvider'
import { GitSearchDropdown } from '@/components/git/GitSearchDropdown'
import { FloatingMenu, type FloatingMenuItem } from '@/components/git/RefChipsCell'
import { handleTreeExpandKey, handleTreeParentKey } from '@/components/git/treeExpandKey'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, EmptyState, Spinner, TextInput, Tooltip, VirtualList } from '@/components/sk'
import { quoteFileToAgent, quoteFolderToAgent } from '@/lib/agent/agent-quote'
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
  onOpenFileHistory?: (path: string) => void
  onOpenFileBlame?: (path: string) => void
  onFilesLoaded?: (files: GitFileChange[]) => void
  onClose: () => void
  onRefresh?: () => Promise<void> | void
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
type WorktreeLayout = 'split' | 'unified'

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

function fileStateMark(
  file: GitFileChange | undefined,
  t: TFn
): { label: string; className: string; Icon: typeof TiPlusOutline | typeof LuPencil | typeof LuTriangleAlert; kind: ChangeKind } | null {
  if (!file) return null
  const status = file.status || ''
  const isStaged = Boolean(file.staged)
  const isConflict = Boolean(file.conflict || status === 'C')

  if (isConflict) {
    return {
      label: t('git.operations.conflictBadge') || '冲突',
      className: 'text-fail animate-pulse',
      Icon: LuTriangleAlert,
      kind: 'edit',
    }
  }
  if (status === 'A' || status === '?' || status === 'U') {
    return {
      label: isStaged ? t('git.operations.stagedBadge') || '已暂存' : t('git.status.add') || '新增',
      className: isStaged ? 'text-accent font-semibold' : 'text-ok',
      Icon: TiPlusOutline,
      kind: 'add',
    }
  }
  if (status === 'D') {
    return {
      label: isStaged ? t('git.operations.stagedBadge') || '已暂存' : t('git.status.delete') || '删除',
      className: isStaged ? 'text-accent font-semibold' : 'text-fail',
      Icon: TiMinusOutline,
      kind: 'del',
    }
  }
  return {
    label: isStaged ? t('git.operations.stagedBadge') || '已暂存' : status === 'R' ? t('git.status.rename') : t('git.status.modify'),
    className: isStaged ? 'text-accent font-semibold' : 'text-warn',
    Icon: LuPencil,
    kind: 'edit',
  }
}

function buildTree(files: GitFileChange[]): TreeNode[] {
  const root: TreeNode[] = []
  const directories = new Map<TreeNode[], Map<string, TreeNode>>()
  for (const file of files) {
    if (!file.path || file.path.endsWith('/')) continue
    const parts = file.path.split('/').filter(Boolean)
    if (parts.length === 0) continue
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
    if (!file.path || file.path.endsWith('/')) continue
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

function getAncestorPaths(filePath: string): string[] {
  if (!filePath) return []
  const parts = filePath.split('/').filter(Boolean)
  const ancestors: string[] = []
  let current = ''
  for (let i = 0; i < parts.length - 1; i++) {
    current = current ? `${current}/${parts[i]}` : parts[i]
    ancestors.push(current)
  }
  return ancestors
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
  isWorktree = false,
  isStagedSection,
  onStage,
  onUnstage,
  onDiscard,
  isSearching = false,
  recursive = true,
  repo: _repo,
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
  isWorktree?: boolean
  isStagedSection?: boolean
  onStage?: (path: string) => void
  onUnstage?: (path: string) => void
  onDiscard?: (path: string) => void
  isSearching?: boolean
  recursive?: boolean
  repo?: string
}) {
  const t = useT()
  return nodes.map((node) => {
    const folder = node.children.length > 0
    const expanded = folder && (isSearching || open.has(node.path))
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
          {recursive && expanded && node.children.length > 0 && (
            <TreeRows
              nodes={node.children}
              depth={depth + 1}
              open={open}
              selected={selected}
              conflictCounts={conflictCounts}
              onToggle={onToggle}
              onSetOpen={onSetOpen}
              onSelect={onSelect}
              parentId={node.path}
              counts={counts}
              onFileContextMenu={onFileContextMenu}
              onFolderContextMenu={onFolderContextMenu}
              isWorktree={isWorktree}
              isStagedSection={isStagedSection}
              onStage={onStage}
              onUnstage={onUnstage}
              onDiscard={onDiscard}
              isSearching={isSearching}
              recursive={recursive}
              repo={_repo}
            />
          )}
        </div>
      )
    }
    const mark = node.file ? fileStateMark(node.file, t) : null
    const active = selected === node.path
    const status = node.file?.status || ''
    const file = node.file

    return (
      <div
        key={node.path}
        data-git-file-path={node.path}
        className={cn(
          'group/filerow flex h-7 w-full items-center justify-between pr-1.5 rounded-none text-xs transition-colors',
          active ? 'bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-ink' : 'hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] text-ink'
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          type="button"
          aria-pressed={active}
          aria-label={mark ? `${mark.label} ${node.name}` : node.name}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 overflow-hidden text-left bg-transparent border-0 py-1 outline-none text-ink"
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
          {isWorktree && file && isStagedSection === undefined && (
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none font-medium',
                file.staged
                  ? 'bg-accent/15 text-accent border border-accent/30 font-semibold'
                  : file.conflict
                    ? 'bg-fail/15 text-fail border border-fail/30 font-semibold'
                    : 'bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] text-ink-soft'
              )}
            >
              {file.staged
                ? t('git.operations.stagedBadge') || '已暂存'
                : file.conflict
                  ? t('git.operations.conflictBadge') || '冲突'
                  : t('git.operations.unstagedBadge') || '未暂存'}
            </span>
          )}
          <ConflictMark count={conflictCounts[node.path]} />
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <div className="flex items-center opacity-0 group-hover/filerow:opacity-100 transition-opacity">
            {isWorktree && file ? (
              <>
                {(isStagedSection === false || (isStagedSection === undefined && file.unstaged)) && onStage && (
                  <Tooltip content={t('git.operations.stageFile') || '暂存此文件'}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onStage(node.path)
                      }}
                      className="flex size-5 cursor-pointer items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-08)] hover:text-accent"
                    >
                      <TiPlusOutline className="size-3" />
                    </button>
                  </Tooltip>
                )}
                {(isStagedSection === true || (isStagedSection === undefined && file.staged)) && onUnstage && (
                  <Tooltip content={t('git.operations.unstageFile') || '取消暂存'}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onUnstage(node.path)
                      }}
                      className="flex size-5 cursor-pointer items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-08)] hover:text-warn"
                    >
                      <TiMinusOutline className="size-3" />
                    </button>
                  </Tooltip>
                )}
                {onDiscard && (
                  <Tooltip content={t('git.operations.discardFile') || '放弃更改'}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDiscard(node.path)
                      }}
                      className="flex size-5 cursor-pointer items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-08)] hover:text-fail"
                    >
                      <LuUndo2 className="size-3" />
                    </button>
                  </Tooltip>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
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
  isWorktree = false,
  isStagedSection,
  onStage,
  onUnstage,
  onDiscard,
  repo: _repo,
}: {
  groups: PathGroup[]
  headerOnly?: boolean
  fileOnly?: boolean
  selected: string
  conflictCounts: ConflictCounts
  onSelect: (path: string, status: string) => void
  onFileContextMenu?: (event: React.MouseEvent, path: string, name: string, status: string) => void
  onFolderContextMenu?: (event: React.MouseEvent, path: string, name: string) => void
  isWorktree?: boolean
  isStagedSection?: boolean
  onStage?: (path: string) => void
  onUnstage?: (path: string) => void
  onDiscard?: (path: string) => void
  repo?: string
}) {
  const t = useT()
  return groups.map((group) => (
    <div key={group.dir || '.'} className="min-h-7">
      {!fileOnly && (
        <div
          className="group/folderrow m-0 flex items-center justify-between whitespace-nowrap px-2 py-1 text-[11px] font-medium text-ink cursor-default"
          title={group.dir || '/'}
          onContextMenu={(event) => {
            event.preventDefault()
            onFolderContextMenu?.(event, group.dir || '.', group.dir || '/')
          }}
        >
          <div className="flex items-center min-w-0">
            <span className="min-w-0 truncate">{group.dir || '/'}</span>
            <CountMarks counts={tally({ name: '', path: '', children: group.files.map((file) => ({ name: file.path, path: file.path, file, children: [] })) }, conflictCounts)} />
          </div>
        </div>
      )}
      {!headerOnly &&
        group.files.map((file) => {
          const mark = fileStateMark(file, t)
          const name = fileName(file.path)
          const active = selected === file.path
          return (
            <div
              key={file.path}
              data-git-file-path={file.path}
              className={cn(
                'group/filerow flex h-7 w-full items-center justify-between px-2 rounded-none text-xs transition-colors',
                active ? 'bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-ink' : 'hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] text-ink'
              )}
            >
              <button
                type="button"
                aria-pressed={active}
                aria-label={mark ? `${mark.label} ${file.path}` : file.path}
                title={file.path}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 overflow-hidden text-left bg-transparent border-0 py-1 outline-none text-ink"
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
                {isWorktree && isStagedSection === undefined && (
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none font-medium',
                      file.staged
                        ? 'bg-accent/15 text-accent border border-accent/30 font-semibold'
                        : file.conflict
                          ? 'bg-fail/15 text-fail border border-fail/30 font-semibold'
                          : 'bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] text-ink-soft'
                    )}
                  >
                    {file.staged
                      ? t('git.operations.stagedBadge') || '已暂存'
                      : file.conflict
                        ? t('git.operations.conflictBadge') || '冲突'
                        : t('git.operations.unstagedBadge') || '未暂存'}
                  </span>
                )}
                <ConflictMark count={conflictCounts[file.path]} />
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <div className="flex items-center opacity-0 group-hover/filerow:opacity-100 transition-opacity">
                  {isWorktree ? (
                    <>
                      {(isStagedSection === false || (isStagedSection === undefined && file.unstaged)) && onStage && (
                        <Tooltip content={t('git.operations.stageFile') || '暂存此文件'}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onStage(file.path)
                            }}
                            className="flex size-5 cursor-pointer items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-08)] hover:text-accent"
                          >
                            <TiPlusOutline className="size-3" />
                          </button>
                        </Tooltip>
                      )}
                      {(isStagedSection === true || (isStagedSection === undefined && file.staged)) && onUnstage && (
                        <Tooltip content={t('git.operations.unstageFile') || '取消暂存'}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onUnstage(file.path)
                            }}
                            className="flex size-5 cursor-pointer items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-08)] hover:text-warn"
                          >
                            <TiMinusOutline className="size-3" />
                          </button>
                        </Tooltip>
                      )}
                      {onDiscard && (
                        <Tooltip content={t('git.operations.discardFile') || '放弃更改'}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDiscard(file.path)
                            }}
                            className="flex size-5 cursor-pointer items-center justify-center rounded text-ink-soft hover:bg-[var(--overlay-08)] hover:text-fail"
                          >
                            <LuUndo2 className="size-3" />
                          </button>
                        </Tooltip>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
    </div>
  ))
}

export function GitCommitPanel({
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
  onClose,
  onRefresh,
}: Props) {
  const t = useT()
  const notify = useNotification()
  const optionalConfirm = useOptionalConfirm()
  const confirm = optionalConfirm ?? (() => Promise.resolve(true))
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
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<{ x: number; y: number } | null>(null)
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
          setError(t('git.errors.readChanges'))
          return
        }
        setChanges(body)
        onFilesLoaded?.(body.files || [])
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
        if (!cancelled) setError(err instanceof Error ? err.message : t('git.errors.readTree'))
      })
    return () => {
      cancelled = true
    }
  }, [view, allFiles, changes, repo, commit.hash, t])

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

  const reloadDiff = useCallback(async () => {
    try {
      const driver = getGitDriver()
      const body = await driver.readCommitDiff({ repo, hash: commit.hash, tree: true })
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
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void reloadDiff()
      }, 150)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [isWorktree, reloadDiff])

  const handleStage = async (filePath: string) => {
    try {
      const driver = getGitDriver()
      await driver.stage(repo, [filePath])
      notify.success((t('git.operations.stageFile') || '已暂存 {file}').replace('{file}', filePath))
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('git.operations.stageSuccess') || '暂存失败')
    }
  }

  const handleUnstage = async (filePath: string) => {
    try {
      const driver = getGitDriver()
      await driver.unstage(repo, [filePath])
      notify.success((t('git.operations.unstageFile') || '已取消暂存 {file}').replace('{file}', filePath))
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('git.operations.unstageSuccess') || '取消暂存失败')
    }
  }

  const handleDiscard = async (filePath: string) => {
    const ok = await confirm({
      title: t('git.operations.discardFile') || '放弃更改',
      description: (t('git.operations.discardConfirm') || '确定放弃 {file} 的所有更改吗？此操作无法撤销。').replace('{file}', filePath),
      confirmLabel: t('git.operations.discardFile') || '确定放弃',
      confirmVariant: 'fail',
    })
    if (!ok) return
    try {
      const driver = getGitDriver()
      await driver.discard(repo, [filePath])
      notify.success((t('git.operations.discardSuccess') || '已放弃更改 {file}').replace('{file}', filePath))
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('git.operations.discardFile') || '放弃更改失败')
    }
  }

  const handleStageAll = async () => {
    try {
      const driver = getGitDriver()
      await driver.stage(repo, [], true)
      notify.success(t('git.operations.stageSuccess') || '已暂存全部更改')
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('git.operations.stageSuccess') || '暂存全部失败')
    }
  }

  const handleUnstageAll = async () => {
    try {
      const driver = getGitDriver()
      await driver.unstage(repo, [], true)
      notify.success(t('git.operations.unstageSuccess') || '已取消暂存全部更改')
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('git.operations.unstageSuccess') || '取消暂存全部失败')
    }
  }

  const handleCommitSubmit = async () => {
    const trimmed = commitSummary.trim()
    if (!trimmed) {
      notify.error(t('git.operations.commitPlaceholder') || '请输入提交说明')
      return
    }
    const fullMessage = commitDesc.trim() ? `${trimmed}\n\n${commitDesc.trim()}` : trimmed
    setIsCommitting(true)
    try {
      const driver = getGitDriver()
      const stageAll = stagedFiles.length === 0 && unstagedFiles.length > 0
      const res = await driver.commit(repo, fullMessage, {
        stageAll,
        amend: amendCommit,
        noVerify: skipGitHooks,
        pushAfter: pushAfterCommit,
      })
      notify.success(res.message || t('git.operations.commitSuccess') || '提交成功！')
      setCommitSummary('')
      setCommitDesc('')
      setAmendCommit(false)
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : '提交失败')
    } finally {
      setIsCommitting(false)
    }
  }

  const handleStashSubmit = async () => {
    const trimmedTitle = stashTitle.trim()
    const fullMessage = stashDesc.trim() ? (trimmedTitle ? `${trimmedTitle}\n\n${stashDesc.trim()}` : stashDesc.trim()) : trimmedTitle
    setIsStashing(true)
    try {
      const driver = getGitDriver()
      const res = await driver.stash(repo, { action: 'save', message: fullMessage || undefined })
      notify.success(res.message || t('git.operations.stashSuccess') || '已暂存工作区更改 (Stash)')
      setStashTitle('')
      setStashDesc('')
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : '暂存失败')
    } finally {
      setIsStashing(false)
    }
  }

  const handleCreatePatch = async (pathTarget?: string) => {
    try {
      const driver = getGitDriver()
      const res = await driver.createPatch(repo, { path: pathTarget })
      if (!res.patch) {
        notify.info('没有可导出的补丁差异')
        return
      }
      await navigator.clipboard.writeText(res.patch)
      notify.success(`已复制补丁代码 (${res.patch.split('\n').length} 行) 到剪贴板`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : '生成补丁失败')
    }
  }

  const handleIgnore = async (pattern: string) => {
    try {
      const driver = getGitDriver()
      const res = await driver.ignorePattern(repo, pattern)
      notify.success(res.message || `已将 ${pattern} 加入 .gitignore`)
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : '添加到 .gitignore 失败')
    }
  }

  const handleCreateFileSubmit = async () => {
    if (!newFileDialog?.fileName.trim()) return
    const relativePath =
      newFileDialog.folderPath === '.' || !newFileDialog.folderPath
        ? newFileDialog.fileName.trim()
        : `${newFileDialog.folderPath.replace(/\/+$/, '')}/${newFileDialog.fileName.trim()}`
    try {
      const driver = getGitDriver()
      const res = await driver.createFile(repo, relativePath)
      notify.success(res.message || `已创建文件 ${relativePath}`)
      setNewFileDialog(null)
      await reloadDiff()
      onSelect(relativePath, 'A')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : '创建文件失败')
    }
  }

  // AI commit message composer
  const handleAiCompose = () => {
    const list = stagedFiles.length > 0 ? stagedFiles : unstagedFiles
    if (list.length === 0) {
      notify.info('当前工作区无修改，无需生成提交信息')
      return
    }
    const names = list.slice(0, 3).map((f) => fileName(f.path))
    const extra = list.length > 3 ? ` 等 ${list.length} 个文件` : ''
    setCommitSummary(`feat(workspace): 更新 ${names.join(', ')}${extra}`)
    setCommitDesc(`包含以下文件更改:\n${list.map((f) => `- ${f.path} (${f.status})`).join('\n')}`)
    notify.success('已自动生成提交摘要')
  }

  // File Context Menu (Matching Image 2)
  const handleFileContextMenu = (e: React.MouseEvent, filePath: string, name: string, status: string) => {
    const targetFile = isWorktree ? changedFiles.find((f) => f.path === filePath) : null
    const ext = name.includes('.') ? name.split('.').pop() : ''

    const items: FloatingMenuItem[] = []

    if (isWorktree && targetFile) {
      if (targetFile.unstaged) {
        items.push({
          key: 'stage-file',
          label: 'Stage',
          icon: <TiPlusOutline className="size-3.5 text-accent" />,
          onSelect: () => void handleStage(filePath),
        })
      }
      if (targetFile.staged) {
        items.push({
          key: 'unstage-file',
          label: 'Unstage',
          icon: <TiMinusOutline className="size-3.5 text-warn" />,
          onSelect: () => void handleUnstage(filePath),
        })
      }
      items.push({
        key: 'discard-file',
        label: 'Discard changes',
        icon: <LuUndo2 className="size-3.5 text-fail" />,
        danger: true,
        onSelect: () => void handleDiscard(filePath),
      })
      items.push({
        key: 'ignore-file',
        label: `Ignore '${name}'`,
        icon: <LuFileText className="size-3.5 text-ink-soft" />,
        onSelect: () => void handleIgnore(filePath),
      })
      if (ext) {
        items.push({
          key: 'ignore-ext',
          label: `Ignore all '*.${ext}' files`,
          icon: <LuFileCode className="size-3.5 text-ink-soft" />,
          onSelect: () => void handleIgnore(`*.${ext}`),
        })
      }
      items.push({
        key: 'stash-file',
        label: 'Stash file',
        icon: <LuArchive className="size-3.5 text-accent" />,
        onSelect: async () => {
          try {
            const driver = getGitDriver()
            await driver.stash(repo, { action: 'save', message: `Stash ${name}`, paths: [filePath] })
            notify.success(`已暂存文件 ${name}`)
            await reloadDiff()
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : '暂存文件失败')
          }
        },
      })
    }

    // File history & blame available whenever file is tracked (or viewing commit)
    if (!isWorktree || status !== '?') {
      items.push(
        {
          key: 'file-history',
          label: t('git.operations.fileHistory') || 'File History',
          icon: <LuFileClock className="size-3.5 text-accent" />,
          dividerBefore: isWorktree,
          onSelect: () => (onOpenFileHistory ? onOpenFileHistory(filePath) : onSelect(filePath, status || 'M')),
        },
        {
          key: 'file-blame',
          label: t('git.operations.fileBlame') || 'File Blame',
          icon: <LuFingerprint className="size-3.5 text-accent" />,
          onSelect: () => (onOpenFileBlame ? onOpenFileBlame(filePath) : onSelect(filePath, status || 'M')),
        }
      )
    }

    // Quote file to Git Agent
    items.push({
      key: 'quote-file-agent',
      label: t('git.operations.quoteFileToAgent') || '引用文件到 Git Agent',
      icon: <LuBot className="size-3.5 text-accent" />,
      shortcut: '⌥Q',
      dividerBefore: true,
      onSelect: () => quoteFileToAgent(filePath, status, repo),
    })

    // Copy file path is universally available
    items.push({
      key: 'copy-relative',
      label: t('git.operations.copyFilePath') || 'Copy file path',
      icon: <LuCopy className="size-3.5 text-ink-soft" />,
      dividerBefore: true,
      onSelect: () => void navigator.clipboard?.writeText(filePath),
    })

    if (!isWorktree) {
      items.push({
        key: 'restore-file',
        label: t('git.operations.restoreFileFromCommit') || 'Restore file from this commit',
        icon: <LuUndo2 className="size-3.5 text-warn" />,
        dividerBefore: true,
        onSelect: async () => {
          if (!repo || !commit?.hash) return
          try {
            const driver = getGitDriver()
            await driver.restoreFile?.(repo, commit.hash, filePath)
            notify.success(
              t('git.operations.restoreFileSuccess', { hash: commit.short || commit.hash.slice(0, 7), path: filePath }) ||
                `已从提交 ${commit.short || commit.hash.slice(0, 7)} 恢复文件 ${filePath}`
            )
            await reloadDiff()
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : t('git.operations.restoreFileFail') || '恢复文件失败')
          }
        },
      })
    }

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: name,
      items,
    })
  }

  // Folder Context Menu (Matching Image 1)
  const handleFolderContextMenu = (e: React.MouseEvent, folderPath: string, folderName: string) => {
    const absPath = repo ? `${repo.replace(/\/+$/, '')}/${folderPath}` : folderPath
    const isOpen = openPaths.has(folderPath)

    const items: FloatingMenuItem[] = []

    if (isWorktree) {
      items.push({
        key: 'stage-folder',
        label: t('git.operations.stageFolder') || 'Stage folder',
        icon: <TiPlusOutline className="size-3.5 text-accent" />,
        onSelect: () => void handleStage(folderPath),
      })
      items.push({
        key: 'discard-folder',
        label: t('git.operations.discardFolder') || 'Discard all changes in folder',
        icon: <LuUndo2 className="size-3.5 text-fail" />,
        danger: true,
        onSelect: () => void handleDiscard(folderPath),
      })
      items.push({
        key: 'ignore-folder',
        label: t('git.operations.ignoreFolder', { folder: folderName }) || `Ignore all files in '${folderName}/'`,
        icon: <LuFileText className="size-3.5 text-ink-soft" />,
        onSelect: () => void handleIgnore(folderPath.endsWith('/') ? folderPath : `${folderPath}/`),
      })
      items.push({
        key: 'stash-folder',
        label: t('git.operations.stashFolder') || 'Stash folder',
        icon: <LuArchive className="size-3.5 text-accent" />,
        onSelect: async () => {
          try {
            const driver = getGitDriver()
            await driver.stash(repo, { action: 'save', message: `Stash folder ${folderName}`, paths: [folderPath] })
            notify.success(t('git.operations.stashSuccess') || `已暂存文件夹 ${folderName}`)
            await reloadDiff()
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : '暂存文件夹失败')
          }
        },
      })
      items.push({
        key: 'create-patch-folder',
        label: t('git.operations.createPatchFolder') || 'Create Patch from changes in directory',
        icon: <LuFileText className="size-3.5 text-accent" />,
        onSelect: () => void handleCreatePatch(folderPath),
      })
      items.push({
        key: 'open-folder',
        label: t('git.operations.openFolder') || 'Open folder',
        icon: <LuFolderOpen className="size-3.5 text-accent" />,
        dividerBefore: true,
        onSelect: async () => {
          try {
            await fetch('/api/reveal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: absPath, reveal: false }),
            })
          } catch {
            toggleFolder(folderPath)
          }
        },
      })
      items.push({
        key: 'create-file-in-folder',
        label: t('git.operations.createFileInFolder') || 'Create a file in this folder',
        icon: <LuFilePlus className="size-3.5 text-ok" />,
        onSelect: () => {
          setNewFileDialog({ folderPath, fileName: '' })
        },
      })
      items.push({
        key: 'copy-folder-path',
        label: t('git.operations.copyFolderPath') || 'Copy folder path',
        icon: <LuCopy className="size-3.5" />,
        dividerBefore: true,
        onSelect: () => void navigator.clipboard?.writeText(folderPath),
      })
      items.push({
        key: 'toggle-folder',
        label: isOpen ? t('git.operations.collapseFolder') || 'Collapse folder' : t('git.operations.expandFolder') || 'Expand folder',
        icon: isOpen ? <LuChevronDown className="size-3.5" /> : <LuChevronRight className="size-3.5" />,
        onSelect: () => toggleFolder(folderPath),
      })
    } else {
      items.push(
        {
          key: 'open-folder',
          label: t('git.operations.openFolder') || 'Open folder',
          icon: <LuFolderOpen className="size-3.5 text-accent" />,
          onSelect: async () => {
            try {
              await fetch('/api/reveal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: absPath, reveal: false }),
              })
            } catch {
              toggleFolder(folderPath)
            }
          },
        },
        {
          key: 'create-file-in-folder',
          label: t('git.operations.createFileInFolder') || 'Create a file in this folder',
          icon: <LuFilePlus className="size-3.5 text-ok" />,
          onSelect: () => {
            setNewFileDialog({ folderPath, fileName: '' })
          },
        }
      )
    }

    // Quote folder to Git Agent
    items.push({
      key: 'quote-folder-agent',
      label: t('git.operations.quoteFolderToAgent') || '引用目录到 Git Agent',
      icon: <LuBot className="size-3.5 text-accent" />,
      shortcut: '⌥Q',
      dividerBefore: true,
      onSelect: () => quoteFolderToAgent(folderPath, repo),
    })

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: folderName,
      items,
    })
  }

  // Render a section's file tree/path list
  const renderFileList = (files: GitFileChange[], isStagedSection?: boolean) => {
    if (files.length === 0) {
      return (
        <div className="flex h-20 items-center justify-center p-3 text-center text-xs text-ink-soft/70">
          {isStagedSection ? t('git.operations.noStagedFiles') || '暂无已暂存文件 (可在下方选择文件暂存)' : t('git.operations.workingTreeClean') || '工作区干净，无未暂存修改'}
        </div>
      )
    }

    if (view === 'path') {
      const groups = groupByPath(files)
      return (
        <PathRows
          groups={groups}
          selected={selectedPath}
          conflictCounts={conflictCounts}
          onSelect={onSelect}
          onFileContextMenu={handleFileContextMenu}
          onFolderContextMenu={handleFolderContextMenu}
          isWorktree={isWorktree}
          isStagedSection={isStagedSection}
          onStage={handleStage}
          onUnstage={handleUnstage}
          onDiscard={handleDiscard}
          repo={repo}
        />
      )
    }

    const tree = buildTree(files)
    return (
      <TreeRows
        nodes={tree}
        depth={0}
        open={openPaths}
        selected={selectedPath}
        conflictCounts={conflictCounts}
        onToggle={toggleFolder}
        onSetOpen={setFolderOpen}
        onSelect={onSelect}
        onFileContextMenu={handleFileContextMenu}
        onFolderContextMenu={handleFolderContextMenu}
        isWorktree={isWorktree}
        isStagedSection={isStagedSection}
        onStage={handleStage}
        onUnstage={handleUnstage}
        onDiscard={handleDiscard}
        isSearching={isSearching}
        repo={repo}
      />
    )
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
      {/* Single Clean Top Header */}
      <header className="grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 border-b border-line px-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="m-0 shrink-0 whitespace-nowrap text-xs font-semibold text-ink">{panelTitle}</h2>
          {changes ? (
            <Badge tone="neutral" size="mini" dot={false}>
              {badgeCount}
            </Badge>
          ) : null}
        </div>
        <div className="flex h-8 items-center justify-end gap-1 [&_button]:size-6">
          {selectedPath && (
            <Tooltip content={t('git.operations.locateCurrentFile') || '定位到当前选中文件'} placement="bottom">
              <Button
                variant="plain"
                size="icon"
                className="size-6 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-accent"
                aria-label={t('git.operations.locateCurrentFile') || '定位到当前选中文件'}
                onClick={handleFocusSelectedFile}
              >
                <LuCrosshair className="size-3.5" />
              </Button>
            </Tooltip>
          )}

          {/* Main search dropdown for unified mode */}
          {(!isWorktree || worktreeLayout === 'unified') && (
            <GitSearchDropdown
              className="mr-0 size-6"
              label={t('git.project.searchProjects') || '搜索文件'}
              description={t('git.commit.allFiles') || '按名称或路径快速过滤'}
              placeholder={`${t('git.commit.allFiles') || '搜索文件'}…`}
              value={fileQuery}
              onChange={setFileQuery}
            />
          )}

          {/* Toggle between Split and Unified view mode */}
          {isWorktree && (
            <Tooltip
              content={worktreeLayout === 'split' ? t('git.operations.switchToUnifiedView') || '切换为统一标记列表' : t('git.operations.switchToSplitView') || '切换为上下暂存分栏'}
            >
              <Button
                variant="plain"
                size="icon"
                className="size-6 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-ink"
                aria-label={
                  worktreeLayout === 'split' ? t('git.operations.switchToUnifiedView') || '切换为统一标记列表' : t('git.operations.switchToSplitView') || '切换为上下暂存分栏'
                }
                onClick={() => handleToggleLayout(worktreeLayout === 'split' ? 'unified' : 'split')}
              >
                {worktreeLayout === 'split' ? <LuRows2 className="size-3.5 text-accent" /> : <LuColumns2 className="size-3.5" />}
              </Button>
            </Tooltip>
          )}

          {/* View switcher dropdown */}
          <Button
            variant="plain"
            size="icon"
            className="size-6 text-ink-soft hover:enabled:bg-[var(--overlay-08)]"
            aria-label={t('git.commit.fileViewsAria') || '视图与展开选项'}
            tooltip={t('git.commit.fileViewsAria') || '视图与展开选项'}
            onClick={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              setMoreMenuAnchor((prev) => (prev ? null : { x: rect.right, y: rect.bottom + 4 }))
            }}
          >
            <LuPanelsTopLeft className="size-3.5" aria-hidden="true" />
          </Button>

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

      {/* View Options Menu */}
      {moreMenuAnchor ? (
        <FloatingMenu
          anchor={moreMenuAnchor}
          ariaLabel={t('git.commit.fileViewsAria') || '视图与展开选项'}
          color="var(--accent)"
          onClose={() => setMoreMenuAnchor(null)}
          items={[
            {
              key: 'view-tree',
              label: t('git.commit.treeView') || '树状层级视图',
              icon: <LuFolderTree className="size-3.5 text-accent" />,
              checked: view === 'tree',
              group: t('git.commit.fileViewsAria') || '视图',
              onSelect: () => setView('tree'),
            },
            {
              key: 'view-path',
              label: t('git.commit.pathView') || '平铺路径列表',
              icon: <LuList className="size-3.5 text-accent" />,
              checked: view === 'path',
              group: t('git.commit.fileViewsAria') || '视图',
              onSelect: () => setView('path'),
            },
            ...(!isWorktree
              ? [
                  {
                    key: 'view-all',
                    label: t('git.commit.allFiles') || '全部仓库文件',
                    icon: <TbFileStack className="size-3.5 text-accent" />,
                    checked: view === 'all',
                    group: t('git.commit.fileViewsAria') || '视图',
                    onSelect: () => setView('all'),
                  },
                ]
              : []),
            ...(conflictFileCount > 0
              ? [
                  {
                    key: 'conflicts-only',
                    label: t('git.commit.conflictsOnly') || '仅显示冲突文件',
                    icon: <LuTriangleAlert className="size-3.5 text-warn" />,
                    checked: filterConflicts,
                    group: t('git.commit.conflictsOnly') || '过滤',
                    onSelect: () => setConflictsOnly((value) => !value),
                  },
                ]
              : []),
          ]}
        />
      ) : null}

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
        /* Split Mode: Unstaged Upper Panel & Staged Lower Panel (unstaged on top) */
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {/* Top Panel: Unstaged Changes */}
          <section className={cn('flex flex-col overflow-hidden border-b border-line transition-all', openUnstaged ? 'flex-1 min-h-[100px]' : 'shrink-0')}>
            <div
              className={cn(
                'flex h-8 shrink-0 items-center justify-between bg-panel-2/60 px-2 text-xs select-none cursor-pointer hover:bg-panel-2/80 transition-colors',
                openUnstaged && 'border-b border-line'
              )}
              onClick={() => setOpenUnstaged((v) => !v)}
            >
              <button
                type="button"
                data-section-toggle="unstaged"
                className="flex h-full flex-1 items-center gap-1.5 min-w-0 font-medium text-ink cursor-pointer bg-transparent border-0 p-0 text-left outline-none"
                aria-expanded={openUnstaged}
              >
                {openUnstaged ? <LuChevronDown className="size-3.5 text-ink-soft shrink-0" /> : <LuChevronRight className="size-3.5 text-ink-soft shrink-0" />}
                <span className="truncate uppercase tracking-wider text-[11px]">{t('git.operations.unstagedFiles') || 'UNSTAGED CHANGES'}</span>
                <Badge tone="neutral" size="mini" dot={false}>
                  {unstagedFiles.length}
                </Badge>
              </button>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <GitSearchDropdown
                  className="size-6 mr-0"
                  label={t('git.operations.unstagedFiles') || '未暂存更改'}
                  description={t('git.operations.unstagedFiles') || '快速筛选未暂存文件'}
                  placeholder={`${t('git.operations.unstagedFiles') || '未暂存更改'}…`}
                  value={unstagedQuery}
                  onChange={setUnstagedQuery}
                />
                {unstagedFiles.length > 0 && (
                  <Tooltip content={t('git.operations.stageAll') || '暂存全部'}>
                    <Button
                      variant="plain"
                      size="icon"
                      className="size-6 text-accent hover:enabled:bg-accent/10 hover:enabled:text-accent"
                      aria-label={t('git.operations.stageAll') || '暂存全部'}
                      onClick={() => void handleStageAll()}
                    >
                      <TiPlusOutline className="size-3.5" />
                    </Button>
                  </Tooltip>
                )}
              </div>
            </div>

            {openUnstaged && (
              <div
                className="flex-1 overflow-y-auto"
                aria-label={t(view === 'path' ? 'git.commit.pathListAria' : view === 'all' ? 'git.commit.allFilesAria' : 'git.commit.treeAria')}
              >
                {renderFileList(filteredUnstagedFiles, false)}
              </div>
            )}
          </section>

          {/* Bottom Panel: Staged Changes */}
          <section className={cn('flex flex-col overflow-hidden transition-all', openStaged ? 'flex-1 min-h-[100px]' : 'shrink-0')}>
            <div
              className={cn(
                'flex h-8 shrink-0 items-center justify-between bg-panel-2/60 px-2 text-xs select-none cursor-pointer hover:bg-panel-2/80 transition-colors',
                openStaged && 'border-b border-line'
              )}
              onClick={() => setOpenStaged((v) => !v)}
            >
              <button
                type="button"
                data-section-toggle="staged"
                className="flex h-full flex-1 items-center gap-1.5 min-w-0 font-medium text-ink cursor-pointer bg-transparent border-0 p-0 text-left outline-none"
                aria-expanded={openStaged}
              >
                {openStaged ? <LuChevronDown className="size-3.5 text-ink-soft shrink-0" /> : <LuChevronRight className="size-3.5 text-ink-soft shrink-0" />}
                <span className="truncate uppercase tracking-wider text-[11px]">{t('git.operations.stagedFiles') || 'STAGED CHANGES'}</span>
                <Badge tone="accent" size="mini" dot={false}>
                  {stagedFiles.length}
                </Badge>
              </button>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <GitSearchDropdown
                  className="size-6 mr-0"
                  label={t('git.operations.stagedFiles') || '已暂存更改'}
                  description={t('git.operations.stagedFiles') || '快速筛选已暂存文件'}
                  placeholder={`${t('git.operations.stagedFiles') || '已暂存更改'}…`}
                  value={stagedQuery}
                  onChange={setStagedQuery}
                />
                {stagedFiles.length > 0 && (
                  <Tooltip content={t('git.operations.unstageAll') || '取消暂存全部'}>
                    <Button
                      variant="plain"
                      size="icon"
                      className="size-6 text-warn hover:enabled:bg-warn/10 hover:enabled:text-warn"
                      aria-label={t('git.operations.unstageAll') || '取消暂存全部'}
                      onClick={() => void handleUnstageAll()}
                    >
                      <TiMinusOutline className="size-3.5" />
                    </Button>
                  </Tooltip>
                )}
              </div>
            </div>

            {openStaged && (
              <div
                className="flex-1 overflow-y-auto"
                aria-label={t(view === 'path' ? 'git.commit.pathListAria' : view === 'all' ? 'git.commit.allFilesAria' : 'git.commit.treeAria')}
              >
                {renderFileList(filteredStagedFiles, true)}
              </div>
            )}
          </section>
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
        <section className="shrink-0 border-t border-line bg-panel-2/70 flex flex-col">
          {/* Header with Chevron + Title, and Right Action Buttons (Stash Toggle + Settings Gear) */}
          <div
            className={cn(
              'flex h-8 shrink-0 items-center justify-between bg-panel-2/60 px-2 text-xs select-none cursor-pointer hover:bg-panel-2/80 transition-colors',
              openCommit && 'border-b border-line'
            )}
            onClick={() => setOpenCommit((v) => !v)}
          >
            {/* Left: Section Header with Chevron and Title */}
            <button
              type="button"
              data-section-toggle="commit"
              className="flex h-full flex-1 items-center gap-1.5 min-w-0 font-medium text-ink cursor-pointer bg-transparent border-0 p-0 text-left outline-none"
              aria-expanded={openCommit}
            >
              {openCommit ? <LuChevronDown className="size-3.5 text-ink-soft shrink-0" /> : <LuChevronRight className="size-3.5 text-ink-soft shrink-0" />}
              <span className="truncate uppercase tracking-wider text-[11px]">
                {bottomTab === 'stash' ? t('git.operations.tabStash') || 'STASH' : t('git.operations.tabCommit') || 'COMMIT'}
              </span>
            </button>

            {/* Right: Settings Gear Icon (if commit mode) + Stash Toggle Switch */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {bottomTab === 'commit' && (
                <Tooltip content={t('git.operations.commitOptions') || '提交配置'}>
                  <Button
                    ref={commitSettingsBtnRef}
                    variant="plain"
                    size="icon"
                    className={cn('size-6 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-ink', (pushAfterCommit || skipGitHooks) && 'text-accent')}
                    aria-label={t('git.operations.commitOptions') || '提交配置'}
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      setCommitSettingsAnchor((prev) => (prev ? null : { x: Math.max(8, rect.right - 236), y: rect.bottom + 4 }))
                    }}
                  >
                    <LuSettings className="size-3.5" />
                  </Button>
                </Tooltip>
              )}

              <Tooltip content={bottomTab === 'stash' ? t('git.operations.tabCommit') || '返回提交模式 (Commit)' : t('git.operations.tabStash') || '暂存工作区 (Stash)'}>
                <Button
                  variant="plain"
                  size="icon"
                  data-bottom-tab="stash-toggle"
                  aria-pressed={bottomTab === 'stash'}
                  aria-label={bottomTab === 'stash' ? t('git.operations.tabCommit') || 'Commit' : t('git.operations.tabStash') || 'Stash'}
                  className={cn(
                    'size-6 transition-all cursor-pointer',
                    bottomTab === 'stash'
                      ? 'bg-accent text-white shadow-xs hover:enabled:bg-accent/90 hover:enabled:text-white'
                      : 'text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-ink'
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    setBottomTab((prev) => (prev === 'stash' ? 'commit' : 'stash'))
                    if (!openCommit) setOpenCommit(true)
                  }}
                >
                  <LuArchive className="size-3.5" />
                </Button>
              </Tooltip>
            </div>
          </div>

          {/* Form Content (when expanded: integrated editor panel with single padding) */}
          {openCommit && (
            <div className="flex flex-col bg-panel p-2.5 gap-2 shadow-xs">
              {bottomTab === 'commit' ? (
                /* Commit Form */
                <div className="flex flex-col gap-1.5">
                  {/* Commit Summary */}
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={commitSummary}
                      placeholder={t('git.operations.commitPlaceholder') || 'Commit summary (required)'}
                      onChange={(e) => setCommitSummary(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault()
                          commitDescRef.current?.focus()
                        }
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          void handleCommitSubmit()
                        }
                      }}
                      className="w-full bg-transparent pr-14 text-xs font-medium text-ink placeholder:text-ink-soft/60 focus:outline-none"
                    />
                    <div className="absolute right-0 flex items-center gap-1.5">
                      <span className={cn('text-[10px] tabular-nums select-none', commitSummary.length > 72 ? 'text-warn font-semibold' : 'text-ink-soft/70')}>
                        {72 - commitSummary.length}
                      </span>
                      <Tooltip content={t('git.operations.generateCommitAiTip') || '使用 AI 自动生成提交信息'}>
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={handleAiCompose}
                          className="flex size-5 cursor-pointer items-center justify-center rounded text-ink-soft hover:bg-accent/15 hover:text-accent transition-colors"
                        >
                          <LuSparkles className="size-3" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Subtle Divider between Summary and Description */}
                  <div className="h-px w-full bg-line/60 my-0.5" />

                  {/* Commit Description */}
                  <textarea
                    ref={commitDescRef}
                    rows={3}
                    value={commitDesc}
                    placeholder={t('git.operations.commitDescPlaceholder') || 'Description (optional)'}
                    onChange={(e) => setCommitDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        void handleCommitSubmit()
                      }
                    }}
                    className="w-full resize-none bg-transparent text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none min-h-[56px]"
                  />

                  {/* Separated Commit Button & Amend Icon Button */}
                  {(() => {
                    const cannotCommit = isCommitting || (!commitSummary.trim() && !amendCommit) || (stagedFiles.length === 0 && unstagedFiles.length === 0 && !amendCommit)
                    return (
                      <div className="flex h-8 w-full items-center gap-1.5 mt-1">
                        {/* Main Commit Button */}
                        <button
                          type="button"
                          disabled={cannotCommit}
                          onClick={() => void handleCommitSubmit()}
                          className={cn(
                            'flex h-full flex-1 items-center justify-center gap-1.5 px-3 rounded-md text-xs font-medium transition-colors select-none shadow-xs border',
                            cannotCommit
                              ? 'cursor-not-allowed bg-panel-2 text-ink-soft/50 border-line/70'
                              : 'cursor-pointer bg-accent text-white border-accent hover:bg-accent/90 active:brightness-95'
                          )}
                        >
                          {isCommitting ? (
                            <>
                              <Spinner className="size-3 text-current" />
                              <span>{t('git.operations.committing') || '提交中…'}</span>
                            </>
                          ) : (
                            <>
                              <LuGitCommitHorizontal className="size-3.5" />
                              <span>
                                {amendCommit
                                  ? t('git.operations.amendCommitBtn') || 'Amend 提交'
                                  : stagedFiles.length > 0
                                    ? t('git.operations.commitBtn', { count: stagedFiles.length }) || `Commit ${stagedFiles.length} Changes`
                                    : t('git.operations.stageChangesToCommit') || 'Stage Changes to Commit'}
                              </span>
                            </>
                          )}
                        </button>

                        {/* Amend Icon Button with Tooltips */}
                        <Tooltip
                          content={
                            amendCommit ? t('git.operations.amendActiveTip') || '已启用修改上一条提交 (点击取消)' : t('git.operations.amendInactiveTip') || '修改上一条提交 (Amend)'
                          }
                        >
                          <button
                            type="button"
                            aria-label={t('git.operations.amendPrevious') || 'Amend 上次提交'}
                            disabled={isCommitting}
                            onClick={() => {
                              const next = !amendCommit
                              setAmendCommit(next)
                            }}
                            className={cn(
                              'flex h-full size-8 shrink-0 items-center justify-center rounded-md border text-xs transition-all cursor-pointer select-none shadow-xs',
                              amendCommit
                                ? 'border-accent bg-accent text-white font-semibold'
                                : 'border-line/80 bg-panel text-ink-soft hover:bg-panel-2 hover:text-ink hover:border-line'
                            )}
                          >
                            <LuHistory className="size-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                /* Stash Form */
                <div className="flex flex-col gap-1.5">
                  {/* Stash Title */}
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={stashTitle}
                      placeholder={t('git.operations.stashTitlePlaceholder') || 'Stash title'}
                      onChange={(e) => setStashTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault()
                          stashDescRef.current?.focus()
                        }
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          void handleStashSubmit()
                        }
                      }}
                      className="w-full bg-transparent pr-8 text-xs font-medium text-ink placeholder:text-ink-soft/60 focus:outline-none"
                    />
                    <div className="absolute right-0 flex items-center">
                      <Tooltip content={t('git.operations.autoFillStashTitleTip') || '自动填充暂存标题'}>
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => {
                            const date = new Date().toLocaleTimeString()
                            setStashTitle(`WIP on ${date}`)
                          }}
                          className="flex size-5 cursor-pointer items-center justify-center rounded text-ink-soft hover:bg-accent/15 hover:text-accent transition-colors"
                        >
                          <LuSparkles className="size-3" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Subtle Divider */}
                  <div className="h-px w-full bg-line/60 my-0.5" />

                  {/* Stash Description */}
                  <textarea
                    ref={stashDescRef}
                    rows={3}
                    value={stashDesc}
                    placeholder={t('git.operations.stashDescPlaceholder') || 'Description (optional)'}
                    onChange={(e) => setStashDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        void handleStashSubmit()
                      }
                    }}
                    className="w-full resize-none bg-transparent text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none min-h-[56px]"
                  />

                  {/* Big Bottom Stash Button: Primary Solid Accent */}
                  <button
                    type="button"
                    disabled={isStashing || (stagedFiles.length === 0 && unstagedFiles.length === 0)}
                    onClick={() => void handleStashSubmit()}
                    className={cn(
                      'flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-all select-none mt-1 shadow-xs',
                      isStashing || (stagedFiles.length === 0 && unstagedFiles.length === 0)
                        ? 'border-line/60 bg-panel-2 text-ink-soft/50 cursor-not-allowed'
                        : 'border-accent bg-accent text-white hover:bg-accent/90 active:brightness-95'
                    )}
                  >
                    {isStashing ? (
                      <>
                        <Spinner className="size-3 text-accent" />
                        <span>{t('git.operations.stashing') || '暂存中…'}</span>
                      </>
                    ) : (
                      <>
                        <LuArchive className="size-3.5" />
                        <span>
                          {stagedFiles.length > 0
                            ? `${t('git.operations.stageChangesToStash') || 'Stage Changes to Stash'} (${stagedFiles.length})`
                            : t('git.operations.stageChangesToStash') || 'Stage Changes to Stash'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Floating Menu for Commit Settings */}
      {commitSettingsAnchor ? (
        <FloatingMenu
          anchor={commitSettingsAnchor}
          ignoreRef={commitSettingsBtnRef}
          ariaLabel={t('git.operations.commitOptions') || '提交配置'}
          color="var(--accent)"
          onClose={() => setCommitSettingsAnchor(null)}
          items={[
            {
              key: 'push-after',
              label: t('git.operations.pushAfterCommit') || '提交后推送 (Push after committing)',
              checked: pushAfterCommit,
              onSelect: () => setPushAfterCommit((v) => !v),
            },
            {
              key: 'skip-hooks',
              label: t('git.operations.skipGitHooks') || '跳过 Git hooks (Skip Git hooks)',
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-80 rounded-lg border border-line bg-panel p-3.5 shadow-xl flex flex-col gap-2.5">
            <h3 className="m-0 text-xs font-semibold text-ink">
              {(t('git.operations.createFileInFolder') || '在 {folder} 下新建文件').replace('{folder}', newFileDialog.folderPath || '/')}
            </h3>
            <TextInput
              autoFocus
              value={newFileDialog.fileName}
              placeholder={t('git.operations.createFileInFolder') || '输入文件名 (如 index.ts)...'}
              onChange={(e) => setNewFileDialog({ ...newFileDialog, fileName: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleCreateFileSubmit()
                } else if (e.key === 'Escape') {
                  setNewFileDialog(null)
                }
              }}
            />
            <div className="flex justify-end gap-1.5 pt-1">
              <Button variant="plain" size="xs" onClick={() => setNewFileDialog(null)}>
                {t('common.cancel') || '取消'}
              </Button>
              <Button variant="accent" size="xs" disabled={!newFileDialog.fileName.trim()} onClick={() => void handleCreateFileSubmit()}>
                {t('git.project.create') || '创建文件'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
