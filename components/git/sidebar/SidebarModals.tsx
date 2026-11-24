'use client'

import React, { useState } from 'react'
import { LuCircleAlert, LuGitBranch } from 'react-icons/lu'

import { AddRemoteModal, EditRemoteModal, SetUpstreamModal } from '@/components/git/GitRemoteModal'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Modal } from '@/components/sk'
import { getGitDriver } from '@/lib/git/driver'
import type { GitLogView } from '@/lib/git/types'

export interface SidebarModalsProps {
  view: GitLogView
  onRefresh?: () => Promise<void> | void
  notify: {
    success: (msg: string) => void
    error: (msg: string) => void
    info: (msg: string) => void
  }
  deleteFolderModal: {
    open: boolean
    folderLabel: string
    branchesToDelete: string[]
    skippedCurrentBranch: string | null
  } | null
  setDeleteFolderModal: (
    v: {
      open: boolean
      folderLabel: string
      branchesToDelete: string[]
      skippedCurrentBranch: string | null
    } | null
  ) => void
  editRemoteState: { open: boolean; remote: string; url: string }
  setEditRemoteState: React.Dispatch<React.SetStateAction<{ open: boolean; remote: string; url: string }>>
  addRemoteOpen: boolean
  setAddRemoteOpen: (open: boolean) => void
  setUpstreamBranch: string | null
  setSetUpstreamBranch: (branch: string | null) => void
}

