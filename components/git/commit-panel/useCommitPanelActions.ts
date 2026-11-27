'use client'

import { type MutableRefObject, useEffect, useRef } from 'react'

import type { ConfirmRequest } from '@/components/confirm/ConfirmProvider'
import { useT } from '@/components/i18n/LocaleProvider'
import { getGitDriver, type IGitDriver } from '@/lib/git/driver'
import type { GitFileChange } from '@/lib/git/types'

export interface UseCommitPanelActionsOptions {
  repo: string
  files: GitFileChange[]
  stagedFiles: GitFileChange[]
  unstagedFiles: GitFileChange[]
  onOptimisticFilesChange: (files: GitFileChange[]) => void
  pendingStageCountRef: MutableRefObject<number>
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
  onCommitSuccess?: (params: { hash?: string; subject: string; remainingFilesCount?: number }) => void
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
  files,
  stagedFiles: _stagedFiles,
  unstagedFiles: _unstagedFiles,
  onOptimisticFilesChange,
  pendingStageCountRef,
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
  onCommitSuccess,
  onSelect,
  notify,
  confirm,
}: UseCommitPanelActionsOptions) {
  const t = useT()
  const activeRepoRef = useRef(repo)
  activeRepoRef.current = repo

  const latestFilesRef = useRef<GitFileChange[]>(files)
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const batchFailedRef = useRef(false)
  const suppressTailReloadRef = useRef(false)

  useEffect(() => {
    if (pendingStageCountRef.current === 0) {
      latestFilesRef.current = files
    }
  }, [files, pendingStageCountRef])

  useEffect(() => {
    pendingStageCountRef.current = 0
    latestFilesRef.current = files
    batchFailedRef.current = false
    suppressTailReloadRef.current = false
  }, [repo]) // eslint-disable-line react-hooks/exhaustive-deps

  const flushPendingStageOps = async (options?: { suppressReload?: boolean }): Promise<boolean> => {
    if (pendingStageCountRef.current === 0) return true
    if (options?.suppressReload) {
      suppressTailReloadRef.current = true
    }
    try {
      await mutationQueueRef.current
      return !batchFailedRef.current
    } finally {
      if (options?.suppressReload && pendingStageCountRef.current === 0) {
        suppressTailReloadRef.current = false
      }
    }
  }

  const enqueueStageMutation = async (transform: (prev: GitFileChange[]) => GitFileChange[], execute: (driver: IGitDriver) => Promise<unknown>, errorFallback: string) => {
    const opRepo = repo
    if (pendingStageCountRef.current === 0) {
      batchFailedRef.current = false
      suppressTailReloadRef.current = false
    }
    const snapshotBefore = latestFilesRef.current
    const nextFiles = transform(snapshotBefore)
    latestFilesRef.current = nextFiles
    onOptimisticFilesChange(nextFiles)

    pendingStageCountRef.current += 1
    let runError: unknown = null
    const task = mutationQueueRef.current.then(async () => {
      try {
        const driver = getGitDriver()
        await execute(driver)
      } catch (err) {
        runError = err
      }
    })
    mutationQueueRef.current = task

    await task

    let failed = false
    if (runError !== null) {
      failed = true
      batchFailedRef.current = true
      if (activeRepoRef.current === opRepo) {
        if (pendingStageCountRef.current <= 1) {
          latestFilesRef.current = snapshotBefore
          onOptimisticFilesChange(snapshotBefore)
        }
        notify.error(runError instanceof Error ? runError.message : errorFallback)
      }
    }

    pendingStageCountRef.current = Math.max(0, pendingStageCountRef.current - 1)
    if (pendingStageCountRef.current === 0 && activeRepoRef.current === opRepo) {
      const hadBatchFailure = batchFailedRef.current || failed
      const skipReload = suppressTailReloadRef.current && !hadBatchFailure
      batchFailedRef.current = false
      suppressTailReloadRef.current = false
      if (!skipReload) {
        await reloadDiff()
      }
      if (hadBatchFailure) {
        await onRefresh?.()
      }
    }
  }

  const handleStage = async (filePath: string) => {
    await enqueueStageMutation(
      (prev) => prev.map((f) => (f.path === filePath ? { ...f, staged: true, unstaged: false } : f)),
      (driver) => driver.stage(repo, [filePath]),
      t('git.operations.stageSuccess') || 'Failed to stage'
    )
  }

  const handleUnstage = async (filePath: string) => {
    await enqueueStageMutation(
      (prev) => prev.map((f) => (f.path === filePath ? { ...f, staged: false, unstaged: true } : f)),
      (driver) => driver.unstage(repo, [filePath]),
      t('git.operations.unstageSuccess') || 'Failed to unstage'
    )
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
      await flushPendingStageOps({ suppressReload: true })
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
    await enqueueStageMutation(
      (prev) => prev.map((f) => ({ ...f, staged: true, unstaged: false })),
      (driver) => driver.stage(repo, [], true),
      t('git.operations.stageSuccess') || 'Failed to stage all changes'
    )
  }

  const handleUnstageAll = async () => {
    await enqueueStageMutation(
      (prev) => prev.map((f) => ({ ...f, staged: false, unstaged: true })),
      (driver) => driver.unstage(repo, [], true),
      t('git.operations.unstageSuccess') || 'Failed to unstage all changes'
    )
  }

  const handleCommitSubmit = async () => {
    const trimmed = commitSummary.trim()
    if (!trimmed) {
      notify.error(t('git.operations.commitPlaceholder') || 'Please enter commit summary')
      return
    }
    const fullMessage = commitDesc.trim() ? `${trimmed}\n\n${commitDesc.trim()}` : trimmed
    const initialFiles = latestFilesRef.current.length > 0 ? latestFilesRef.current : files
    const stageAll = !initialFiles.some((f) => f.staged) && initialFiles.some((f) => f.unstaged || f.conflict)
    setIsCommitting(true)
    try {
      const stageOk = await flushPendingStageOps({ suppressReload: true })
      if (!stageOk) return
      const currentFiles = latestFilesRef.current.length > 0 ? latestFilesRef.current : initialFiles
      const resolvedStageAll = stageAll || (!currentFiles.some((f) => f.staged) && currentFiles.some((f) => f.unstaged || f.conflict))
      const driver = getGitDriver()
      const res = await driver.commit(repo, fullMessage, {
        stageAll: resolvedStageAll,
        amend: amendCommit,
        noVerify: skipGitHooks,
        pushAfter: pushAfterCommit,
      })
      setCommitSummary('')
      setCommitDesc('')
      setAmendCommit(false)
      if (!amendCommit && res.hash) {
        const remainingFilesCount = resolvedStageAll ? 0 : currentFiles.filter((f) => !f.staged && (f.unstaged || f.conflict)).length
        onCommitSuccess?.({ hash: res.hash, subject: trimmed, remainingFilesCount })
      }
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
      await flushPendingStageOps({ suppressReload: true })
      const driver = getGitDriver()
      const res = await driver.stash(repo, { action: 'save', message: fullMessage || undefined })
      notify.success(t('git.operations.stashSuccess') || res.message || 'Stashed workspace changes')
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
    flushPendingStageOps,
  }
}
