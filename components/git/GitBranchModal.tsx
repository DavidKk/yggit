'use client'

import { useState } from 'react'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Modal, TextInput } from '@/components/sk'

interface CreateBranchModalProps {
  open: boolean
  startPoint?: string
  currentBranch?: string
  busy?: boolean
  onClose: () => void
  onSubmit: (branchName: string, startPoint?: string, checkout?: boolean) => Promise<void> | void
}

export function CreateBranchModal({ open, startPoint, currentBranch, busy = false, onClose, onSubmit }: CreateBranchModalProps) {
  const t = useT()
  const [branchName, setBranchName] = useState('')
  const [checkout, setCheckout] = useState(true)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = branchName.trim()
    if (!trimmed) {
      setError(t('git.operations.branchNameRequired') || '分支名称不能为空')
      return
    }
    if (/\s/.test(trimmed) || trimmed.startsWith('-')) {
      setError(t('git.operations.branchNameInvalid') || '无效的分支名称格式')
      return
    }
    setError('')
    await onSubmit(trimmed, startPoint, checkout)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={t('git.operations.createBranchTitle') || '创建分支'}
      description={
        startPoint
          ? (t('git.operations.createDescCommit') || '基于提交 {commit} 创建新分支').replace('{commit}', startPoint.slice(0, 7))
          : currentBranch
            ? (t('git.operations.createDescBranch') || '基于当前分支 {branch} 创建新分支').replace('{branch}', currentBranch)
            : undefined
      }
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink" htmlFor="create-branch-name-input">
            {t('git.operations.branchNamePlaceholder') || '分支名称 (例如: feat/login)'}
          </label>
          <TextInput
            id="create-branch-name-input"
            autoFocus
            value={branchName}
            placeholder="feature/your-branch-name"
            onChange={(e) => {
              setBranchName(e.target.value)
              if (error) setError('')
            }}
          />
          {error ? <span className="text-xs text-fail">{error}</span> : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2 select-none text-xs text-ink">
          <input type="checkbox" checked={checkout} onChange={(e) => setCheckout(e.target.checked)} className="rounded border-line text-accent focus:ring-accent" />
          <span>{t('git.operations.checkoutNewBranch') || '立即切换到新分支'}</span>
        </label>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="plain" type="button" onClick={onClose} disabled={busy}>
            {t('common.cancel') || '取消'}
          </Button>
          <Button variant="accent" type="submit" disabled={busy || !branchName.trim()}>
            {busy ? t('git.operations.creatingBranch') || '正在创建…' : t('git.operations.createBranchBtn') || '创建分支'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface RenameBranchModalProps {
  open: boolean
  oldName: string
  busy?: boolean
  onClose: () => void
  onSubmit: (oldName: string, newName: string) => Promise<void> | void
}

export function RenameBranchModal({ open, oldName, busy = false, onClose, onSubmit }: RenameBranchModalProps) {
  const t = useT()
  const [newName, setNewName] = useState(oldName)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) {
      setError(t('git.operations.branchNameRequired') || '分支名称不能为空')
      return
    }
    if (trimmed === oldName) {
      onClose()
      return
    }
    if (/\s/.test(trimmed) || trimmed.startsWith('-')) {
      setError(t('git.operations.branchNameInvalid') || '无效的分支名称格式')
      return
    }
    setError('')
    await onSubmit(oldName, trimmed)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={t('git.operations.renameBranchTitle') || '重命名分支'}
      description={(t('git.operations.renameDesc') || '将分支 {branch} 重命名为：').replace('{branch}', oldName)}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink" htmlFor="rename-branch-name-input">
            {t('git.operations.newBranchName') || '新分支名称'}
          </label>
          <TextInput
            id="rename-branch-name-input"
            autoFocus
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              if (error) setError('')
            }}
          />
          {error ? <span className="text-xs text-fail">{error}</span> : null}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="plain" type="button" onClick={onClose} disabled={busy}>
            {t('common.cancel') || '取消'}
          </Button>
          <Button variant="accent" type="submit" disabled={busy || !newName.trim() || newName.trim() === oldName}>
            {busy ? t('git.operations.renamingBranch') || '正在重命名…' : t('git.operations.renameBranchBtn') || '重命名'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
