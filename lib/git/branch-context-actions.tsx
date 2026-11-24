'use client'

import React from 'react'
import {
  LuArchive,
  LuArrowDownToLine,
  LuArrowUpFromLine,
  LuClock,
  LuCloud,
  LuCopy,
  LuEye,
  LuEyeOff,
  LuFolderGit2,
  LuFolderPlus,
  LuGitBranch,
  LuGitBranchPlus,
  LuGitCommitHorizontal,
  LuGitCompare,
  LuGitMerge,
  LuGitPullRequest,
  LuHash,
  LuPanelTop,
  LuPencil,
  LuPin,
  LuRotateCcw,
  LuShare2,
  LuTag,
  LuText,
  LuTrash2,
  LuUndo2,
  LuUser,
} from 'react-icons/lu'

import { makeShareUrl } from '@/lib/git/resolver'
import { formatIssueShareCard, makeIssueShareUrl } from '@/lib/git/share-card'

import { type BuildBranchMenuOptions, type FloatingMenuItem, getRemoteWebBase } from './branch-context-menu'

export interface BuildBranchActionsParams {
  options: BuildBranchMenuOptions
  tr: (key: string, fallback: string, vars?: any) => string
  shortHash: string
  copyVal: (text: string) => Promise<void>
  cleanBranch?: string
  fullBranch: string
}