export function SidebarModals({
  view,
  onRefresh,
  notify,
  deleteFolderModal,
  setDeleteFolderModal,
  editRemoteState,
  setEditRemoteState,
  addRemoteOpen,
  setAddRemoteOpen,
  setUpstreamBranch,
  setSetUpstreamBranch,
}: SidebarModalsProps) {
  const t = useT()
  const [deletingFolderBranches, setDeletingFolderBranches] = useState(false)
  const [editRemoteBusy, setEditRemoteBusy] = useState(false)
  const [addRemoteBusy, setAddRemoteBusy] = useState(false)
  const [setUpstreamBusy, setSetUpstreamBusy] = useState(false)

  const handleConfirmDeleteFolderBranches = async () => {
    if (!deleteFolderModal || deletingFolderBranches) return
    setDeletingFolderBranches(true)
    const { branchesToDelete } = deleteFolderModal
    const driver = getGitDriver()
    let successCount = 0
    let failedCount = 0

    for (const b of branchesToDelete) {
      try {
        await driver.deleteBranch(view.repo, b, true)
        successCount++
      } catch {
        failedCount++
      }
    }

    setDeletingFolderBranches(false)
    setDeleteFolderModal(null)

    if (successCount > 0) {
      notify.success(t('git.operations.deleteFolderBranchesSuccess', { count: successCount }) || `Successfully deleted ${successCount} branch${successCount > 1 ? 'es' : ''}`)
      await onRefresh?.()
    }
    if (failedCount > 0) {
      notify.error(t('git.operations.deleteFolderBranchesPartialFail', { count: failedCount }) || `Failed to delete ${failedCount} branch${failedCount > 1 ? 'es' : ''}`)
    }
  }

  const handleSaveRemote = async (oldName: string, newName: string, newUrl: string) => {
    setEditRemoteBusy(true)
    try {
      const driver = getGitDriver()
      if (newUrl !== editRemoteState.url) {
        await driver.setRemoteUrl(view.repo, oldName, newUrl)
      }
      if (newName !== oldName) {
        await driver.renameRemote(view.repo, oldName, newName)
      }
      notify.success(t('git.operations.editRemoteSuccess', { remote: newName }) || `Successfully updated remote ${newName}`)
      setEditRemoteState({ open: false, remote: '', url: '' })
      await onRefresh?.()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to update remote')
    } finally {
      setEditRemoteBusy(false)
    }
  }

  const handleAddRemote = async (name: string, pullUrl: string, pushUrl: string) => {
    setAddRemoteBusy(true)
    try {
      const driver = getGitDriver()
      const res = await driver.addRemote(view.repo, name, pullUrl, pushUrl)
      if (!res.ok) throw new Error(res.message || 'Failed to add remote')
      notify.success(t('git.operations.remoteAdded', { name }) || `Successfully added remote ${name}`)
      setAddRemoteOpen(false)
      await onRefresh?.()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to add remote')
    } finally {
      setAddRemoteBusy(false)
    }
  }

  const handleSetUpstream = async (branch: string, upstream: string) => {
    setSetUpstreamBusy(true)
    try {
      const res = await fetch('/api/git/remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: view.repo, action: 'setUpstream', branch, upstream }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Failed to set upstream branch')
      notify.success(t('git.operations.upstreamSet', { branch, upstream }) || `Successfully set upstream for ${branch} to ${upstream}`)
      setSetUpstreamBranch(null)
      await onRefresh?.()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to set upstream branch')
    } finally {
      setSetUpstreamBusy(false)
    }
  }

  return (
    <>
      {deleteFolderModal?.open ? (
        <Modal
          open={deleteFolderModal.open}
          title={t('git.operations.deleteFolderBranchesConfirmTitle') || 'Delete Folder Branches'}
          description={
            t('git.operations.deleteFolderBranchesConfirmDesc', {
              folder: deleteFolderModal.folderLabel,
              count: deleteFolderModal.branchesToDelete.length,
            }) || `Are you sure you want to delete ${deleteFolderModal.branchesToDelete.length} local branches in "${deleteFolderModal.folderLabel}"? This action cannot be undone.`
          }
          onClose={() => {
            if (!deletingFolderBranches) setDeleteFolderModal(null)
          }}
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="plain" size="md" disabled={deletingFolderBranches} onClick={() => setDeleteFolderModal(null)}>
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button variant="fail" size="md" loading={deletingFolderBranches} onClick={() => void handleConfirmDeleteFolderBranches()}>
                {t('git.operations.confirmDeleteCount', { count: deleteFolderModal.branchesToDelete.length }) || `Delete ${deleteFolderModal.branchesToDelete.length} branches`}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 py-1">
            {deleteFolderModal.skippedCurrentBranch ? (
              <div className="flex items-center gap-2 rounded border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
                <LuCircleAlert className="size-4 shrink-0 text-warn" />
                <span>
                  {t('git.operations.deleteFolderBranchesSkippedCurrent', {
                    branch: deleteFolderModal.skippedCurrentBranch,
                  }) || `Current branch "${deleteFolderModal.skippedCurrentBranch}" will be skipped and not deleted.`}
                </span>
              </div>
            ) : null}
            <div className="text-xs text-ink-soft">{t('git.operations.branchesToBeDeleted') || 'Branches to be deleted:'}</div>
            <div className="max-h-48 overflow-y-auto rounded border border-line bg-surface-panel p-2 flex flex-col gap-1">
              {deleteFolderModal.branchesToDelete.map((b) => (
                <div key={b} className="flex items-center gap-1.5 text-xs text-fail font-mono">
                  <LuGitBranch className="size-3.5 shrink-0" />
                  <span className="truncate">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
      <EditRemoteModal
        open={editRemoteState.open}
        remote={editRemoteState.remote}
        initialUrl={editRemoteState.url}
        busy={editRemoteBusy}
        onClose={() => setEditRemoteState({ open: false, remote: '', url: '' })}
        onSubmit={handleSaveRemote}
      />
      <AddRemoteModal open={addRemoteOpen} busy={addRemoteBusy} onClose={() => setAddRemoteOpen(false)} onSubmit={handleAddRemote} />
      {setUpstreamBranch && (
        <SetUpstreamModal
          open={Boolean(setUpstreamBranch)}
          branch={setUpstreamBranch}
          availableRemotes={view.remotes.map((r) => r.remote)}
          busy={setUpstreamBusy}
          onClose={() => setSetUpstreamBranch(null)}
          onSubmit={handleSetUpstream}
        />
      )}
    </>
  )
}
