'use client'

import type { Dispatch, DragEvent, MouseEvent, MutableRefObject, RefObject, SetStateAction } from 'react'
import { LuCloud, LuX } from 'react-icons/lu'
import { TbCloudLock } from 'react-icons/tb'

import { AddRemoteModal } from '@/components/git/GitRemoteModal'
import type { useT } from '@/components/i18n/LocaleProvider'
import { formControl, formDesc, formField, formFieldInlineDense, formTitle, formTitleInline } from '@/components/layoutClasses'
import { ApiKeyInput, Button, Modal, SwitchToggle, TextInput, Tooltip } from '@/components/sk'
import { getGitDriver } from '@/lib/git/driver'
import { remoteIdentity, type ResolvedRemoteSource } from '@/lib/git/project-access'
import type { GitProjectView } from '@/lib/git/types'
import { cn } from '@/lib/utils'

type TFn = ReturnType<typeof useT>

export type RemotesMenuAnchor = {
  projectId: string
  rect: DOMRect
  remotes: ResolvedRemoteSource[]
}

export function RemotesListPopover({
  remotesMenuAnchor,
  setRemotesMenuAnchor,
  t,
}: {
  remotesMenuAnchor: RemotesMenuAnchor
  setRemotesMenuAnchor: Dispatch<SetStateAction<RemotesMenuAnchor | null>>
  t: TFn
}) {
  return (
    <div
      data-remotes-popover="true"
      style={{
        position: 'fixed',
        top: remotesMenuAnchor.rect.bottom + 4,
        left: Math.max(12, Math.min(typeof window !== 'undefined' ? window.innerWidth - 268 : 300, remotesMenuAnchor.rect.right - 240)),
        zIndex: 9999,
      }}
      className="w-64 rounded-xl border border-line bg-panel p-1.5 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between border-b border-line px-2 py-1 text-[0.68rem] font-semibold text-ink-soft">
        <span>{t('git.project.remotesListTitle', { count: remotesMenuAnchor.remotes.length }) || `Remote list (${remotesMenuAnchor.remotes.length})`}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setRemotesMenuAnchor(null)
          }}
          className="flex size-4 cursor-pointer items-center justify-center rounded text-ink-soft hover:text-ink"
          aria-label={t('common.close') || 'Close'}
        >
          <LuX className="size-3" />
        </button>
      </div>
      <div className="mt-1 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
        {remotesMenuAnchor.remotes.map((remote) => (
          <Tooltip key={remote.url} content={t('git.project.openWebUrl', { url: remote.webUrl }) || `Open in browser: ${remote.webUrl}`} placement="left">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setRemotesMenuAnchor(null)
                window.open(remote.webUrl, '_blank')
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md p-1.5 text-left text-xs transition-colors hover:bg-[var(--overlay-08)] hover:text-accent"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {remote.isPrivate ? (
                  <TbCloudLock className="size-4 shrink-0 text-warn" aria-label={t('git.project.privateRemote') || 'Private remote'} />
                ) : (
                  <LuCloud className="size-4 shrink-0 text-accent" aria-label={t('git.project.publicRemote') || 'Public remote'} />
                )}
                <div className="min-w-0 flex-1">
                  <span className="truncate font-mono font-medium text-xs text-ink block">{remote.name}</span>
                  <div className="truncate font-mono text-[0.68rem] text-ink-soft">{remote.webUrl.replace(/^https?:\/\//, '')}</div>
                </div>
              </div>
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}

export function ProjectMenuModals({
  busy,
  t,
  notify,
  currentPath,
  folders,
  onOpen,
  onClone,
  onRefreshProjects,
  folderOpen,
  closeFolderModal,
  submitFolder,
  folderId,
  folderRef,
  folderName,
  setFolderName,
  folderComposingRef,
  remoteOpen,
  closeRemoteModal,
  submitRemote,
  importGroup,
  setImportGroup,
  syncAccount,
  setSyncAccount,
  urlId,
  urlRef,
  remoteUrl,
  setRemoteUrl,
  tokenId,
  tokenUnlocked,
  setTokenUnlocked,
  token,
  setToken,
  groupProvider,
  setGroupProvider,
  targetFolder,
  setTargetFolder,
  syncId,
  cloneTarget,
  setCloneTarget,
  setRemoteOpen,
  bindingRemoteProject,
  setBindingRemoteProject,
  bindRemoteBusy,
  setBindRemoteBusy,
  fieldInvalid,
  setFieldInvalid,
  formError,
  setFormError,
  formErrorId,
}: {
  busy: boolean
  t: TFn
  notify: { success: (msg: string) => void; error: (msg: string) => void }
  currentPath: string
  folders: string[]
  onOpen: (path: string) => void
  onClone: (project: GitProjectView) => Promise<string>
  onRefreshProjects?: () => Promise<void> | void
  folderOpen: boolean
  closeFolderModal: () => void
  submitFolder: () => Promise<void>
  folderId: string
  folderRef: RefObject<HTMLInputElement | null>
  folderName: string
  setFolderName: Dispatch<SetStateAction<string>>
  folderComposingRef: MutableRefObject<boolean>
  remoteOpen: boolean
  closeRemoteModal: () => void
  submitRemote: () => Promise<void>
  importGroup: boolean
  setImportGroup: Dispatch<SetStateAction<boolean>>
  syncAccount: boolean
  setSyncAccount: Dispatch<SetStateAction<boolean>>
  urlId: string
  urlRef: RefObject<HTMLInputElement | null>
  remoteUrl: string
  setRemoteUrl: Dispatch<SetStateAction<string>>
  tokenId: string
  tokenUnlocked: boolean
  setTokenUnlocked: Dispatch<SetStateAction<boolean>>
  token: string
  setToken: Dispatch<SetStateAction<string>>
  groupProvider: 'github' | 'gitlab'
  setGroupProvider: Dispatch<SetStateAction<'github' | 'gitlab'>>
  targetFolder: string
  setTargetFolder: Dispatch<SetStateAction<string>>
  syncId: string
  cloneTarget: GitProjectView | null
  setCloneTarget: Dispatch<SetStateAction<GitProjectView | null>>
  setRemoteOpen: Dispatch<SetStateAction<boolean>>
  bindingRemoteProject: GitProjectView | null
  setBindingRemoteProject: Dispatch<SetStateAction<GitProjectView | null>>
  bindRemoteBusy: boolean
  setBindRemoteBusy: Dispatch<SetStateAction<boolean>>
  fieldInvalid: { folder?: boolean; url?: boolean; token?: boolean }
  setFieldInvalid: Dispatch<SetStateAction<{ folder?: boolean; url?: boolean; token?: boolean }>>
  formError: string
  setFormError: Dispatch<SetStateAction<string>>
  formErrorId: string
}) {
  return (
    <>
      <Modal
        open={folderOpen}
        title={t('git.project.newFolderTitle')}
        busy={busy}
        onClose={closeFolderModal}
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={closeFolderModal}>
              {t('common.cancel')}
            </Button>
            <Button variant="accent" loading={busy} onClick={() => void submitFolder()}>
              {t('git.project.create')}
            </Button>
          </>
        }
      >
        <div className={formField}>
          <label className={formTitle} htmlFor={folderId}>
            {t('git.project.name')}
          </label>
          <p className={formDesc}>{t('git.project.newFolderDesc')}</p>
          <div className={formControl}>
            <TextInput
              ref={folderRef}
              id={folderId}
              fullWidth
              placeholder={t('git.project.namePlaceholder')}
              invalid={fieldInvalid.folder}
              value={folderName}
              onChange={(event) => {
                setFolderName(event.target.value)
                if (fieldInvalid.folder) setFieldInvalid({})
              }}
              onCompositionStart={() => {
                folderComposingRef.current = true
              }}
              onCompositionEnd={() => {
                setTimeout(() => {
                  folderComposingRef.current = false
                }, 50)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  if (event.nativeEvent.isComposing || event.keyCode === 229 || folderComposingRef.current) {
                    return
                  }
                  event.preventDefault()
                  void submitFolder()
                }
              }}
            />
          </div>
          {formError && folderOpen ? (
            <p className="m-0 text-xs text-fail" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      </Modal>
      <Modal
        open={remoteOpen}
        title={t(importGroup ? 'git.project.addRemoteGroup' : 'git.project.addRemoteTitle')}
        description={t(importGroup ? 'git.project.remoteGroupDesc' : 'git.project.addRemoteDesc')}
        busy={busy}
        onClose={closeRemoteModal}
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={closeRemoteModal}>
              {t('common.cancel')}
            </Button>
            <Button variant="accent" loading={busy} onClick={() => void submitRemote()}>
              {importGroup ? t('git.project.importGroup') : syncAccount ? t('git.project.syncAndAdd') : t('git.project.add')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className={formField}>
            <label className={formTitle} htmlFor={urlId}>
              {t(importGroup ? 'git.project.groupUrl' : 'git.project.repoUrl')}
            </label>
            {!importGroup && <p className={formDesc}>{t('git.project.repoUrlHint')}</p>}
            <div className={formControl}>
              <TextInput
                ref={urlRef}
                id={urlId}
                placeholder={
                  importGroup ? (groupProvider === 'github' ? 'https://github.com/organization' : 'https://gitlab.com/group/subgroup') : 'https://gitlab.com/group/repo.git'
                }
                fullWidth
                spellCheck={false}
                invalid={fieldInvalid.url}
                aria-describedby={formError && fieldInvalid.url ? formErrorId : undefined}
                value={remoteUrl}
                onChange={(event) => {
                  setRemoteUrl(event.target.value)
                  if (fieldInvalid.url) setFieldInvalid((prev) => ({ ...prev, url: false }))
                }}
              />
            </div>
          </div>
          <div className={formField}>
            <label className={formTitle} htmlFor={tokenId}>
              {t('git.project.accessToken')}
            </label>
            <p className={formDesc}>{t('git.project.tokenHint')}</p>
            <div className={formControl}>
              <ApiKeyInput
                id={tokenId}
                configured={false}
                unlocked={tokenUnlocked}
                onUnlockedChange={setTokenUnlocked}
                placeholder={t('git.project.tokenPlaceholder') || 'GitLab / GitHub token'}
                invalid={fieldInvalid.token}
                aria-describedby={formError && fieldInvalid.token ? formErrorId : undefined}
                value={token}
                onChange={(value) => {
                  setToken(value)
                  if (fieldInvalid.token) setFieldInvalid((prev) => ({ ...prev, token: false }))
                }}
                disabled={busy}
              />
            </div>
          </div>
          {importGroup && (
            <>
              <label className="grid gap-1.5 text-xs">
                {t('git.project.provider')}
                <select
                  className="h-8 rounded-md border border-line bg-panel px-2"
                  value={groupProvider}
                  onChange={(event) => setGroupProvider(event.target.value as 'github' | 'gitlab')}
                  disabled={busy}
                >
                  <option value="gitlab">GitLab</option>
                  <option value="github">GitHub</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs">
                {t('git.project.targetFolder')}
                <TextInput
                  fullWidth
                  list={`${urlId}-folders`}
                  value={targetFolder}
                  onChange={(event) => setTargetFolder(event.target.value)}
                  disabled={busy}
                  invalid={fieldInvalid.folder}
                />
                <datalist id={`${urlId}-folders`}>
                  {folders.map((folder) => (
                    <option key={folder} value={folder} />
                  ))}
                </datalist>
              </label>
            </>
          )}
          {!importGroup && (
            <div className={cn(formFieldInlineDense, 'grid-cols-[minmax(0,1fr)_auto]')}>
              <label className={formTitleInline} htmlFor={syncId}>
                {t('git.project.syncAccount')}
              </label>
              <div className="col-start-2 row-span-1 row-start-1 flex items-center justify-end">
                <SwitchToggle id={syncId} checked={syncAccount} onCheckedChange={setSyncAccount} disabled={busy} aria-label={t('git.project.syncAccount')} />
              </div>
            </div>
          )}
          {formError && remoteOpen ? (
            <p id={formErrorId} className="m-0 text-xs text-fail" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      </Modal>
      <Modal
        open={Boolean(cloneTarget)}
        title={cloneTarget ? t('git.project.cloneTitle', { name: cloneTarget.name }) : t('git.project.clone')}
        description={cloneTarget?.authorized ? t('git.project.cloneAuthorizedDesc') : t('git.project.clonePublicDesc')}
        busy={busy}
        onClose={() => {
          setCloneTarget(null)
          setFormError('')
        }}
        footer={
          <>
            {!cloneTarget?.authorized ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setCloneTarget(null)
                  setFormError('')
                  setImportGroup(false)
                  setRemoteUrl(cloneTarget?.httpsUrl || '')
                  setRemoteOpen(true)
                }}
              >
                {t('git.project.authorize')}
              </Button>
            ) : null}
            <Button
              variant="accent"
              loading={busy}
              onClick={() => {
                if (!cloneTarget) return
                void onClone(cloneTarget).then((message) => {
                  if (!message) {
                    setCloneTarget(null)
                    setFormError('')
                  } else setFormError(message)
                })
              }}
            >
              {t('git.project.pickFolderClone')}
            </Button>
          </>
        }
      >
        {formError && cloneTarget ? (
          <p className="m-0 text-xs text-fail" role="alert">
            {formError}
          </p>
        ) : null}
      </Modal>
      {bindingRemoteProject && (
        <AddRemoteModal
          open={Boolean(bindingRemoteProject)}
          busy={bindRemoteBusy}
          onClose={() => setBindingRemoteProject(null)}
          onSubmit={async (name, pullUrl, pushUrl) => {
            setBindRemoteBusy(true)
            try {
              const repo = bindingRemoteProject.localPath || bindingRemoteProject.id
              const driver = getGitDriver()
              const res = await driver.addRemote(repo, name, pullUrl, pushUrl)
              if (!res.ok) throw new Error(res.message || t('git.operations.addRemoteFail') || 'Failed to add remote')
              notify.success(t('git.operations.remoteAdded', { name }) || `Successfully added remote ${name}`)
              setBindingRemoteProject(null)
              await onRefreshProjects?.()
              if (repo === currentPath || remoteIdentity(repo) === remoteIdentity(currentPath)) {
                onOpen(currentPath)
              }
            } catch (err) {
              notify.error(err instanceof Error ? err.message : t('git.operations.addRemoteFail') || 'Failed to add remote')
            } finally {
              setBindRemoteBusy(false)
            }
          }}
        />
      )}
    </>
  )
}

export type DropHandlerArgs = {
  onProjectDragOver: (event: DragEvent<HTMLElement>, group: string, beforeId: string) => void
  commitDrop: (event: DragEvent<HTMLElement>, target?: { group: string; beforeId: string | null }) => Promise<void>
  onProjectDragStart: (event: DragEvent<HTMLElement>, id: string) => void
  onProjectDragEnd: () => void
  onProjectContextMenu: (e: MouseEvent, project: GitProjectView) => void
}
