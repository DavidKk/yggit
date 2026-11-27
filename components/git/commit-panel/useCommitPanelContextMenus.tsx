'use client'

import React from 'react'
import { LuArchive, LuBot, LuChevronDown, LuChevronRight, LuCopy, LuFileClock, LuFileCode, LuFilePlus, LuFileText, LuFingerprint, LuFolderOpen, LuUndo2 } from 'react-icons/lu'
import { TiMinusOutline, TiPlusOutline } from 'react-icons/ti'

import type { FloatingMenuItem } from '@/components/git/RefChipsCell'
import { useT } from '@/components/i18n/LocaleProvider'
import { quoteFileToAgent, quoteFolderToAgent } from '@/lib/agent/agent-quote'
import { getGitDriver } from '@/lib/git/driver'
import type { GitCommit, GitFileChange } from '@/lib/git/types'

export interface UseCommitPanelContextMenusOptions {
  repo: string
  commit: GitCommit
  isWorktree: boolean
  changedFiles: GitFileChange[]
  openPaths: Set<string>
  toggleFolder: (path: string) => void
  handleStage: (path: string) => void | Promise<void>
  handleUnstage: (path: string) => void | Promise<void>
  handleDiscard: (path: string) => void | Promise<void>
  handleIgnore: (pattern: string) => void | Promise<void>
  handleCreatePatch: (pathTarget?: string) => void | Promise<void>
  reloadDiff: () => Promise<void> | void
  flushPendingStageOps?: () => Promise<boolean>
  onRefresh?: () => Promise<void> | void
  onOpenFileHistory?: (path: string) => void
  onOpenFileBlame?: (path: string) => void
  onSelect: (path: string, status: string) => void
  setNewFileDialog: (d: { folderPath: string; fileName: string } | null) => void
  setContextMenu: (m: { anchor: { x: number; y: number }; ariaLabel: string; items: FloatingMenuItem[] } | null) => void
  notify: {
    success: (msg: string) => void
    error: (msg: string) => void
    info: (msg: string) => void
  }
}

