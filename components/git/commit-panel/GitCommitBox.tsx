'use client'

import React from 'react'
import { LuArchive, LuChevronDown, LuChevronRight, LuGitCommitHorizontal, LuHistory, LuSettings, LuSparkles } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Spinner, Tooltip } from '@/components/sk'
import type { GitFileChange } from '@/lib/git/types'
import { cn } from '@/lib/utils'

export interface GitCommitBoxProps {
  openCommit: boolean
  setOpenCommit: React.Dispatch<React.SetStateAction<boolean>>
  bottomTab: 'commit' | 'stash'
  setBottomTab: React.Dispatch<React.SetStateAction<'commit' | 'stash'>>
  commitSettingsBtnRef: React.RefObject<HTMLButtonElement | null>
  pushAfterCommit: boolean
  skipGitHooks: boolean
  setCommitSettingsAnchor: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>
  commitSummary: string
  setCommitSummary: (v: string) => void
  commitDesc: string
  setCommitDesc: (v: string) => void
  commitDescRef: React.RefObject<HTMLTextAreaElement | null>
  handleCommitSubmit: () => void | Promise<void>
  handleAiCompose: () => void
  isCommitting: boolean
  amendCommit: boolean
  setAmendCommit: (v: boolean) => void
  stagedFiles: GitFileChange[]
  unstagedFiles: GitFileChange[]
  stashTitle: string
  setStashTitle: (v: string) => void
  stashDesc: string
  setStashDesc: (v: string) => void
  stashDescRef: React.RefObject<HTMLTextAreaElement | null>
  handleStashSubmit: () => void | Promise<void>
  isStashing: boolean
}

export function GitCommitBox({
  openCommit,
  setOpenCommit,
  bottomTab,
  setBottomTab,
  commitSettingsBtnRef,
  pushAfterCommit,
  skipGitHooks,
  setCommitSettingsAnchor,
  commitSummary,
  setCommitSummary,
  commitDesc,
  setCommitDesc,
  commitDescRef,
  handleCommitSubmit,
  handleAiCompose,
  isCommitting,
  amendCommit,
  setAmendCommit,
  stagedFiles,
  unstagedFiles,
  stashTitle,
  setStashTitle,
  stashDesc,
  setStashDesc,
  stashDescRef,
  handleStashSubmit,
  isStashing,
}: GitCommitBoxProps) {
  const t = useT()

  return (
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
            <Tooltip content={t('git.operations.commitOptions') || 'Commit options'}>
              <Button
                ref={commitSettingsBtnRef}
                variant="plain"
                size="icon"
                className={cn('size-6 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-ink', (pushAfterCommit || skipGitHooks) && 'text-accent')}
                aria-label={t('git.operations.commitOptions') || 'Commit options'}
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  setCommitSettingsAnchor((prev) => (prev ? null : { x: Math.max(8, rect.right - 236), y: rect.bottom + 4 }))
                }}
              >
                <LuSettings className="size-3.5" />
              </Button>
            </Tooltip>
          )}

          <Tooltip content={bottomTab === 'stash' ? t('git.operations.tabCommit') || 'Return to commit mode' : t('git.operations.tabStash') || 'Stash working tree'}>
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
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
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
                  <Tooltip content={t('git.operations.generateCommitAiTip') || 'Generate commit message with AI'}>
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
                          <span>{t('git.operations.committing') || 'Committing…'}</span>
                        </>
                      ) : (
                        <>
                          <LuGitCommitHorizontal className="size-3.5" />
                          <span>
                            {amendCommit
                              ? t('git.operations.amendCommitBtn') || 'Amend Commit'
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
                        amendCommit ? t('git.operations.amendActiveTip') || 'Amend active (click to cancel)' : t('git.operations.amendInactiveTip') || 'Amend previous commit'
                      }
                    >
                      <button
                        type="button"
                        aria-label={t('git.operations.amendPrevious') || 'Amend previous commit'}
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
                  <Tooltip content={t('git.operations.autoFillStashTitleTip') || 'Autofill stash title'}>
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
                    <span>{t('git.operations.stashing') || 'Stashing…'}</span>
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
  )
}
