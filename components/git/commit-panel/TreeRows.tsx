'use client'

import React from 'react'
import { LuChevronDown, LuChevronRight, LuUndo2 } from 'react-icons/lu'
import { TiMinusOutline, TiPlusOutline } from 'react-icons/ti'

import { handleTreeExpandKey, handleTreeParentKey } from '@/components/git/treeExpandKey'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Tooltip } from '@/components/sk'
import { cn } from '@/lib/utils'

import { type ChangeCounts, type ConflictCounts, ConflictMark, CountMarks, fileStateMark, tally, type TreeNode } from './commitTreeUtils'

export interface TreeRowsProps {
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
}

export function TreeRows({
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
}: TreeRowsProps) {
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
            onContextMenu={(event: React.MouseEvent) => {
              event.preventDefault()
              onFolderContextMenu?.(event, node.path, node.name)
            }}
            onKeyDown={(event: React.KeyboardEvent) => {
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

    const isEntering = (node.file as any)?.isEntering
    const isExiting = (node.file as any)?.isExiting

    return (
      <div
        key={node.path}
        data-git-file-path={node.path}
        className={cn(
          'group/filerow flex h-7 w-full items-center justify-between pr-1.5 rounded-none text-xs transition-colors',
          active ? 'bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-ink' : 'hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] text-ink',
          isEntering && 'git-row-enter',
          isExiting && 'git-row-exit'
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
                ? t('git.operations.stagedBadge') || 'Staged'
                : file.conflict
                  ? t('git.operations.conflictBadge') || 'Conflict'
                  : t('git.operations.unstagedBadge') || 'Unstaged'}
            </span>
          )}
          <ConflictMark count={conflictCounts[node.path]} />
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <div className="flex items-center opacity-0 group-hover/filerow:opacity-100 transition-opacity">
            {isWorktree && file ? (
              <>
                {(isStagedSection === false || (isStagedSection === undefined && file.unstaged)) && onStage && (
                  <Tooltip content={t('git.operations.stageFile') || 'Stage file'}>
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
                  <Tooltip content={t('git.operations.unstageFile') || 'Unstage file'}>
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
                  <Tooltip content={t('git.operations.discardFile') || 'Discard changes'}>
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
