'use client'

import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from 'react'

import { useT } from '@/components/i18n/LocaleProvider'
import { getGitDriver } from '@/lib/git/driver'
import type { GitLogView } from '@/lib/git/types'

export function useGitBranchActions({
  view,
  loadRef,
  notification,
  setBusy,
  setProgressStage,
  setRenameModal,
  setCreateBranchModal,
}: {
  view: GitLogView | null
  loadRef: MutableRefObject<(repo: string) => Promise<void>>
  notification: { success: (msg: string) => void; error: (msg: string) => void }
  setBusy: Dispatch<SetStateAction<boolean>>
  setProgressStage: Dispatch<SetStateAction<string>>
  setRenameModal: Dispatch<SetStateAction<{ open: boolean; oldName: string }>>
  setCreateBranchModal: Dispatch<SetStateAction<{ open: boolean; startPoint?: string; currentBranch?: string }>>
}) {
  const t = useT()

  const handleAddWorktree = useCallback(async () => {
    if (!view?.repo) return
    const defaultWt = `../${view.repo.split(/[/\\]/).filter(Boolean).pop()}_wt`
    const inputPath = window.prompt(t('git.operations.addWorktreePromptPath') || 'Enter new worktree directory path (relative to repo or absolute):', defaultWt)
    if (!inputPath || !inputPath.trim()) return
    const branch = window.prompt(t('git.operations.addWorktreePromptBranch') || 'Enter linked branch name (optional, defaults to current branch):') || undefined
    setBusy(true)
    setProgressStage(t('git.operations.creatingWorktree') || 'Creating worktree...')
    try {
      const driver = getGitDriver()
      if (driver.addWorktree) {
        const res = await driver.addWorktree(view.repo, inputPath.trim(), branch?.trim())
        if (res.ok) {
          notification.success(t('git.operations.addWorktreeSuccess') || res.message || 'Worktree created')
          await loadRef.current(view.repo)
        } else {
          notification.error(t('git.errors.addWorktreeFailed') || res.message || 'Failed to create worktree')
        }
      } else {
        notification.error(t('git.errors.addWorktreeUnsupported') || 'Creating a worktree is not supported in the current mode')
      }
    } catch (err) {
      notification.error(err instanceof Error ? err.message : t('git.errors.addWorktreeFailed') || 'Failed to create worktree')
    } finally {
      setBusy(false)
      setProgressStage('')
    }
  }, [view, notification, loadRef, setBusy, setProgressStage, t])

  const handleCheckoutBranch = useCallback(
    async (branchName: string, isRemote = false) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(isRemote ? t('git.operations.checkingOutBranch') || 'Checking out branch...' : t('git.operations.switchingBranch') || 'Switching branch...')
      try {
        const driver = getGitDriver()
        const res = await driver.checkoutBranch(view.repo, branchName, { track: isRemote })
        if (res.ok) {
          notification.success(
            isRemote
              ? t('git.operations.checkoutRemoteSuccess') || 'Checked out branch'
              : t('git.operations.checkoutSuccess', { branch: branchName }) || `Switched to branch ${branchName}`
          )
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || t('git.errors.operationFailed') || 'Operation failed')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : t('git.errors.operationFailed') || 'Operation failed')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage, t]
  )

  const handlePushBranch = useCallback(
    async (branchName: string) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(t('git.operations.pushingBranch', { branch: branchName }) || `Pushing branch ${branchName}...`)
      try {
        const driver = getGitDriver()
        const res = await driver.push(view.repo, { branch: branchName, setUpstream: true })
        if (res.ok) {
          notification.success(t('git.operations.pushSuccess') || res.message || 'Pushed successfully')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || t('git.errors.pushFailed') || 'Push failed')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : t('git.errors.pushFailed') || 'Push failed')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage, t]
  )

  const handlePullBranch = useCallback(
    async (branchName: string) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(t('git.operations.pullingBranch', { branch: branchName }) || `Pulling branch ${branchName}...`)
      try {
        const driver = getGitDriver()
        await driver.fetch(view.repo, { prune: true }).catch(() => {})
        const res = await driver.pull(view.repo, { branch: branchName, ffOnly: true })
        if (res.ok) {
          notification.success(t('git.operations.pullSuccess') || res.message || 'Pulled successfully')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || t('git.errors.pullFailed') || 'Pull failed')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : t('git.errors.pullFailed') || 'Pull failed')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage, t]
  )

  const handleDeleteBranch = useCallback(
    async (branchName: string) => {
      if (!view?.repo) return
      const confirmed = window.confirm(t('git.operations.deleteBranchConfirm', { branch: branchName }) || `Are you sure you want to delete branch ${branchName}?`)
      if (!confirmed) return
      setBusy(true)
      setProgressStage(t('git.operations.deletingBranch', { branch: branchName }) || `Deleting branch ${branchName}...`)
      try {
        const driver = getGitDriver()
        const res = await driver.deleteBranch(view.repo, branchName)
        if (res.ok) {
          notification.success(t('git.operations.deleteBranchSuccess', { branch: branchName }) || res.message || `Deleted branch ${branchName}`)
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || t('git.errors.deleteBranchFailed') || 'Failed to delete branch')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : t('git.errors.deleteBranchFailed') || 'Failed to delete branch')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage, t]
  )

  const handleRenameBranch = useCallback(
    (oldName: string) => {
      if (!oldName) return
      setRenameModal({ open: true, oldName })
    },
    [setRenameModal]
  )

  const executeRenameBranch = useCallback(
    async (oldName: string, newName: string) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(t('git.operations.renamingBranchProgress') || 'Renaming branch...')
      try {
        const driver = getGitDriver()
        const res = await driver.renameBranch(view.repo, oldName, newName.trim())
        if (res.ok) {
          notification.success(t('git.operations.renameBranchSuccess', { branch: newName.trim() }) || res.message || `Renamed branch to ${newName.trim()}`)
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || t('git.errors.renameBranchFailed') || 'Failed to rename branch')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : t('git.errors.renameBranchFailed') || 'Failed to rename branch')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage, t]
  )

  const handleCreateBranch = useCallback(
    (branchNameOrStart?: string, startPoint?: string) => {
      const start = startPoint || (branchNameOrStart && !branchNameOrStart.includes(' ') ? branchNameOrStart : undefined)
      setCreateBranchModal({ open: true, startPoint: start, currentBranch: view?.branch })
    },
    [setCreateBranchModal, view?.branch]
  )

  const executeCreateBranch = useCallback(
    async (name: string, startPoint?: string, checkout = true) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(t('git.operations.creatingBranchProgress', { branch: name.trim() }) || `Creating branch ${name.trim()}...`)
      try {
        const driver = getGitDriver()
        const res = await driver.createBranch(view.repo, name.trim(), startPoint, checkout)
        if (res.ok) {
          notification.success(t('git.operations.createBranchSuccess', { branch: name.trim() }) || res.message || `Created branch ${name.trim()}`)
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || t('git.errors.createBranchFailed') || 'Failed to create branch')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : t('git.errors.createBranchFailed') || 'Failed to create branch')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage, t]
  )

  return {
    handleAddWorktree,
    handleCheckoutBranch,
    handlePushBranch,
    handlePullBranch,
    handleDeleteBranch,
    handleRenameBranch,
    executeRenameBranch,
    handleCreateBranch,
    executeCreateBranch,
  }
}
