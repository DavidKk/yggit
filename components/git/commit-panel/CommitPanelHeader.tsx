'use client'

import React, { useState } from 'react'
import { LuChevronsDownUp, LuChevronsUpDown, LuColumns2, LuCrosshair, LuFolderTree, LuList, LuPanelsTopLeft, LuRows2, LuTriangleAlert, LuX } from 'react-icons/lu'
import { TbFileStack } from 'react-icons/tb'

import { GitSearchDropdown } from '@/components/git/GitSearchDropdown'
import { FloatingMenu } from '@/components/git/RefChipsCell'
import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, Tooltip } from '@/components/sk'
import type { GitCommitChanges } from '@/lib/git/types'

import type { FileView, WorktreeLayout } from './commitTreeUtils'

export interface CommitPanelHeaderProps {
  panelTitle: string
  badgeCount: number
  changes: GitCommitChanges | null
  selectedPath: string
  onLocateCurrentFile: () => void
  isWorktree: boolean
  worktreeLayout: WorktreeLayout
  onToggleLayout: (layout: WorktreeLayout) => void
  fileQuery: string
  setFileQuery: (q: string) => void
  view: FileView
  setView: (v: FileView) => void
  canExpand: boolean
  allOpen: boolean
  onToggleExpandAll: () => void
  onClose: () => void
  conflictFileCount: number
  filterConflicts: boolean
  setConflictsOnly: React.Dispatch<React.SetStateAction<boolean>>
}

export function CommitPanelHeader({
  panelTitle,
  badgeCount,
  changes,
  selectedPath,
  onLocateCurrentFile,
  isWorktree,
  worktreeLayout,
  onToggleLayout,
  fileQuery,
  setFileQuery,
  view,
  setView,
  canExpand,
  allOpen,
  onToggleExpandAll,
  onClose,
  conflictFileCount,
  filterConflicts,
  setConflictsOnly,
}: CommitPanelHeaderProps) {
  const t = useT()
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<{ x: number; y: number } | null>(null)

  return (
    <>
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
            <Tooltip content={t('git.operations.locateCurrentFile') || 'Locate current file'} placement="bottom">
              <Button
                variant="plain"
                size="icon"
                className="size-6 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-accent"
                aria-label={t('git.operations.locateCurrentFile') || 'Locate current file'}
                onClick={onLocateCurrentFile}
              >
                <LuCrosshair className="size-3.5" />
              </Button>
            </Tooltip>
          )}

          {/* Main search dropdown for unified mode */}
          {(!isWorktree || worktreeLayout === 'unified') && (
            <GitSearchDropdown
              className="mr-0 size-6"
              label={t('git.project.searchProjects') || 'Search files'}
              description={t('git.commit.allFiles') || 'Filter by name or path'}
              placeholder={`${t('git.commit.allFiles') || 'Search files'}…`}
              value={fileQuery}
              onChange={setFileQuery}
            />
          )}

          {/* Toggle between Split and Unified view mode */}
          {isWorktree && (
            <Tooltip
              content={
                worktreeLayout === 'split' ? t('git.operations.switchToUnifiedView') || 'Switch to unified list' : t('git.operations.switchToSplitView') || 'Switch to split panels'
              }
            >
              <Button
                variant="plain"
                size="icon"
                className="size-6 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-ink"
                aria-label={
                  worktreeLayout === 'split'
                    ? t('git.operations.switchToUnifiedView') || 'Switch to unified list'
                    : t('git.operations.switchToSplitView') || 'Switch to split panels'
                }
                onClick={() => onToggleLayout(worktreeLayout === 'split' ? 'unified' : 'split')}
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
            aria-label={t('git.commit.fileViewsAria') || 'View options'}
            tooltip={t('git.commit.fileViewsAria') || 'View options'}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
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
              onClick={onToggleExpandAll}
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
          ariaLabel={t('git.commit.fileViewsAria') || 'View options'}
          color="var(--accent)"
          onClose={() => setMoreMenuAnchor(null)}
          items={[
            {
              key: 'view-tree',
              label: t('git.commit.treeView') || 'Tree hierarchy view',
              icon: <LuFolderTree className="size-3.5 text-accent" />,
              checked: view === 'tree',
              group: t('git.commit.fileViewsAria') || 'View',
              onSelect: () => setView('tree'),
            },
            {
              key: 'view-path',
              label: t('git.commit.pathView') || 'Flat path list',
              icon: <LuList className="size-3.5 text-accent" />,
              checked: view === 'path',
              group: t('git.commit.fileViewsAria') || 'View',
              onSelect: () => setView('path'),
            },
            ...(!isWorktree
              ? [
                  {
                    key: 'view-all',
                    label: t('git.commit.allFiles') || 'All repository files',
                    icon: <TbFileStack className="size-3.5 text-accent" />,
                    checked: view === 'all',
                    group: t('git.commit.fileViewsAria') || 'View',
                    onSelect: () => setView('all'),
                  },
                ]
              : []),
            ...(conflictFileCount > 0
              ? [
                  {
                    key: 'conflicts-only',
                    label: t('git.commit.conflictsOnly') || 'Show conflict files only',
                    icon: <LuTriangleAlert className="size-3.5 text-warn" />,
                    checked: filterConflicts,
                    group: t('git.commit.conflictsOnly') || 'Filter',
                    onSelect: () => setConflictsOnly((value) => !value),
                  },
                ]
              : []),
          ]}
        />
      ) : null}
    </>
  )
}
