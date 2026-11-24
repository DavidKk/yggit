'use client'

import React from 'react'
import { LuChevronDown, LuChevronRight, LuCloud, LuFolder } from 'react-icons/lu'

import { AnimatedCounter } from '@/components/git/AnimatedCounter'
import { handleTreeExpandKey, handleTreeParentKey } from '@/components/git/treeExpandKey'
import { useT } from '@/components/i18n/LocaleProvider'
import type { GitRemoteProbe, GitSelection } from '@/lib/git/types'
import { cn } from '@/lib/utils'

import { SidebarRow } from './SidebarRow'
import type { BranchItem, BranchNode } from './sidebarUtils'

export interface BranchTreeProps {
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
  onSetUpstream?: (branch: string) => void
  soloBranch?: string | null
  idPrefix?: string
  parentId?: string
  repo?: string
  updateByName?: Map<string, GitRemoteProbe>
  onBranchHoverStart?: (branchName: string) => void
  onBranchHoverEnd?: () => void
}

export function BranchTree({
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
  onSetUpstream,
  soloBranch,
  idPrefix = kind,
  parentId,
  repo: _repo,
  updateByName,
  onBranchHoverStart,
  onBranchHoverEnd,
}: BranchTreeProps) {
  const t = useT()
  return (
    <>
      {nodes.map((node) => {
        const folderId = `${idPrefix}:${node.id}`
        if (node.children.length === 0 && node.item) {
          const probe = updateByName?.get(node.item.name)
          return (
            <SidebarRow
              key={folderId}
              label={node.label}
              branchName={node.item.name}
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
              ahead={node.item.ahead}
              behind={node.item.behind}
              upstream={node.item.upstream}
              kind={kind}
              onSetUpstream={onSetUpstream ? () => onSetUpstream(node.item!.name) : undefined}
              onClick={() => onSelect({ kind, name: node.item!.name })}
              onDoubleClick={() => onCheckoutBranch?.(node.item!.name, kind === 'remote')}
              onContextMenu={(e) => onContextMenu?.(e, node.item!, kind)}
              onPointerEnter={() => onBranchHoverStart?.(node.item!.name)}
              onPointerLeave={() => onBranchHoverEnd?.()}
            />
          )
        }

        const expanded = folderOpen(folderId)
        const isCurrentBranch = node.item ? Boolean(node.item.current) : false
        const branchActive = node.item ? active === `${kind}:${node.item.name}` : false
        return (
          <div key={folderId}>
            <div
              role="treeitem"
              tabIndex={0}
              data-git-tree-id={folderId}
              data-git-sidebar-branch={node.item ? node.item.name : undefined}
              title={node.item?.title && node.item.title !== node.label ? node.item.title : undefined}
              aria-expanded={expanded}
              aria-selected={branchActive}
              aria-current={branchActive ? 'true' : undefined}
              className={cn(
                'group/folder flex h-8 w-full cursor-pointer select-text items-center justify-start gap-1.5 rounded-none px-2 font-normal text-xs transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent',
                isCurrentBranch && branchActive
                  ? 'bg-[color-mix(in_oklab,var(--accent)_22%,var(--ok)_12%)] text-accent font-semibold ring-1 ring-inset ring-accent/30 hover:bg-[color-mix(in_oklab,var(--accent)_28%,var(--ok)_16%)]'
                  : isCurrentBranch
                    ? 'bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] text-ink font-medium hover:bg-[color-mix(in_oklab,var(--ok)_22%,transparent)]'
                    : branchActive
                      ? 'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-accent font-medium hover:bg-[color-mix(in_oklab,var(--accent)_24%,transparent)]'
                      : 'text-ink-soft hover:bg-[color-mix(in_oklab,var(--accent)_9%,transparent)]'
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
              onKeyDown={(event: React.KeyboardEvent) => {
                if (handleTreeExpandKey(event, expanded, (next) => onSetFolder(folderId, next))) return
                handleTreeParentKey(event, parentId)
              }}
            >
              <span
                role="button"
                tabIndex={-1}
                className="inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center select-none"
                onClick={(event: React.MouseEvent) => {
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
                  {kind === 'local' && (
                    <>
                      {node.item.ahead !== undefined && node.item.ahead > 0 && (
                        <span
                          className="font-mono text-[11px] text-ink-soft select-none flex items-center gap-0.5"
                          title={t('git.operations.aheadCommits', { count: node.item.ahead }) || `Ahead by ${node.item.ahead} commit${node.item.ahead > 1 ? 's' : ''}`}
                        >
                          <AnimatedCounter value={node.item.ahead} max={99} suffix=" ↑" />
                        </span>
                      )}
                      {node.item.behind !== undefined && node.item.behind > 0 && (
                        <span
                          className="font-mono text-[11px] text-ink-soft select-none flex items-center gap-0.5"
                          title={t('git.operations.behindCommits', { count: node.item.behind }) || `Behind by ${node.item.behind} commit${node.item.behind > 1 ? 's' : ''}`}
                        >
                          <AnimatedCounter value={node.item.behind} max={99} suffix=" ↓" />
                        </span>
                      )}
                      {!node.item.upstream && onSetUpstream && (
                        <button
                          type="button"
                          title={t('git.operations.setUpstream') || 'Set upstream branch'}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation()
                            onSetUpstream(node.item!.name)
                          }}
                          className="opacity-0 group-hover/folder:opacity-100 hover:text-accent rounded px-1 text-[11px] text-ink-soft select-none transition-opacity flex items-center gap-0.5 cursor-pointer"
                        >
                          <LuCloud className="size-3 shrink-0" />
                        </button>
                      )}
                    </>
                  )}
                  {soloBranch === node.item.name ? (
                    <span className="rounded bg-accent/20 px-1 py-0.2 text-[10px] font-semibold text-accent select-none">{t('git.operations.soloBadge') || 'Solo'}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </>
  )
}
