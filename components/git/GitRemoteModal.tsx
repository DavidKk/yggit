'use client'

import { useEffect, useState } from 'react'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Modal, TextInput } from '@/components/sk'

interface EditRemoteModalProps {
  open: boolean
  remote: string
  initialUrl?: string
  busy?: boolean
  onClose: () => void
  onSubmit: (oldName: string, newName: string, newUrl: string) => Promise<void> | void
}

export function EditRemoteModal({ open, remote, initialUrl = '', busy = false, onClose, onSubmit }: EditRemoteModalProps) {
  const t = useT()
  const [name, setName] = useState(remote)
  const [url, setUrl] = useState(initialUrl)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(remote)
      setUrl(initialUrl)
      setError('')
    }
  }, [open, remote, initialUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()

    if (!trimmedName) {
      setError(t('git.operations.remoteNameRequired') || '远程源名称不能为空')
      return
    }
    if (/\s/.test(trimmedName)) {
      setError(t('git.operations.remoteNameInvalid') || '远程源名称不能包含空格')
      return
    }
    if (!trimmedUrl) {
      setError(t('git.operations.remoteUrlRequired') || '远程源 URL 不能为空')
      return
    }

    setError('')
    await onSubmit(remote, trimmedName, trimmedUrl)
    onClose()
  }

  const isUnchanged = name.trim() === remote && url.trim() === initialUrl.trim()

  return (
    <Modal
      open={open}
      title={t('git.operations.editRemoteTitle') || '编辑远程源'}
      description={(t('git.operations.editRemoteDesc') || '配置远程源 {remote} 的名称与仓库地址').replace('{remote}', remote)}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink" htmlFor="edit-remote-name-input">
            {t('git.operations.remoteNameLabel') || '远程源名称'}
          </label>
          <TextInput
            id="edit-remote-name-input"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError('')
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink" htmlFor="edit-remote-url-input">
            {t('git.operations.remoteUrlLabel') || '远程源 URL'}
          </label>
          <TextInput
            id="edit-remote-url-input"
            value={url}
            placeholder="https://... 或 git@..."
            onChange={(e) => {
              setUrl(e.target.value)
              if (error) setError('')
            }}
          />
          {error ? <span className="text-xs text-fail">{error}</span> : null}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="plain" type="button" onClick={onClose} disabled={busy}>
            {t('common.cancel') || '取消'}
          </Button>
          <Button variant="accent" type="submit" disabled={busy || !name.trim() || !url.trim() || isUnchanged}>
            {busy ? t('git.operations.savingRemote') || '正在保存…' : t('git.operations.saveRemoteBtn') || '保存'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
