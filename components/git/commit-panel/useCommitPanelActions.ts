'use client'

import type { ConfirmRequest } from '@/components/confirm/ConfirmProvider'
import { useT } from '@/components/i18n/LocaleProvider'
import { getGitDriver } from '@/lib/git/driver'
import type { GitFileChange } from '@/lib/git/types'

export interface UseCommitPanelActionsOptions {
  repo: string
  stagedFiles: GitFileChange[]
  unstagedFiles: GitFileChange[]
  commitSummary: string
  setCommitSummary: (v: string) => void
  commitDesc: string
  setCommitDesc: (v: string) => void
  amendCommit: boolean
  setAmendCommit: (v: boolean) => void
  skipGitHooks: boolean
  pushAfterCommit: boolean
  setIsCommitting: (v: boolean) => void
  stashTitle: string
  setStashTitle: (v: string) => void
  stashDesc: string
  setStashDesc: (v: string) => void
  setIsStashing: (v: boolean) => void
  newFileDialog: { folderPath: string; fileName: string } | null
  setNewFileDialog: (v: { folderPath: string; fileName: string } | null) => void
  reloadDiff: () => Promise<void> | void
  onRefresh?: () => Promise<void> | void
  onSelect: (path: string, status: string) => void
  notify: {
    success: (msg: string) => void
    error: (msg: string) => void
    info: (msg: string) => void
  }
  confirm: (opts: ConfirmRequest) => Promise<boolean>
}

export function useCommitPanelActions({
  repo,
  stagedFiles,
  unstagedFiles,
  commitSummary,
  setCommitSummary,
  commitDesc,
  setCommitDesc,
  amendCommit,
  setAmendCommit,
  skipGitHooks,
  pushAfterCommit,
  setIsCommitting,
  stashTitle,
  setStashTitle,
  stashDesc,
  setStashDesc,
  setIsStashing,
  newFileDialog,
  setNewFileDialog,
  reloadDiff,
  onRefresh,
  onSelect,
  notify,
  confirm,
}: UseCommitPanelActionsOptions) {
  const t = useT()

  const handleStage = async (filePath: string) => {
    try {
      const driver = getGitDriver()
      await driver.stage(repo, [filePath])
      notify.success((t('git.operations.stageFile') || 'Staged {file}').replace('{file}', filePath))
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('git.operations.stageSuccess') || 'Failed to stage')
    }
  }

  const handleUnstage = async (filePath: string) => {
    try {
      const driver = getGitDriver()
      await driver.unstage(repo, [filePath])
      notify.success((t('git.operations.unstageFile') || 'Unstaged {file}').replace('{file}', filePath))
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('git.operations.unstageSuccess') || 'Failed to unstage')
    }
  }

  const handleDiscard = async (filePath: string) => {
    const ok = await confirm({
      title: t('git.operations.discardFile') || 'Discard changes',
      description: (t('git.operations.discardConfirm') || 'Are you sure you want to discard changes to {file}? This cannot be undone.').replace('{file}', filePath),
      confirmLabel: t('git.operations.discardFile') || 'Discard',
      confirmVariant: 'fail',
    })
    if (!ok) return
    try {
      const driver = getGitDriver()
      await driver.discard(repo, [filePath])
      notify.success((t('git.operations.discardSuccess') || 'Discarded changes to {file}').replace('{file}', filePath))
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('git.operations.discardFile') || 'Failed to discard changes')
    }
  }

  const handleStageAll = async () => {
    try {
      const driver = getGitDriver()
      await driver.stage(repo, [], true)
      notify.success(t('git.operations.stageSuccess') || 'Staged all changes')
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('git.operations.stageSuccess') || 'Failed to stage all changes')
    }
  }

  const handleUnstageAll = async () => {
    try {
      const driver = getGitDriver()
      await driver.unstage(repo, [], true)
      notify.success(t('git.operations.unstageSuccess') || 'Unstaged all changes')
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('git.operations.unstageSuccess') || 'Failed to unstage all changes')
    }
  }

  const handleCommitSubmit = async () => {
    const trimmed = commitSummary.trim()
    if (!trimmed) {
      notify.error(t('git.operations.commitPlaceholder') || 'Please enter commit summary')
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
      notify.success(res.message || t('git.operations.commitSuccess') || 'Commit succeeded')
      setCommitSummary('')
      setCommitDesc('')
      setAmendCommit(false)
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Commit failed')
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
      notify.success(res.message || t('git.operations.stashSuccess') || 'Stashed workspace changes')
      setStashTitle('')
      setStashDesc('')
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Stash failed')
    } finally {
      setIsStashing(false)
    }
  }

  const handleCreatePatch = async (pathTarget?: string) => {
    try {
      const driver = getGitDriver()
      const res = await driver.createPatch(repo, { path: pathTarget })
      if (!res.patch) {
        notify.info('No patch changes to export')
        return
      }
      await navigator.clipboard.writeText(res.patch)
      notify.success(`Copied patch (${res.patch.split('\n').length} lines) to clipboard`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to generate patch')
    }
  }

  const handleIgnore = async (pattern: string) => {
    try {
      const driver = getGitDriver()
      const res = await driver.ignorePattern(repo, pattern)
      notify.success(res.message || `Added ${pattern} to .gitignore`)
      await reloadDiff()
      await onRefresh?.()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to add to .gitignore')
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
      notify.success(res.message || `Created file ${relativePath}`)
      setNewFileDialog(null)
      await reloadDiff()
      onSelect(relativePath, 'A')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create file')
    }
  }

  return {
    handleStage,
    handleUnstage,
    handleDiscard,
    handleStageAll,
    handleUnstageAll,
    handleCommitSubmit,
    handleStashSubmit,
    handleCreatePatch,
    handleIgnore,
    handleCreateFileSubmit,
  }
}
