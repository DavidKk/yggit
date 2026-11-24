import type { ReactNode } from 'react'

import type { GitLogView, GitSelection } from '@/lib/git/types'
import { isRecordBoolean } from '@/lib/git/ui-prefs'

export type SectionId = 'local' | 'remote' | 'stash' | 'tag' | 'worktree' | 'submodule'

export const SECTION_DEFAULT: Record<SectionId, boolean> = {
  local: true,
  remote: false,
  stash: false,
  tag: false,
  worktree: false,
  submodule: false,
}

export function isSectionMap(value: unknown): value is Record<SectionId, boolean> {
  if (!isRecordBoolean(value)) return false
  return true
}

export function sectionsOf(value: Record<SectionId, boolean> | Record<string, boolean>): Record<SectionId, boolean> {
  return { ...SECTION_DEFAULT, ...(value as Partial<Record<SectionId, boolean>>) }
}

export function isSectionQueries(value: unknown): value is Partial<Record<SectionId, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string')
}

export type BranchItem = {
  name: string
  path: string
  current?: boolean
  title?: string
  tip?: string
  ahead?: number
  behind?: number
  upstream?: string
}

export type BranchNode = {
  id: string
  label: string
  item?: BranchItem
  children: BranchNode[]
}

export function selectionKey(selection: GitSelection): string {
  if (selection.kind === 'all') return 'all'
  if (selection.kind === 'worktree') return `worktree:${selection.path}`
  return `${selection.kind}:${selection.name}`
}

export function groupRemotes(remotes: GitLogView['remotes']): Array<{ source: string; branches: GitLogView['remotes'] }> {
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

export function buildBranchTree(items: BranchItem[]): BranchNode[] {
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

export type BranchRow = { node: BranchNode; depth: number; parentId: string }

export function visibleBranchRows(nodes: BranchNode[], prefix: string, folderOpen: (id: string) => boolean, depth: number, parentId: string): BranchRow[] {
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

export type SidebarRowType = { id: string; render: () => ReactNode }

export function collectFolderIds(nodes: BranchNode[], idPrefix: string, into: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length === 0) continue
    into.push(`${idPrefix}:${node.id}`)
    collectFolderIds(node.children, idPrefix, into)
  }
  return into
}

export function collectAllBranchItems(node: BranchNode): BranchItem[] {
  const list: BranchItem[] = []
  if (node.item) list.push(node.item)
  for (const child of node.children) {
    list.push(...collectAllBranchItems(child))
  }
  return list
}

export function nameMatch(value: string, needle: string) {
  return !needle || value.toLowerCase().includes(needle)
}

export const SECTION_EMPTY_KEY: Record<SectionId, `git.sidebar.empty.${SectionId}`> = {
  local: 'git.sidebar.empty.local',
  remote: 'git.sidebar.empty.remote',
  stash: 'git.sidebar.empty.stash',
  tag: 'git.sidebar.empty.tag',
  worktree: 'git.sidebar.empty.worktree',
  submodule: 'git.sidebar.empty.submodule',
}
