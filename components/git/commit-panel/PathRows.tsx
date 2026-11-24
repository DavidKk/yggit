'use client'

import React from 'react'
import { LuUndo2 } from 'react-icons/lu'
import { TiMinusOutline, TiPlusOutline } from 'react-icons/ti'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk'
import { cn } from '@/lib/utils'

import { type ConflictCounts, ConflictMark, CountMarks, fileName, fileStateMark, type PathGroup, tally } from './commitTreeUtils'

export interface PathRowsProps {
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
}

export function PathRows({
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
}: PathRowsProps) {
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
          const isEntering = (file as any).isEntering
          const isExiting = (file as any).isExiting
          return (
            <div
              key={file.path}
              data-git-file-path={file.path}
              className={cn(
                'group/filerow flex h-7 w-full items-center justify-between px-2 rounded-none text-xs transition-colors',
                active ? 'bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-ink' : 'hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] text-ink',
                isEntering && 'git-row-enter',
                isExiting && 'git-row-exit'
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
                      ? t('git.operations.stagedBadge') || 'Staged'
                      : file.conflict
                        ? t('git.operations.conflictBadge') || 'Conflict'
                        : t('git.operations.unstagedBadge') || 'Unstaged'}
                  </span>
                )}
                <ConflictMark count={conflictCounts[file.path]} />
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <div className="flex items-center opacity-0 group-hover/filerow:opacity-100 transition-opacity">
                  {isWorktree ? (
                    <>
                      {(isStagedSection === false || (isStagedSection === undefined && file.unstaged)) && onStage && (
                        <Tooltip content={t('git.operations.stageFile') || 'Stage file'}>
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
                        <Tooltip content={t('git.operations.unstageFile') || 'Unstage file'}>
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
                        <Tooltip content={t('git.operations.discardFile') || 'Discard changes'}>
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