export function buildBranchContextActions({ options, tr, shortHash, copyVal, cleanBranch, fullBranch }: BuildBranchActionsParams): Record<string, FloatingMenuItem> {
  const {
    branchName,
    commit,
    repo,
    remoteUrl,
    isRemote,
    soloBranch,
    config,
    onCheckoutBranch,
    onCreateBranch,
    onDeleteBranch,
    onRenameBranch,
    onMergeBranch,
    onRebaseBranch,
    onPushBranch,
    onPullBranch,
    onCherryPick,
    onUndoCommit,
    onStashAction,
    onSoloBranch,
    onSetUpstream,
    onPinBranch,
    isPinned,
    onHideBranch,
    isHidden,
    onCompareWorkdir,
    onResetBranch,
    onRevertCommit,
    onCreateTag,
    onCreateAnnotatedTag,
    onNotify,
  } = options

  return {
    'solo-branch': {
      key: 'solo-branch',
      label: soloBranch === branchName ? tr('git.operations.unsoloBranch', 'Unsolo branch') : tr('git.operations.soloBranch', 'Solo branch'),
      icon: soloBranch === branchName ? <LuEyeOff className="size-4 shrink-0 text-accent" /> : <LuEye className="size-4 shrink-0 text-accent" />,
      checked: soloBranch === branchName,
      onSelect: () => {
        if (onSoloBranch) {
          onSoloBranch(soloBranch === branchName ? null : branchName || null)
        }
      },
    },
    'copy-branch': {
      key: 'copy-branch',
      label: tr('git.operations.copyBranchName', 'Copy branch name'),
      icon: <LuGitBranch className="size-4 shrink-0 text-accent" />,
      shortcut: '⌘C',
      onSelect: () => {
        if (cleanBranch || branchName) void copyVal(cleanBranch || branchName || '')
      },
    },
    'copy-full-branch': {
      key: 'copy-full-branch',
      label: tr('git.operations.copyFullPath', 'Copy full branch'),
      icon: <LuCopy className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (fullBranch) void copyVal(fullBranch)
      },
    },
    'copy-hash': {
      key: 'copy-hash',
      label: tr('git.operations.copyHash', 'Copy commit hash'),
      icon: <LuHash className="size-4 shrink-0 text-ink-soft" />,
      badge: shortHash,
      shortcut: '⌘⇧C',
      onSelect: () => {
        if (commit?.hash) void copyVal(commit.hash)
      },
    },
    'copy-subject': {
      key: 'copy-subject',
      label: tr('git.operations.copySubject', 'Copy commit message'),
      icon: <LuText className="size-4 shrink-0 text-ink-soft" />,
      shortcut: '⌥⌘C',
      onSelect: () => {
        if (commit?.subject) void copyVal(commit.subject)
      },
    },
    'copy-author': {
      key: 'copy-author',
      label: tr('git.operations.copyAuthor', 'Copy author'),
      icon: <LuUser className="size-4 shrink-0 text-ink-soft" />,
      shortcut: '⌘⌥C',
      onSelect: () => {
        if (commit?.author) void copyVal(commit.author)
      },
    },
    'copy-date': {
      key: 'copy-date',
      label: tr('git.operations.copyDate', 'Copy commit date'),
      icon: <LuClock className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (commit?.date) void copyVal(commit.date)
      },
    },
    'copy-share-link': {
      key: 'copy-share-link',
      label: tr('git.operations.copyShareLink', 'Copy share link'),
      icon: <LuShare2 className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (!commit?.hash) return
        const shareUrl = makeShareUrl(repo || '', commit.hash, remoteUrl)
        const full = typeof window !== 'undefined' ? `${window.location.origin}${shareUrl}` : shareUrl
        void copyVal(full)
      },
    },
    'copy-issue-card': {
      key: 'copy-issue-card',
      label: tr('git.operations.copyIssueCard', 'Copy issue share card'),
      icon: <LuShare2 className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (!commit) return
        const fullShareUrl =
          typeof window !== 'undefined'
            ? `${window.location.origin}${makeIssueShareUrl({
                repoName: (repo || '').split('/').pop() || repo || '',
                repoPathOrUrl: repo || '',
                remoteUrl,
                commit,
              })}`
            : makeIssueShareUrl({
                repoName: (repo || '').split('/').pop() || repo || '',
                repoPathOrUrl: repo || '',
                remoteUrl,
                commit,
              })
        const card = formatIssueShareCard(
          {
            repoName: (repo || '').split('/').pop() || repo || '',
            repoPathOrUrl: repo || '',
            remoteUrl,
            commit,
          },
          fullShareUrl
        )
        void copyVal(card.markdown)
      },
    },
    'checkout-branch': {
      key: 'checkout-branch',
      label: isRemote ? tr('git.operations.checkoutRemote', 'Checkout as local branch') : tr('git.operations.checkoutBranch', 'Switch to branch'),
      icon: <LuGitPullRequest className="size-4 shrink-0 text-accent" />,
      onSelect: () => {
        if (branchName) onCheckoutBranch?.(branchName, isRemote)
      },
    },
    'new-branch': {
      key: 'new-branch',
      label: tr('git.operations.newBranch', 'New branch...'),
      icon: <LuGitBranchPlus className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onCreateBranch) {
          onCreateBranch(branchName || '', commit?.hash)
        } else {
          onNotify?.('success', `Ready to create branch based on ${branchName || shortHash}`)
        }
      },
    },
    'rename-branch': {
      key: 'rename-branch',
      label: tr('git.operations.renameBranchAction', 'Rename branch...'),
      icon: <LuPencil className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (branchName && onRenameBranch) {
          onRenameBranch(branchName)
        } else {
          onNotify?.('success', `Rename branch: ${branchName}`)
        }
      },
    },
    'merge-branch': {
      key: 'merge-branch',
      label: tr('git.operations.mergeBranch', 'Merge into current branch'),
      icon: <LuGitMerge className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (branchName && onMergeBranch) {
          onMergeBranch(branchName)
        } else {
          onNotify?.('success', `Merge branch: ${branchName}`)
        }
      },
    },
    'rebase-branch': {
      key: 'rebase-branch',
      label: tr('git.operations.rebaseBranch', 'Rebase onto this branch'),
      icon: <LuGitCommitHorizontal className="size-4 shrink-0 text-accent" />,
      onSelect: () => {
        if (branchName && onRebaseBranch) {
          onRebaseBranch(branchName)
        } else {
          onNotify?.('success', `Rebase branch: ${branchName}`)
        }
      },
    },
    'push-branch': {
      key: 'push-branch',
      label: tr('git.operations.pushBranchSimple', 'Push branch'),
      icon: <LuArrowUpFromLine className="size-4 shrink-0 text-accent" />,
      onSelect: () => {
        const b = cleanBranch || branchName
        if (b && onPushBranch) {
          onPushBranch(b)
        } else if (b) {
          onNotify?.('error', tr('git.operations.pushFailed', 'Push handler not configured'))
        }
      },
    },
    'pull-branch': {
      key: 'pull-branch',
      label: tr('git.operations.pullBranchSimple', 'Pull branch'),
      icon: <LuArrowDownToLine className="size-4 shrink-0 text-ok" />,
      onSelect: () => {
        const b = cleanBranch || branchName
        if (b && onPullBranch) {
          onPullBranch(b)
        } else if (b) {
          onNotify?.('error', tr('git.operations.pullFailed', 'Pull handler not configured'))
        }
      },
    },
    'stash-changes': {
      key: 'stash-changes',
      label: tr('git.operations.stashChangesSimple', 'Stash changes'),
      icon: <LuArchive className="size-4 shrink-0 text-accent" />,
      onSelect: () => {
        if (onStashAction) {
          onStashAction('save')
        }
      },
    },
    'cherry-pick': {
      key: 'cherry-pick',
      label: tr('git.operations.cherryPickSimple', 'Cherry-pick commit'),
      icon: <LuGitCommitHorizontal className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (commit?.hash && onCherryPick) {
          onCherryPick(commit.hash)
        } else {
          onNotify?.('success', `Ready to cherry-pick: ${shortHash}`)
        }
      },
    },
    'undo-commit': {
      key: 'undo-commit',
      label: tr('git.operations.undoCommitSimple', 'Undo commit'),
      icon: <LuUndo2 className="size-4 shrink-0 text-warn" />,
      onSelect: () => {
        onUndoCommit?.()
      },
    },
    'create-tag': {
      key: 'create-tag',
      label: tr('git.operations.createTag', 'Create tag...'),
      icon: <LuTag className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onCreateTag && (commit?.hash || branchName)) {
          onCreateTag(commit?.hash || branchName || '')
        } else {
          onNotify?.('success', `Create tag at commit: ${shortHash}`)
        }
      },
    },
    'delete-branch': {
      key: 'delete-branch',
      label: branchName ? tr('git.operations.deleteBranchAction', `Delete branch ${branchName}`, { branch: branchName }) : tr('git.operations.deleteBranch', 'Delete branch'),
      icon: <LuTrash2 className="size-4 shrink-0 text-fail" />,
      danger: true,
      needsConfirm: config?.dangerConfirm,
      confirmText: tr('git.operations.deleteConfirmText', 'Delete this branch? Click again to confirm'),
      onSelect: () => {
        if (branchName && onDeleteBranch) {
          onDeleteBranch(branchName)
        } else {
          onNotify?.('success', `Deleted branch: ${branchName}`)
        }
      },
    },
    'new-worktree': {
      key: 'new-worktree',
      label: tr('git.operations.checkoutWorktree', 'Checkout in new worktree...'),
      icon: <LuFolderPlus className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        onNotify?.('success', `Create worktree: ${branchName}`)
      },
    },
    'open-worktree': {
      key: 'open-worktree',
      label: tr('git.operations.openWorktree', 'Open worktree'),
      icon: <LuFolderGit2 className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        onNotify?.('success', 'Open worktree')
      },
    },
    'open-remote': {
      key: 'open-remote',
      label: tr('git.operations.openRemote', 'Open in remote repository'),
      icon: <LuPanelTop className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        const parsed = getRemoteWebBase(remoteUrl)
        if (!parsed) return
        let url = parsed.httpsUrl
        if (cleanBranch || branchName) url = `${url}/tree/${encodeURIComponent(cleanBranch || branchName || '')}`
        else if (commit?.hash) url = `${url}/commit/${commit.hash}`
        window.open(url, '_blank', 'noopener,noreferrer')
      },
    },
    'set-upstream': {
      key: 'set-upstream',
      label: branchName ? tr('git.operations.setUpstreamAction', `Set upstream (${branchName})`, { branch: branchName }) : tr('git.operations.setUpstream', 'Set upstream...'),
      icon: <LuCloud className="size-4 shrink-0 text-accent" />,
      onSelect: () => {
        if (branchName && onSetUpstream) {
          onSetUpstream(branchName)
        } else {
          onNotify?.('success', `Set upstream: ${branchName || ''}`)
        }
      },
    },
    'reset-commit': {
      key: 'reset-commit',
      label: shortHash
        ? tr('git.operations.resetToCommit', `Reset current branch to commit (${shortHash})`, { hash: shortHash })
        : tr('git.operations.resetToCommit', 'Reset current branch to this commit...'),
      icon: <LuRotateCcw className="size-4 shrink-0 text-warn" />,
      children: [
        {
          key: 'reset-soft',
          label: tr('git.operations.resetSoftDesc', 'Soft (keep working tree and staged index)'),
          icon: <LuUndo2 className="size-3.5 shrink-0" />,
          onSelect: () => {
            if (onResetBranch && (commit?.hash || shortHash)) {
              onResetBranch(commit?.hash || shortHash, 'soft')
            } else {
              onNotify?.('success', `Soft reset to: ${shortHash}`)
            }
          },
        },
        {
          key: 'reset-mixed',
          label: tr('git.operations.resetMixedDesc', 'Mixed (keep working tree, reset staged index)'),
          icon: <LuUndo2 className="size-3.5 shrink-0" />,
          onSelect: () => {
            if (onResetBranch && (commit?.hash || shortHash)) {
              onResetBranch(commit?.hash || shortHash, 'mixed')
            } else {
              onNotify?.('success', `Reset to: ${shortHash}`)
            }
          },
        },
      ],
    },
    'revert-commit': {
      key: 'revert-commit',
      label: shortHash ? tr('git.operations.revertCommit', `Revert commit (${shortHash})`, { hash: shortHash }) : tr('git.operations.revertCommit', 'Revert commit'),
      icon: <LuUndo2 className="size-4 shrink-0 text-warn" />,
      onSelect: () => {
        if (onRevertCommit && (commit?.hash || shortHash)) {
          onRevertCommit(commit?.hash || shortHash)
        } else {
          onNotify?.('success', `Ready to revert commit: ${shortHash}`)
        }
      },
    },
    'create-annotated-tag': {
      key: 'create-annotated-tag',
      label: tr('git.operations.createAnnotatedTag', 'Create annotated tag...'),
      icon: <LuTag className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onCreateAnnotatedTag && (commit?.hash || branchName)) {
          onCreateAnnotatedTag(commit?.hash || branchName || '')
        } else {
          onNotify?.('success', `Create annotated tag: ${shortHash}`)
        }
      },
    },
    'compare-workdir': {
      key: 'compare-workdir',
      label: tr('git.operations.compareWorkdir', 'Compare with working tree'),
      icon: <LuGitCompare className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onCompareWorkdir && branchName) {
          onCompareWorkdir(branchName)
        } else {
          onNotify?.('success', `Compare with working tree: ${branchName || shortHash}`)
        }
      },
    },
    'pin-branch': {
      key: 'pin-branch',
      label: isPinned ? tr('git.operations.unpinBranchSimple', 'Unpin branch') : tr('git.operations.pinBranchSimple', 'Pin branch'),
      icon: <LuPin className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onPinBranch && branchName) {
          onPinBranch(branchName)
        } else {
          onNotify?.('success', `Toggled pin state: ${branchName || ''}`)
        }
      },
    },
    'hide-branch': {
      key: 'hide-branch',
      label: isHidden ? tr('git.operations.unhideBranchSimple', 'Unhide branch') : tr('git.operations.hideBranchSimple', 'Hide branch'),
      icon: isHidden ? <LuEye className="size-4 shrink-0 text-accent" /> : <LuEyeOff className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onHideBranch && branchName) {
          onHideBranch(branchName)
        } else {
          onNotify?.('success', `Toggled hidden state: ${branchName || ''}`)
        }
      },
    },
  }
}
