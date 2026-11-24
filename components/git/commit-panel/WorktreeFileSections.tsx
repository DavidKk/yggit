'use client'

import React from 'react'
import { LuChevronDown, LuChevronRight } from 'react-icons/lu'
import { TiMinusOutline, TiPlusOutline } from 'react-icons/ti'

import { AnimatedCounter } from '@/components/git/AnimatedCounter'
import { GitSearchDropdown } from '@/components/git/GitSearchDropdown'
import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, Tooltip } from '@/components/sk'
import type { GitFileChange } from '@/lib/git/types'
import { cn } from '@/lib/utils'

import { buildTree, type ConflictCounts, type FileView, groupByPath } from './commitTreeUtils'
import { PathRows } from './PathRows'
import { TreeRows } from './TreeRows'
import { useAnimatedFileList } from './useAnimatedFileList'

export interface WorktreeFileSectionsProps {
  openUnstaged: boolean
  setOpenUnstaged: React.Dispatch<React.SetStateAction<boolean>>
  openStaged: boolean
  setOpenStaged: React.Dispatch<React.SetStateAction<boolean>>
  unstagedFiles: GitFileChange[]
  stagedFiles: GitFileChange[]
  filteredUnstagedFiles: GitFileChange[]
  filteredStagedFiles: GitFileChange[]
  unstagedQuery: string
  setUnstagedQuery: (v: string) => void
  stagedQuery: string
  setStagedQuery: (v: string) => void
  handleStageAll: () => Promise<void> | void
  handleUnstageAll: () => Promise<void> | void
  view: FileView
  selectedPath: string
  conflictCounts: ConflictCounts
  onSelect: (path: string, status: string) => void
  handleFileContextMenu: (e: React.MouseEvent, path: string, name: string, status: string) => void
  handleFolderContextMenu: (e: React.MouseEvent, path: string, name: string) => void
  handleStage: (path: string) => void | Promise<void>
  handleUnstage: (path: string) => void | Promise<void>
  handleDiscard: (path: string) => void | Promise<void>
  repo: string
  openPaths: Set<string>
  toggleFolder: (path: string) => void
  setFolderOpen: (path: string, next: boolean) => void
  isSearching: boolean
}

export function WorktreeFileSections({
  openUnstaged,
  setOpenUnstaged,
  openStaged,
  setOpenStaged,
  unstagedFiles,
  stagedFiles,
  filteredUnstagedFiles,
  filteredStagedFiles,
  unstagedQuery,
  setUnstagedQuery,
  stagedQuery,
  setStagedQuery,
  handleStageAll,
  handleUnstageAll,
  view,
  selectedPath,
  conflictCounts,
  onSelect,
  handleFileContextMenu,
  handleFolderContextMenu,
  handleStage,
  handleUnstage,
  handleDiscard,
  repo,
  openPaths,
  toggleFolder,
  setFolderOpen,
  isSearching,
}: WorktreeFileSectionsProps) {
  const t = useT()
  const animatedUnstagedFiles = useAnimatedFileList(filteredUnstagedFiles)
  const animatedStagedFiles = useAnimatedFileList(filteredStagedFiles)

  const renderFileList = (files: GitFileChange[], isStagedSection?: boolean) => {
    if (files.length === 0) {
      return (
        <div className="flex h-20 items-center justify-center p-3 text-center text-xs text-ink-soft/70">
          {isStagedSection
            ? t('git.operations.noStagedFiles') || 'No staged files (select files below to stage)'
            : t('git.operations.workingTreeClean') || 'Working tree clean, no unstaged changes'}
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
          isWorktree={true}
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
        isWorktree={true}
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
              <AnimatedCounter value={unstagedFiles.length} max={99} />
            </Badge>
          </button>
          <div className="flex items-center gap-1 shrink-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <GitSearchDropdown
              className="size-6 mr-0"
              label={t('git.operations.unstagedFiles') || 'Unstaged changes'}
              description={t('git.operations.unstagedFiles') || 'Filter unstaged files'}
              placeholder={`${t('git.operations.unstagedFiles') || 'Unstaged changes'}…`}
              value={unstagedQuery}
              onChange={setUnstagedQuery}
            />
            {unstagedFiles.length > 0 && (
              <Tooltip content={t('git.operations.stageAll') || 'Stage all'}>
                <Button
                  variant="plain"
                  size="icon"
                  className="size-6 text-accent hover:enabled:bg-accent/10 hover:enabled:text-accent"
                  aria-label={t('git.operations.stageAll') || 'Stage all'}
                  onClick={() => void handleStageAll()}
                >
                  <TiPlusOutline className="size-3.5" />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

        {openUnstaged && (
          <div className="flex-1 overflow-y-auto" aria-label={t(view === 'path' ? 'git.commit.pathListAria' : view === 'all' ? 'git.commit.allFilesAria' : 'git.commit.treeAria')}>
            {renderFileList(animatedUnstagedFiles, false)}
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
              <AnimatedCounter value={stagedFiles.length} max={99} />
            </Badge>
          </button>
          <div className="flex items-center gap-1 shrink-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <GitSearchDropdown
              className="size-6 mr-0"
              label={t('git.operations.stagedFiles') || 'Staged changes'}
              description={t('git.operations.stagedFiles') || 'Filter staged files'}
              placeholder={`${t('git.operations.stagedFiles') || 'Staged changes'}…`}
              value={stagedQuery}
              onChange={setStagedQuery}
            />
            {stagedFiles.length > 0 && (
              <Tooltip content={t('git.operations.unstageAll') || 'Unstage all'}>
                <Button
                  variant="plain"
                  size="icon"
                  className="size-6 text-warn hover:enabled:bg-warn/10 hover:enabled:text-warn"
                  aria-label={t('git.operations.unstageAll') || 'Unstage all'}
                  onClick={() => void handleUnstageAll()}
                >
                  <TiMinusOutline className="size-3.5" />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

        {openStaged && (
          <div className="flex-1 overflow-y-auto" aria-label={t(view === 'path' ? 'git.commit.pathListAria' : view === 'all' ? 'git.commit.allFilesAria' : 'git.commit.treeAria')}>
            {renderFileList(animatedStagedFiles, true)}
          </div>
        )}
      </section>
    </div>
  )
}
