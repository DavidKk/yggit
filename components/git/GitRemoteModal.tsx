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
      setError(t('git.operations.remoteNameRequired') || 'Remote name cannot be empty')
      return
    }
    if (/\s/.test(trimmedName)) {
      setError(t('git.operations.remoteNameInvalid') || 'Remote name cannot contain spaces')
      return
    }
    if (!trimmedUrl) {
      setError(t('git.operations.remoteUrlRequired') || 'Remote URL cannot be empty')
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
      title={t('git.operations.editRemoteTitle') || 'Edit Remote'}
      description={(t('git.operations.editRemoteDesc') || 'Configure name and repository URL for remote {remote}').replace('{remote}', remote)}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink" htmlFor="edit-remote-name-input">
            {t('git.operations.remoteNameLabel') || 'Remote Name'}
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
            {t('git.operations.remoteUrlLabel') || 'Remote URL'}
          </label>
          <TextInput
            id="edit-remote-url-input"
            value={url}
            placeholder="https://... or git@..."
            onChange={(e) => {
              setUrl(e.target.value)
              if (error) setError('')
            }}
          />
          {error ? <span className="text-xs text-fail">{error}</span> : null}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="plain" type="button" onClick={onClose} disabled={busy}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button variant="accent" type="submit" disabled={busy || !name.trim() || !url.trim() || isUnchanged}>
            {busy ? t('git.operations.savingRemote') || 'Saving…' : t('git.operations.saveRemoteBtn') || 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface AddRemoteModalProps {
  open: boolean
  busy?: boolean
  onClose: () => void
  onSubmit: (name: string, pullUrl: string, pushUrl: string) => Promise<void> | void
}

export function AddRemoteModal({ open, busy = false, onClose, onSubmit }: AddRemoteModalProps) {
  const t = useT()
  const [name, setName] = useState('')
  const [pullUrl, setPullUrl] = useState('')
  const [pushUrl, setPushUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName('origin')
      setPullUrl('')
      setPushUrl('')
      setError('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedPull = pullUrl.trim()
    const trimmedPush = pushUrl.trim() || trimmedPull

    if (!trimmedName) {
      setError(t('git.operations.remoteNameRequired') || 'Remote name cannot be empty')
      return
    }
    if (/\s/.test(trimmedName)) {
      setError(t('git.operations.remoteNameInvalid') || 'Remote name cannot contain spaces')
      return
    }
    if (!trimmedPull) {
      setError(t('git.operations.remotePullUrlRequired') || 'Pull URL cannot be empty')
      return
    }

    setError('')
    await onSubmit(trimmedName, trimmedPull, trimmedPush)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={t('git.operations.addRemoteTitle') || 'Add Remote'}
      description={t('git.operations.addRemoteDesc') || 'Configure remote name, fetch URL and push URL'}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink" htmlFor="add-remote-name-input">
            {t('git.operations.remoteNameLabel') || 'Remote Name'}
          </label>
          <TextInput
            id="add-remote-name-input"
            autoFocus
            placeholder="origin"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError('')
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink" htmlFor="add-remote-pull-url-input">
            {t('git.operations.remotePullUrlLabel') || 'PULL URL (Fetch)'}
          </label>
          <TextInput
            id="add-remote-pull-url-input"
            value={pullUrl}
            placeholder="https://... or git@..."
            onChange={(e) => {
              setPullUrl(e.target.value)
              if (error) setError('')
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink" htmlFor="add-remote-push-url-input">
            {t('git.operations.remotePushUrlLabel') || 'PUSH URL (Push)'}
            <span className="ml-1 font-normal text-ink-soft">({t('git.operations.sameAsPullHint') || 'Optional, defaults to PULL URL if empty'})</span>
          </label>
          <TextInput
            id="add-remote-push-url-input"
            value={pushUrl}
            placeholder={pullUrl || 'https://... or git@...'}
            onChange={(e) => {
              setPushUrl(e.target.value)
              if (error) setError('')
            }}
          />
          {error ? <span className="text-xs text-fail">{error}</span> : null}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="plain" type="button" onClick={onClose} disabled={busy}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button variant="accent" type="submit" disabled={busy || !name.trim() || !pullUrl.trim()}>
            {busy ? t('git.operations.addingRemote') || 'Adding…' : t('git.operations.addRemoteBtn') || 'Add Remote'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface SetUpstreamModalProps {
  open: boolean
  branch: string
  availableRemotes?: string[]
  busy?: boolean
  onClose: () => void
  onSubmit: (branch: string, upstream: string) => Promise<void> | void
}

export function SetUpstreamModal({ open, branch, availableRemotes = [], busy = false, onClose, onSubmit }: SetUpstreamModalProps) {
  const t = useT()
  const [upstream, setUpstream] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      const defaultRemote = availableRemotes[0] || 'origin'
      setUpstream(`${defaultRemote}/${branch}`)
      setError('')
    }
  }, [open, branch, availableRemotes])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = upstream.trim()
    if (!trimmed) {
      setError(t('git.operations.upstreamRequired') || 'Upstream branch cannot be empty')
      return
    }
    setError('')
    await onSubmit(branch, trimmed)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={t('git.operations.setUpstreamTitle') || 'Set Upstream Branch'}
      description={(t('git.operations.setUpstreamDesc') || 'Associate local branch {branch} with a remote tracking branch').replace('{branch}', branch)}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink" htmlFor="set-upstream-input">
            {t('git.operations.upstreamLabel') || 'Remote Branch (Upstream)'}
          </label>
          <TextInput
            id="set-upstream-input"
            autoFocus
            value={upstream}
            placeholder="origin/main"
            onChange={(e) => {
              setUpstream(e.target.value)
              if (error) setError('')
            }}
          />
          {error ? <span className="text-xs text-fail">{error}</span> : null}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="plain" type="button" onClick={onClose} disabled={busy}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button variant="accent" type="submit" disabled={busy || !upstream.trim()}>
            {busy ? t('git.operations.settingUpstream') || 'Setting…' : t('git.operations.setUpstreamBtn') || 'Confirm Upstream'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
