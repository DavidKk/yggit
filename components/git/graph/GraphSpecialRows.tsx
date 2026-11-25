'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'

import { type GraphContextMenu, stashFindHit } from '@/components/git/graph/GraphPrimitives'
import type { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import { formatCommitDateDivider } from '@/lib/git/format-commit-ago'
import { DOT, type graphScene, laneColor, ROW, xAt } from '@/lib/git/graph-scene'
import { GIT_WORKTREE_HASH, type GitCommit, type GitStash, gitStashAsCommit, type GitWorktree } from '@/lib/git/types'
import { cn } from '@/lib/utils'

export function DateBoundaryDividers({ dateBoundaries, locale }: { dateBoundaries: Array<{ rowIndex: number; date: string }>; locale: ReturnType<typeof useLocaleCode> }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible" aria-hidden>
      {dateBoundaries.map((b) => (
        <div
          key={`date-boundary-${b.rowIndex}`}
          className="absolute right-0 flex h-0 items-center pr-3"
          style={{
            top: b.rowIndex * ROW,
            left: 'calc(var(--git-branch-w) + var(--git-graph-w))',
          }}
        >
          <div className="h-px flex-1 bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]" />
          <span className="ml-2 shrink-0 rounded border border-[color-mix(in_oklab,var(--ink)_12%,transparent)] bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-ink-soft select-none shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            {formatCommitDateDivider(b.date, locale)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function WorktreeRow({
  worktree,
  scene,
  headIndex,
  selectedHash,
  contextMenu,
  columns,
  onSelectWorktree,
  setContextMenu,
  t,
}: {
  worktree: GitWorktree
  scene: ReturnType<typeof graphScene>
  headIndex: number
  selectedHash?: string
  contextMenu: GraphContextMenu | null
  columns: string
  onSelectWorktree?: () => void
  setContextMenu: Dispatch<SetStateAction<GraphContextMenu | null>>
  t: ReturnType<typeof useT>
}) {
  const { points } = scene
  const isContextActive = contextMenu?.type === 'worktree'
  const wipDot = scene.dots.find((dot) => dot.key === 'wip')
  const color = wipDot?.color || laneColor(headIndex >= 0 ? (points[headIndex]?.color ?? 0) : 0)
  const isSelected = selectedHash === GIT_WORKTREE_HASH
  const nodeRadius = wipDot ? (isSelected ? wipDot.radius + 2.5 : wipDot.radius + 1) : 8
  const nodeX = wipDot ? wipDot.x : 16
  const added = worktree.addedFiles !== undefined ? worktree.addedFiles : worktree.insertions
  const deleted = worktree.deletedFiles !== undefined ? worktree.deletedFiles : worktree.deletions

  return (
    <li className="group/commit git-commit-row relative z-0 h-[26px] max-h-[26px] min-w-0 shrink-0 overflow-visible hover:z-10">
      <div
        className="git-graph-col-pill"
        data-selected={isSelected ? 'true' : 'false'}
        style={{ '--row-tint': color, '--node-x': `${nodeX}px`, '--node-radius': `${nodeRadius}px` } as CSSProperties}
      />
      <div className="git-message-col-pill" data-selected={isSelected ? 'true' : 'false'} style={{ '--row-tint': color } as CSSProperties} />
      <div
        role="row"
        tabIndex={0}
        aria-selected={isSelected}
        data-git-commit-hash={GIT_WORKTREE_HASH}
        className="group/commit grid h-[26px] max-h-[26px] w-full min-w-0 cursor-pointer select-text items-center justify-start gap-0 rounded-none border-0 bg-transparent px-0 text-left leading-none font-normal outline-none focus:outline-none focus-visible:outline-none"
        style={{ gridTemplateColumns: columns }}
        onClick={() => {
          const sel = window.getSelection()
          if (sel && sel.toString().length > 0) return
          onSelectWorktree?.()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelectWorktree?.()
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          setContextMenu({
            type: 'worktree',
            worktree,
            color,
            anchor: { x: event.clientX, y: event.clientY },
          })
        }}
      >
        <span className="min-h-0 bg-transparent" />
        <span className="flex h-[26px] min-h-0 items-center justify-end bg-transparent">
          <span className="w-0.5 shrink-0" style={{ height: DOT, background: color }} aria-hidden />
        </span>
        <span className="flex h-[26px] min-h-0 min-w-0 items-center">
          <span
            className={cn(
              'flex min-w-0 flex-1 items-center truncate pr-3 pl-2 text-sm leading-none font-normal select-text cursor-pointer transition-colors duration-150',
              isSelected || isContextActive ? 'text-ink' : 'text-ink-soft'
            )}
            style={{ height: DOT }}
            title={`${t('git.graph.workingTree')} · ${t('git.graph.filesCount', { count: worktree.files })}`}
          >
            {t('git.graph.workingTree')}
            {added > 0 || deleted > 0 ? (
              <>
                {added > 0 ? <span className="ml-3 text-ok">+{added}</span> : null}
                {deleted > 0 ? <span className="ml-2 text-fail">-{deleted}</span> : null}
              </>
            ) : (
              <span className="ml-3 text-ink-soft">{t('git.graph.filesCount', { count: worktree.files })}</span>
            )}
          </span>
        </span>
      </div>
    </li>
  )
}

export function StashRow({
  stash,
  scene,
  selectedHash,
  findNeedle,
  contextMenu,
  columns,
  onSelect,
  setContextMenu,
}: {
  stash: GitStash
  scene: ReturnType<typeof graphScene>
  selectedHash?: string
  findNeedle: string
  contextMenu: GraphContextMenu | null
  columns: string
  onSelect?: (commit: GitCommit) => void
  setContextMenu: Dispatch<SetStateAction<GraphContextMenu | null>>
}) {
  const stashPoint = scene.stashPoints.get(stash.hash)
  const color = stashPoint ? laneColor(stashPoint.color) : 'var(--accent)'
  const selected = selectedHash === stash.hash
  const findHit = stashFindHit(stash, findNeedle)
  const isContextActive = contextMenu?.type === 'stash' && contextMenu.stash.hash === stash.hash
  const rowTintClass = cn(isContextActive ? 'bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]' : '')
  const nodeRadius = selected ? 12.5 : 8
  const nodeX = xAt(stashPoint?.lane ?? 0)

  return (
    <li className="group/commit git-commit-row relative z-0 h-[26px] max-h-[26px] min-w-0 shrink-0 overflow-visible hover:z-10">
      <div
        className="git-graph-col-pill"
        data-selected={selected ? 'true' : 'false'}
        style={{ '--row-tint': color, '--node-x': `${nodeX}px`, '--node-radius': `${nodeRadius}px` } as CSSProperties}
      />
      <div className="git-message-col-pill" data-selected={selected ? 'true' : 'false'} style={{ '--row-tint': color } as CSSProperties} />
      <div
        role="row"
        tabIndex={0}
        aria-selected={selected}
        data-git-commit-hash={stash.hash}
        className={cn(
          'group/commit grid h-[26px] max-h-[26px] w-full min-w-0 cursor-pointer select-text items-center justify-start gap-0 rounded-none border-0 bg-transparent px-0 text-left leading-none font-normal outline-none focus:outline-none focus-visible:outline-none',
          findNeedle && !findHit && 'opacity-35'
        )}
        style={{ gridTemplateColumns: columns }}
        onClick={() => {
          const sel = window.getSelection()
          if (sel && sel.toString().length > 0) return
          onSelect?.(gitStashAsCommit(stash))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect?.(gitStashAsCommit(stash))
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          setContextMenu({
            type: 'stash',
            stash,
            color,
            anchor: { x: event.clientX, y: event.clientY },
          })
        }}
      >
        <span data-git-branch-cell className="h-[26px] min-h-0 bg-transparent" />
        <span className="flex h-[26px] min-h-0 items-center justify-end bg-transparent">
          <span className="w-0.5 shrink-0" style={{ height: DOT, background: color }} aria-hidden />
        </span>
        <span className="flex h-[26px] min-h-0 min-w-0 items-center">
          <span
            className={cn('flex min-w-0 flex-1 items-center truncate pr-3 pl-2 text-sm leading-none font-normal text-ink select-text cursor-pointer', rowTintClass)}
            style={{ height: DOT }}
            title={stash.date ? `${stash.subject || stash.name} (${stash.date})` : stash.subject || stash.name}
          >
            {stash.subject || stash.name}
          </span>
        </span>
      </div>
    </li>
  )
}
