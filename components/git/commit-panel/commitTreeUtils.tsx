'use client'

import React from 'react'
import { LuPencil, LuTriangleAlert } from 'react-icons/lu'
import { TiMinusOutline, TiPlusOutline } from 'react-icons/ti'

import { useT } from '@/components/i18n/LocaleProvider'
import type { GitFileChange } from '@/lib/git/types'

export type ConflictCounts = Record<string, number | null>
export type ChangeKind = 'add' | 'edit' | 'del'
export type FileView = 'path' | 'tree' | 'all'
export type WorktreeLayout = 'split' | 'unified'

export function isFileView(value: unknown): value is FileView {
  return value === 'path' || value === 'tree' || value === 'all'
}

export type PathGroup = { dir: string; files: GitFileChange[] }

export type TreeNode = {
  name: string
  path: string
  file?: GitFileChange
  children: TreeNode[]
}

export type ChangeCounts = {
  add: number
  edit: number
  del: number
  conflict?: number | null
}

type TFn = ReturnType<typeof useT>

export function statusKind(status: string): ChangeKind | null {
  if (!status) return null
  if (status === 'A' || status === 'C') return 'add'
  if (status === 'D') return 'del'
  return 'edit'
}

export function fileStateMark(
  file: GitFileChange | undefined,
  t: TFn
): { label: string; className: string; Icon: typeof TiPlusOutline | typeof LuPencil | typeof LuTriangleAlert; kind: ChangeKind } | null {
  if (!file) return null
  const status = file.status || ''
  const isStaged = Boolean(file.staged)
  const isConflict = Boolean(file.conflict || status === 'C')

  if (isConflict) {
    return {
      label: t('git.operations.conflictBadge') || 'Conflict',
      className: 'text-fail animate-pulse',
      Icon: LuTriangleAlert,
      kind: 'edit',
    }
  }
  if (status === 'A' || status === '?' || status === 'U') {
    return {
      label: isStaged ? t('git.operations.stagedBadge') || 'Staged' : t('git.status.add') || 'Added',
      className: isStaged ? 'text-accent font-semibold' : 'text-ok',
      Icon: TiPlusOutline,
      kind: 'add',
    }
  }
  if (status === 'D') {
    return {
      label: isStaged ? t('git.operations.stagedBadge') || 'Staged' : t('git.status.delete') || 'Deleted',
      className: isStaged ? 'text-accent font-semibold' : 'text-fail',
      Icon: TiMinusOutline,
      kind: 'del',
    }
  }
  return {
    label: isStaged ? t('git.operations.stagedBadge') || 'Staged' : status === 'R' ? t('git.status.rename') || 'Renamed' : t('git.status.modify') || 'Modified',
    className: isStaged ? 'text-accent font-semibold' : 'text-warn',
    Icon: LuPencil,
    kind: 'edit',
  }
}

export function buildTree(files: GitFileChange[]): TreeNode[] {
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

export function groupByPath(files: GitFileChange[]): PathGroup[] {
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

export function tally(node: TreeNode, conflicts: ConflictCounts, index?: Map<string, ChangeCounts>): ChangeCounts {
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

export function folderPaths(nodes: TreeNode[], into: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      into.push(node.path)
      folderPaths(node.children, into)
    }
  }
  return into
}

export function getAncestorPaths(filePath: string): string[] {
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

export function fileName(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash >= 0 ? path.slice(slash + 1) : path
}

export function ConflictMark({ count }: { count: number | null | undefined }) {
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

export function CountMarks({ counts }: { counts: ChangeCounts }) {
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
