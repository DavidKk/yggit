'use client'

import Link from 'next/link'
import { type Dispatch, type SetStateAction } from 'react'
import { LuFileClock, LuFingerprint, LuFolderGit2, LuX } from 'react-icons/lu'

import { CreateBranchModal, RenameBranchModal } from '@/components/git/GitBranchModal'
import { GitFileBlameView } from '@/components/git/GitFileBlameView'
import { GitFileHistoryView } from '@/components/git/GitFileHistoryView'
import type { useT } from '@/components/i18n/LocaleProvider'
import { Button, EmptyState, Spinner, Tooltip } from '@/components/sk'
import { useModeHref } from '@/lib/git/driver'

export function GitLogFilePanel({
  repo,
  filePanel,
  selectedHash,
  onToggleType,
  onClose,
  onLocateCommit,
  t,
}: {
  repo: string
  filePanel: { type: 'history' | 'blame'; path: string; hash?: string }
  selectedHash?: string
  onToggleType: () => void
  onClose: () => void
  onLocateCommit: (hash: string) => void
  t: ReturnType<typeof useT>
}) {
  const lastSlash = filePanel.path.lastIndexOf('/')
  const dirPrefix = lastSlash >= 0 ? filePanel.path.slice(0, lastSlash + 1) : ''
  const fileName = lastSlash >= 0 ? filePanel.path.slice(lastSlash + 1) : filePanel.path

  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-line bg-panel px-3">
        <div className="flex min-w-0 items-center gap-2">
          {filePanel.type === 'history' ? (
            <LuFileClock className="size-4 shrink-0 text-accent" aria-hidden />
          ) : (
            <LuFingerprint className="size-4 shrink-0 text-accent" aria-hidden />
          )}
          <h2 className="m-0 flex min-w-0 items-center text-xs text-ink" title={filePanel.path}>
            {dirPrefix ? <span className="truncate text-ink-soft/70 select-none">{dirPrefix}</span> : null}
            <span className="shrink-0 font-semibold text-ink">{fileName}</span>
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content={filePanel.type === 'history' ? t('git.operations.fileBlame') || '文件追溯' : t('git.operations.fileHistory') || '文件历史'}>
            <Button
              variant="plain"
              size="icon"
              className="size-7 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-ink cursor-pointer"
              aria-label={filePanel.type === 'history' ? t('git.operations.fileBlame') || 'File Blame' : t('git.operations.fileHistory') || 'File History'}
              onClick={onToggleType}
            >
              {filePanel.type === 'history' ? <LuFingerprint className="size-3.5 text-ink-soft hover:text-accent" /> : <LuFileClock className="size-3.5 text-accent" />}
            </Button>
          </Tooltip>
          <Button variant="plain" size="icon" className="size-7" aria-label={t('common.close')} onClick={onClose}>
            <LuX className="size-3.5" aria-hidden />
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {filePanel.type === 'history' ? (
          <GitFileHistoryView repo={repo} path={filePanel.path} currentHash={filePanel.hash || selectedHash} onLocateCommit={onLocateCommit} />
        ) : (
          <GitFileBlameView repo={repo} path={filePanel.path} hash={filePanel.hash || selectedHash} onLocateCommit={onLocateCommit} />
        )}
      </div>
    </section>
  )
}

export function GitLogBlockingOverlay({ busy, progressStage, t }: { busy: boolean; progressStage: string; t: ReturnType<typeof useT> }) {
  if (!busy) return null
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('git.page.switchingProject')}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper/60 backdrop-blur-xs select-none cursor-wait transition-opacity duration-200"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-line/80 bg-panel/95 px-7 py-6 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 min-w-[280px]">
        <Spinner className="size-8 text-accent" />
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="text-sm font-semibold text-ink">{t('git.page.switchingProject')}</span>
          <span className="text-xs text-accent font-medium transition-all duration-200">{progressStage || t('git.page.switchingProjectHint')}</span>
        </div>
      </div>
    </div>
  )
}

export function GitSettingsLink({ className, label, onBeforeNavigate }: { className: string; label: string; onBeforeNavigate: () => void }) {
  const modeHref = useModeHref()
  return (
    <Tooltip content={label} placement="bottom">
      <Link href={modeHref('/settings/models')} onClick={onBeforeNavigate} className={className} aria-label={label}>
        {label}
      </Link>
    </Tooltip>
  )
}

export function GitLogNoRepoState({ error, onChooseFolder, onOpenMenu, t }: { error: string; onChooseFolder: () => void; onOpenMenu: () => void; t: ReturnType<typeof useT> }) {
  const isPermError = Boolean(error && (error.includes('RESOURCE_UNRESOLVED') || error.includes('PERMISSION_REQUIRED')))
  return (
    <EmptyState
      title={error ? (isPermError ? t('git.page.permissionRequired') : t('git.page.repoUnreadable')) : t('git.page.noProject')}
      message={error ? (isPermError ? t('git.page.permissionRequiredHint') : error) : t('git.page.noProjectMessage')}
      hint={error ? t('git.page.repoUnreadableHint') : t('git.page.noProjectHint')}
    >
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button variant="accent" size="md" onClick={onChooseFolder}>
          <LuFolderGit2 className="size-4" aria-hidden />
          {error && isPermError ? t('git.project.reauthorizeLocal') : t('git.project.addLocal')}
        </Button>
        <Button variant="default" size="md" onClick={onOpenMenu}>
          {t('git.project.switcher')}
        </Button>
      </div>
    </EmptyState>
  )
}

export function GitLogBranchModals({
  renameModal,
  setRenameModal,
  executeRenameBranch,
  createBranchModal,
  setCreateBranchModal,
  executeCreateBranch,
  busy,
}: {
  renameModal: { open: boolean; oldName: string }
  setRenameModal: Dispatch<SetStateAction<{ open: boolean; oldName: string }>>
  executeRenameBranch: (oldName: string, newName: string) => Promise<void>
  createBranchModal: { open: boolean; startPoint?: string; currentBranch?: string }
  setCreateBranchModal: Dispatch<SetStateAction<{ open: boolean; startPoint?: string; currentBranch?: string }>>
  executeCreateBranch: (name: string, startPoint?: string, checkout?: boolean) => Promise<void>
  busy: boolean
}) {
  return (
    <>
      <RenameBranchModal
        open={renameModal.open}
        oldName={renameModal.oldName}
        busy={busy}
        onClose={() => setRenameModal({ open: false, oldName: '' })}
        onSubmit={executeRenameBranch}
      />
      <CreateBranchModal
        open={createBranchModal.open}
        startPoint={createBranchModal.startPoint}
        currentBranch={createBranchModal.currentBranch}
        busy={busy}
        onClose={() => setCreateBranchModal({ open: false })}
        onSubmit={executeCreateBranch}
      />
    </>
  )
}
