'use client'

import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from 'react'

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
  const handleAddWorktree = useCallback(async () => {
    if (!view?.repo) return
    const defaultWt = `../${view.repo.split(/[/\\]/).filter(Boolean).pop()}_wt`
    const inputPath = window.prompt('请输入新 Worktree 目录路径（支持相对当前仓库或绝对路径）：', defaultWt)
    if (!inputPath || !inputPath.trim()) return
    const branch = window.prompt('请输入关联的分支名称（可选，留空则默认当前分支）：') || undefined
    setBusy(true)
    setProgressStage('正在创建 Worktree...')
    try {
      const driver = getGitDriver()
      if (driver.addWorktree) {
        const res = await driver.addWorktree(view.repo, inputPath.trim(), branch?.trim())
        if (res.ok) {
          notification.success(res.message || 'Worktree 创建成功')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '创建 Worktree 失败')
        }
      } else {
        notification.error('当前模式不支持创建 Worktree')
      }
    } catch (err) {
      notification.error(err instanceof Error ? err.message : '创建 Worktree 失败')
    } finally {
      setBusy(false)
      setProgressStage('')
    }
  }, [view, notification, loadRef, setBusy, setProgressStage])

  const handleCheckoutBranch = useCallback(
    async (branchName: string, isRemote = false) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(isRemote ? '正在检出分支...' : '正在切换分支...')
      try {
        const driver = getGitDriver()
        const res = await driver.checkoutBranch(view.repo, branchName, { track: isRemote })
        if (res.ok) {
          notification.success(res.message || (isRemote ? '检出分支成功' : '切换分支成功'))
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '操作失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '操作失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage]
  )

  const handlePushBranch = useCallback(
    async (branchName: string) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(`正在推送分支 ${branchName}...`)
      try {
        const driver = getGitDriver()
        const res = await driver.push(view.repo, { branch: branchName, setUpstream: true })
        if (res.ok) {
          notification.success(res.message || '推送成功')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '推送失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '推送失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage]
  )

  const handlePullBranch = useCallback(
    async (branchName: string) => {
      if (!view?.repo) return
      setBusy(true)
      setProgressStage(`正在拉取分支 ${branchName}...`)
      try {
        const driver = getGitDriver()
        await driver.fetch(view.repo, { prune: true }).catch(() => {})
        const res = await driver.pull(view.repo, { branch: branchName, ffOnly: true })
        if (res.ok) {
          notification.success(res.message || '拉取成功')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '拉取失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '拉取失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage]
  )

  const handleDeleteBranch = useCallback(
    async (branchName: string) => {
      if (!view?.repo) return
      const confirmed = window.confirm(`确定要删除分支 "${branchName}" 吗？`)
      if (!confirmed) return
      setBusy(true)
      setProgressStage(`正在删除分支 ${branchName}...`)
      try {
        const driver = getGitDriver()
        const res = await driver.deleteBranch(view.repo, branchName)
        if (res.ok) {
          notification.success(res.message || '已删除分支')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '删除失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '删除失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage]
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
      setProgressStage(`正在重命名分支...`)
      try {
        const driver = getGitDriver()
        const res = await driver.renameBranch(view.repo, oldName, newName.trim())
        if (res.ok) {
          notification.success(res.message || '重命名成功')
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '重命名失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '重命名失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage]
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
      setProgressStage(`正在创建分支 ${name.trim()}...`)
      try {
        const driver = getGitDriver()
        const res = await driver.createBranch(view.repo, name.trim(), startPoint, checkout)
        if (res.ok) {
          notification.success(res.message || `已创建分支 ${name.trim()}`)
          await loadRef.current(view.repo)
        } else {
          notification.error(res.message || '创建分支失败')
        }
      } catch (err) {
        notification.error(err instanceof Error ? err.message : '创建分支失败')
      } finally {
        setBusy(false)
        setProgressStage('')
      }
    },
    [view, notification, loadRef, setBusy, setProgressStage]
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