export function useCommitPanelContextMenus({
  repo,
  commit,
  isWorktree,
  changedFiles,
  openPaths,
  toggleFolder,
  handleStage,
  handleUnstage,
  handleDiscard,
  handleIgnore,
  handleCreatePatch,
  reloadDiff,
  flushPendingStageOps,
  onRefresh,
  onOpenFileHistory,
  onOpenFileBlame,
  onSelect,
  setNewFileDialog,
  setContextMenu,
  notify,
}: UseCommitPanelContextMenusOptions) {
  const t = useT()

  const handleFileContextMenu = (e: React.MouseEvent, filePath: string, name: string, status: string) => {
    const targetFile = isWorktree ? changedFiles.find((f) => f.path === filePath) : null
    const ext = name.includes('.') ? name.split('.').pop() : ''

    const items: FloatingMenuItem[] = []

    if (isWorktree && targetFile) {
      if (targetFile.unstaged) {
        items.push({
          key: 'stage-file',
          label: t('git.operations.stageFile') || 'Stage',
          icon: <TiPlusOutline className="size-3.5 text-accent" />,
          onSelect: () => void handleStage(filePath),
        })
      }
      if (targetFile.staged) {
        items.push({
          key: 'unstage-file',
          label: t('git.operations.unstageFile') || 'Unstage',
          icon: <TiMinusOutline className="size-3.5 text-warn" />,
          onSelect: () => void handleUnstage(filePath),
        })
      }
      items.push({
        key: 'discard-file',
        label: t('git.operations.discardFile') || 'Discard changes',
        icon: <LuUndo2 className="size-3.5 text-fail" />,
        danger: true,
        onSelect: () => void handleDiscard(filePath),
      })
      items.push({
        key: 'ignore-file',
        label: t('git.operations.ignoreFile', { name }) || `Ignore '${name}'`,
        icon: <LuFileText className="size-3.5 text-ink-soft" />,
        onSelect: () => void handleIgnore(filePath),
      })
      if (ext) {
        items.push({
          key: 'ignore-ext',
          label: t('git.operations.ignoreExt', { ext }) || `Ignore all '*.${ext}' files`,
          icon: <LuFileCode className="size-3.5 text-ink-soft" />,
          onSelect: () => void handleIgnore(`*.${ext}`),
        })
      }
      items.push({
        key: 'stash-file',
        label: t('git.operations.stashFile') || 'Stash file',
        icon: <LuArchive className="size-3.5 text-accent" />,
        onSelect: async () => {
          try {
            await flushPendingStageOps?.()
            const driver = getGitDriver()
            await driver.stash(repo, { action: 'save', message: `Stash ${name}`, paths: [filePath] })
            notify.success(`Stashed file ${name}`)
            await reloadDiff()
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : 'Failed to stash file')
          }
        },
      })
    }

    // File history & blame available whenever file is tracked (or viewing commit)
    if (!isWorktree || status !== '?') {
      items.push(
        {
          key: 'file-history',
          label: t('git.operations.fileHistory') || 'File History',
          icon: <LuFileClock className="size-3.5 text-accent" />,
          dividerBefore: isWorktree,
          onSelect: () => (onOpenFileHistory ? onOpenFileHistory(filePath) : onSelect(filePath, status || 'M')),
        },
        {
          key: 'file-blame',
          label: t('git.operations.fileBlame') || 'File Blame',
          icon: <LuFingerprint className="size-3.5 text-accent" />,
          onSelect: () => (onOpenFileBlame ? onOpenFileBlame(filePath) : onSelect(filePath, status || 'M')),
        }
      )
    }

    // Quote file to Git Agent
    items.push({
      key: 'quote-file-agent',
      label: t('git.operations.quoteFileToAgent') || 'Quote File to Agent',
      icon: <LuBot className="size-3.5 text-accent" />,
      shortcut: '⌥A',
      dividerBefore: true,
      onSelect: () => quoteFileToAgent(filePath, status, repo),
    })

    // Copy file path is universally available
    items.push({
      key: 'copy-relative',
      label: t('git.operations.copyFilePath') || 'Copy file path',
      icon: <LuCopy className="size-3.5 text-ink-soft" />,
      dividerBefore: true,
      onSelect: () => void navigator.clipboard?.writeText(filePath),
    })

    if (!isWorktree) {
      items.push({
        key: 'restore-file',
        label: t('git.operations.restoreFileFromCommit') || 'Restore file from this commit',
        icon: <LuUndo2 className="size-3.5 text-warn" />,
        dividerBefore: true,
        onSelect: async () => {
          if (!repo || !commit?.hash) return
          try {
            const driver = getGitDriver()
            await driver.restoreFile?.(repo, commit.hash, filePath)
            notify.success(
              t('git.operations.restoreFileSuccess', { hash: commit.short || commit.hash.slice(0, 7), path: filePath }) ||
                `Restored file ${filePath} from commit ${commit.short || commit.hash.slice(0, 7)}`
            )
            await reloadDiff()
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : t('git.operations.restoreFileFail') || 'Failed to restore file')
          }
        },
      })
    }

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: name,
      items,
    })
  }

  const handleFolderContextMenu = (e: React.MouseEvent, folderPath: string, folderName: string) => {
    const absPath = repo ? `${repo.replace(/\/+$/, '')}/${folderPath}` : folderPath
    const isOpen = openPaths.has(folderPath)

    const items: FloatingMenuItem[] = []

    if (isWorktree) {
      items.push({
        key: 'stage-folder',
        label: t('git.operations.stageFolder') || 'Stage folder',
        icon: <TiPlusOutline className="size-3.5 text-accent" />,
        onSelect: () => void handleStage(folderPath),
      })
      items.push({
        key: 'discard-folder',
        label: t('git.operations.discardFolder') || 'Discard all changes in folder',
        icon: <LuUndo2 className="size-3.5 text-fail" />,
        danger: true,
        onSelect: () => void handleDiscard(folderPath),
      })
      items.push({
        key: 'ignore-folder',
        label: t('git.operations.ignoreFolder', { folder: folderName }) || `Ignore all files in '${folderName}/'`,
        icon: <LuFileText className="size-3.5 text-ink-soft" />,
        onSelect: () => void handleIgnore(folderPath.endsWith('/') ? folderPath : `${folderPath}/`),
      })
      items.push({
        key: 'stash-folder',
        label: t('git.operations.stashFolder') || 'Stash folder',
        icon: <LuArchive className="size-3.5 text-accent" />,
        onSelect: async () => {
          try {
            const driver = getGitDriver()
            await driver.stash(repo, { action: 'save', message: `Stash folder ${folderName}`, paths: [folderPath] })
            notify.success(t('git.operations.stashSuccess') || `Stashed folder ${folderName}`)
            await reloadDiff()
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : 'Failed to stash folder')
          }
        },
      })
      items.push({
        key: 'create-patch-folder',
        label: t('git.operations.createPatchFolder') || 'Create Patch from changes in directory',
        icon: <LuFileText className="size-3.5 text-accent" />,
        onSelect: () => void handleCreatePatch(folderPath),
      })
      items.push({
        key: 'open-folder',
        label: t('git.operations.openFolder') || 'Open folder',
        icon: <LuFolderOpen className="size-3.5 text-accent" />,
        dividerBefore: true,
        onSelect: async () => {
          try {
            await fetch('/api/reveal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: absPath, reveal: false }),
            })
          } catch {
            toggleFolder(folderPath)
          }
        },
      })
      items.push({
        key: 'create-file-in-folder',
        label: t('git.operations.createFileInFolder') || 'Create a file in this folder',
        icon: <LuFilePlus className="size-3.5 text-ok" />,
        onSelect: () => {
          setNewFileDialog({ folderPath, fileName: '' })
        },
      })
      items.push({
        key: 'copy-folder-path',
        label: t('git.operations.copyFolderPath') || 'Copy folder path',
        icon: <LuCopy className="size-3.5" />,
        dividerBefore: true,
        onSelect: () => void navigator.clipboard?.writeText(folderPath),
      })
      items.push({
        key: 'toggle-folder',
        label: isOpen ? t('git.operations.collapseFolder') || 'Collapse folder' : t('git.operations.expandFolder') || 'Expand folder',
        icon: isOpen ? <LuChevronDown className="size-3.5" /> : <LuChevronRight className="size-3.5" />,
        onSelect: () => toggleFolder(folderPath),
      })
    } else {
      items.push(
        {
          key: 'open-folder',
          label: t('git.operations.openFolder') || 'Open folder',
          icon: <LuFolderOpen className="size-3.5 text-accent" />,
          onSelect: async () => {
            try {
              await fetch('/api/reveal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: absPath, reveal: false }),
              })
            } catch {
              toggleFolder(folderPath)
            }
          },
        },
        {
          key: 'create-file-in-folder',
          label: t('git.operations.createFileInFolder') || 'Create a file in this folder',
          icon: <LuFilePlus className="size-3.5 text-ok" />,
          onSelect: () => {
            setNewFileDialog({ folderPath, fileName: '' })
          },
        }
      )
    }

    // Quote folder to Git Agent
    items.push({
      key: 'quote-folder-agent',
      label: t('git.operations.quoteFolderToAgent') || 'Quote Folder to Agent',
      icon: <LuBot className="size-3.5 text-accent" />,
      shortcut: '⌥A',
      dividerBefore: true,
      onSelect: () => quoteFolderToAgent(folderPath, repo),
    })

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: folderName,
      items,
    })
  }

  return { handleFileContextMenu, handleFolderContextMenu }
}
