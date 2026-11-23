'use client'

import React from 'react'
import {
  LuArchive,
  LuArrowDownToLine,
  LuArrowUpFromLine,
  LuBot,
  LuClock,
  LuCloud,
  LuCopy,
  LuExternalLink,
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
  LuPencil,
  LuPin,
  LuRotateCcw,
  LuShare2,
  LuSparkles,
  LuTag,
  LuText,
  LuTrash2,
  LuUndo2,
  LuUser,
} from 'react-icons/lu'

import { quoteBranchToAgent, quoteCommitToAgent } from '@/lib/agent/agent-quote'
import { copyToClipboard } from '@/lib/clipboard'
import type { ContextMenuUserConfig } from '@/lib/git/context-menu-config'
import { makeShareUrl } from '@/lib/git/resolver'
import { formatIssueShareCard, makeIssueShareUrl } from '@/lib/git/share-card'
import type { GitCommit, GitWorktree } from '@/lib/git/types'

export type FloatingMenuItem = {
  key: string
  label: string
  icon?: React.ReactNode
  onSelect?: () => Promise<void> | void
  group?: string
  dividerBefore?: boolean
  children?: FloatingMenuItem[]
  danger?: boolean
  needsConfirm?: boolean
  confirmText?: string
  shortcut?: string
  checked?: boolean
  badge?: string
  disabled?: boolean
}

export interface BuildBranchMenuOptions {
  target?: 'branch' | 'commit' | 'graph'
  branchName?: string
  rawBranchName?: string
  remoteNames?: string[]
  commit?: GitCommit
  repo?: string
  remoteUrl?: string
  worktree?: GitWorktree
  isReadOnly?: boolean
  isRemote?: boolean
  hasWorktrees?: boolean
  soloBranch?: string | null
  config: ContextMenuUserConfig
  t?: (key: any, vars?: any) => string
  onNotify?: (type: 'success' | 'error', message: string) => void
  onCheckoutBranch?: (branch: string, isRemote?: boolean) => void
  onCreateBranch?: (branchName: string, startPoint?: string) => void
  onDeleteBranch?: (branchName: string) => void
  onRenameBranch?: (oldName: string) => void
  onMergeBranch?: (branchName: string) => void
  onRebaseBranch?: (branchName: string) => void
  onPushBranch?: (branchName: string) => void
  onPullBranch?: (branchName: string) => void
  onCherryPick?: (hash: string) => void
  onUndoCommit?: () => void
  onStashAction?: (action: 'apply' | 'pop' | 'drop' | 'save', index?: number) => void
  onSoloBranch?: (branch: string | null) => void
  onSetUpstream?: (branchName: string) => void
  onPinBranch?: (branchName: string) => void
  isPinned?: boolean
  onHideBranch?: (branchName: string) => void
  isHidden?: boolean
  onCompareWorkdir?: (branchName: string) => void
  onResetBranch?: (hash: string, mode: 'soft' | 'mixed') => void
  onRevertCommit?: (hash: string) => void
  onCreateTag?: (target: string) => void
  onCreateAnnotatedTag?: (target: string) => void
  onAgentPrompt?: (prompt: string) => void
}

/**
 * Strips only the remote prefix (e.g. "origin/" or "upstream/") from a branch reference,
 * preserving category prefixes like "hotfix/", "feature/", or "release/".
 */
export function stripRemotePrefix(branch?: string, remoteNames?: string[]): string {
  if (!branch) return ''
  if (remoteNames && remoteNames.length > 0) {
    for (const remote of remoteNames) {
      if (!remote) continue
      if (branch.startsWith(`${remote}/`)) {
        return branch.slice(remote.length + 1)
      }
    }
  }
  const commonRemotes = ['origin', 'upstream']
  for (const remote of commonRemotes) {
    if (branch.startsWith(`${remote}/`)) {
      return branch.slice(remote.length + 1)
    }
  }
  return branch
}

/**
 * Builds structured branch / commit context menu adhering to user design specifications:
 * - 4-5 concise main entries: 「复制 ›」「分支操作 ›」「Worktree ›」「在远程打开」
 * - Pinned quick actions area at the top
 * - Dynamic capability checking (read-only repos hide local mutating operations)
 * - Dangerous actions at bottom with confirmation
 * - Agent extension capabilities
 */
export function buildBranchContextMenu({
  target,
  branchName,
  rawBranchName,
  remoteNames,
  commit,
  repo,
  remoteUrl,
  worktree: _worktree,
  isReadOnly = false,
  isRemote = false,
  hasWorktrees = false,
  soloBranch,
  config,
  t,
  onNotify,
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
  isPinned = false,
  onHideBranch,
  isHidden = false,
  onCompareWorkdir,
  onResetBranch,
  onRevertCommit,
  onCreateTag,
  onCreateAnnotatedTag,
  onAgentPrompt,
}: BuildBranchMenuOptions): FloatingMenuItem[] {
  const shortHash = commit?.short || commit?.hash?.slice(0, 7) || ''
  const tr = (key: string, fallback: string, vars?: any) => (t ? t(key, vars) || fallback : fallback)
  const resolvedTarget: 'branch' | 'commit' | 'graph' = target || (branchName ? 'branch' : 'commit')
  const copyVal = async (text: string) => {
    const ok = await copyToClipboard(text)
    if (ok) onNotify?.('success', tr('git.operations.copiedToClipboard', '已复制到剪贴板'))
    else onNotify?.('error', tr('git.operations.copyFailed', '复制失败'))
  }

  const cleanBranch = isRemote && branchName ? stripRemotePrefix(branchName, remoteNames) : branchName
  const fullBranch = rawBranchName || (isRemote && branchName ? branchName : '')

  // 1. Definition of all atomic actions
  const allActions: Record<string, FloatingMenuItem> = {
    'solo-branch': {
      key: 'solo-branch',
      label: soloBranch === branchName ? tr('git.operations.unsoloBranch', '取消只看') : tr('git.operations.soloBranch', '只看此分支'),
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
      label: cleanBranch ? tr('git.operations.copyBranchNameAction', `复制分支名 (${cleanBranch})`, { branch: cleanBranch }) : tr('git.operations.copyBranchName', '复制分支名'),
      icon: <LuGitBranch className="size-4 shrink-0 text-accent" />,
      shortcut: '⌘C',
      onSelect: () => {
        if (cleanBranch || branchName) void copyVal(cleanBranch || branchName || '')
      },
    },
    'copy-full-branch': {
      key: 'copy-full-branch',
      label: fullBranch ? tr('git.operations.copyFullPathAction', `复制完整路径 (${fullBranch})`, { path: fullBranch }) : tr('git.operations.copyFullPath', '复制完整路径'),
      icon: <LuCopy className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (fullBranch) void copyVal(fullBranch)
      },
    },
    'copy-hash': {
      key: 'copy-hash',
      label: tr('git.operations.copyHash', '复制 Commit Hash'),
      icon: <LuHash className="size-4 shrink-0 text-ink-soft" />,
      badge: shortHash,
      shortcut: '⌘⇧C',
      onSelect: () => {
        if (commit?.hash) void copyVal(commit.hash)
      },
    },
    'copy-subject': {
      key: 'copy-subject',
      label: tr('git.operations.copySubject', '复制提交说明'),
      icon: <LuText className="size-4 shrink-0 text-ink-soft" />,
      shortcut: '⌥⌘C',
      onSelect: () => {
        if (commit?.subject) void copyVal(commit.subject)
      },
    },
    'copy-author': {
      key: 'copy-author',
      label: tr('git.operations.copyAuthor', '复制作者'),
      icon: <LuUser className="size-4 shrink-0 text-ink-soft" />,
      shortcut: '⌘⌥C',
      onSelect: () => {
        if (commit?.author) void copyVal(commit.author)
      },
    },
    'copy-date': {
      key: 'copy-date',
      label: tr('git.operations.copyDate', '复制提交日期'),
      icon: <LuClock className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (commit?.date) void copyVal(commit.date)
      },
    },
    'copy-share-link': {
      key: 'copy-share-link',
      label: tr('git.operations.copyShareLink', '复制分享链接'),
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
      label: tr('git.operations.copyIssueCard', '复制工单分享卡片 (Markdown)'),
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
      label: isRemote
        ? branchName
          ? tr('git.operations.checkoutRemoteBranch', `检出为本地分支 (${branchName})`, { branch: branchName })
          : tr('git.operations.checkoutRemote', '检出为本地分支')
        : branchName
          ? tr('git.operations.checkoutBranchAction', `切换到 ${branchName}`, { branch: branchName })
          : tr('git.operations.checkoutBranch', '切换到此分支'),
      icon: <LuGitPullRequest className="size-4 shrink-0 text-accent" />,
      onSelect: () => {
        if (branchName) onCheckoutBranch?.(branchName, isRemote)
      },
    },
    'new-branch': {
      key: 'new-branch',
      label: tr('git.operations.newBranchFrom', '基于此分支新建分支…'),
      icon: <LuGitBranchPlus className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onCreateBranch) {
          onCreateBranch(branchName || '', commit?.hash)
        } else {
          onNotify?.('success', `准备基于 ${branchName || shortHash} 创建分支`)
        }
      },
    },
    'rename-branch': {
      key: 'rename-branch',
      label: tr('git.operations.renameBranchAction', '重命名分支…'),
      icon: <LuPencil className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (branchName && onRenameBranch) {
          onRenameBranch(branchName)
        } else {
          onNotify?.('success', `重命名分支：${branchName}`)
        }
      },
    },
    'merge-branch': {
      key: 'merge-branch',
      label: branchName
        ? tr('git.operations.mergeIntoCurrent', `合并到当前分支 (${branchName})`, { branch: branchName })
        : tr('git.operations.mergeIntoCurrent', '合并到当前分支 (Merge)', { branch: '' }),
      icon: <LuGitMerge className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (branchName && onMergeBranch) {
          onMergeBranch(branchName)
        } else {
          onNotify?.('success', `合并分支：${branchName}`)
        }
      },
    },
    'rebase-branch': {
      key: 'rebase-branch',
      label: branchName
        ? tr('git.operations.rebaseOntoCurrent', `变基到 ${branchName} (Rebase)`, { branch: branchName })
        : tr('git.operations.rebaseOntoCurrent', '变基到此分支 (Rebase)', { branch: '' }),
      icon: <LuGitCommitHorizontal className="size-4 shrink-0 text-accent" />,
      onSelect: () => {
        if (branchName && onRebaseBranch) {
          onRebaseBranch(branchName)
        } else {
          onNotify?.('success', `变基分支：${branchName}`)
        }
      },
    },
    'push-branch': {
      key: 'push-branch',
      label: branchName ? tr('git.operations.pushBranchAction', `推送分支 ${branchName}`, { branch: branchName }) : tr('git.operations.pushTooltipAction', '推送此分支 (Push)'),
      icon: <LuArrowUpFromLine className="size-4 shrink-0 text-accent" />,
      onSelect: () => {
        const b = cleanBranch || branchName
        if (b && onPushBranch) {
          onPushBranch(b)
        } else if (b) {
          onNotify?.('error', tr('git.operations.pushFailed', '无法执行推送：未配置处理函数'))
        }
      },
    },
    'pull-branch': {
      key: 'pull-branch',
      label: branchName
        ? tr('git.operations.pullBranchAction', `从远端拉取 ${branchName}`, { branch: branchName })
        : tr('git.operations.pullBranchAction', '拉取此分支 (Pull)', { branch: '' }),
      icon: <LuArrowDownToLine className="size-4 shrink-0 text-ok" />,
      onSelect: () => {
        const b = cleanBranch || branchName
        if (b && onPullBranch) {
          onPullBranch(b)
        } else if (b) {
          onNotify?.('error', tr('git.operations.pullFailed', '无法执行拉取：未配置处理函数'))
        }
      },
    },
    'stash-changes': {
      key: 'stash-changes',
      label: tr('git.operations.stashChanges', '暂存工作区修改 (Stash)'),
      icon: <LuArchive className="size-4 shrink-0 text-accent" />,
      onSelect: () => {
        if (onStashAction) {
          onStashAction('save')
        }
      },
    },
    'cherry-pick': {
      key: 'cherry-pick',
      label: commit?.hash
        ? tr('git.operations.cherryPickCommit', `遴选提交 ${shortHash}`, { hash: shortHash })
        : tr('git.operations.cherryPickCommit', '遴选此提交 (Cherry-pick)', { hash: '' }),
      icon: <LuGitCommitHorizontal className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (commit?.hash && onCherryPick) {
          onCherryPick(commit.hash)
        } else {
          onNotify?.('success', `准备遴选提交：${shortHash}`)
        }
      },
    },
    'undo-commit': {
      key: 'undo-commit',
      label: tr('git.operations.undoLastCommit', '撤销上一次提交 (Undo Commit)'),
      icon: <LuUndo2 className="size-4 shrink-0 text-warn" />,
      onSelect: () => {
        onUndoCommit?.()
      },
    },
    'create-tag': {
      key: 'create-tag',
      label: tr('git.operations.createTag', '创建标签…'),
      icon: <LuTag className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onCreateTag && (commit?.hash || branchName)) {
          onCreateTag(commit?.hash || branchName || '')
        } else {
          onNotify?.('success', `在此提交创建标签：${shortHash}`)
        }
      },
    },
    'delete-branch': {
      key: 'delete-branch',
      label: branchName ? tr('git.operations.deleteBranchAction', `删除分支 ${branchName}`, { branch: branchName }) : tr('git.operations.deleteBranch', '删除此分支'),
      icon: <LuTrash2 className="size-4 shrink-0 text-fail" />,
      danger: true,
      needsConfirm: config.dangerConfirm,
      confirmText: tr('git.operations.deleteConfirmText', '确定删除此分支？再次点击执行'),
      onSelect: () => {
        if (branchName && onDeleteBranch) {
          onDeleteBranch(branchName)
        } else {
          onNotify?.('success', `已删除分支：${branchName}`)
        }
      },
    },
    'new-worktree': {
      key: 'new-worktree',
      label: tr('git.operations.checkoutWorktree', '在独立 Worktree 中检出…'),
      icon: <LuFolderPlus className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        onNotify?.('success', `创建 Worktree：${branchName}`)
      },
    },
    'open-worktree': {
      key: 'open-worktree',
      label: tr('git.operations.openWorktree', '打开关联 Worktree 工作区'),
      icon: <LuFolderGit2 className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        onNotify?.('success', `打开 Worktree 工作区`)
      },
    },
    'open-remote': {
      key: 'open-remote',
      label: tr('git.operations.openRemote', '在远程仓库打开'),
      icon: <LuExternalLink className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (!remoteUrl) return
        let url = remoteUrl.replace(/\.git$/, '')
        if (branchName) url = `${url}/tree/${encodeURIComponent(branchName)}`
        else if (commit?.hash) url = `${url}/commit/${commit.hash}`
        window.open(url, '_blank', 'noopener,noreferrer')
      },
    },
    'set-upstream': {
      key: 'set-upstream',
      label: branchName ? tr('git.operations.setUpstreamAction', `设置上游分支 (${branchName})`, { branch: branchName }) : tr('git.operations.setUpstream', '设置上游分支…'),
      icon: <LuCloud className="size-4 shrink-0 text-accent" />,
      onSelect: () => {
        if (branchName && onSetUpstream) {
          onSetUpstream(branchName)
        } else {
          onNotify?.('success', `设置上游分支：${branchName || ''}`)
        }
      },
    },
    'reset-commit': {
      key: 'reset-commit',
      label: shortHash
        ? tr('git.operations.resetToCommit', `重置当前分支到此提交 (${shortHash})`, { hash: shortHash })
        : tr('git.operations.resetToCommit', '重置当前分支到此提交…'),
      icon: <LuRotateCcw className="size-4 shrink-0 text-warn" />,
      children: [
        {
          key: 'reset-soft',
          label: tr('git.operations.resetSoftDesc', 'Soft (保留工作区与暂存区)'),
          icon: <LuUndo2 className="size-3.5 shrink-0" />,
          onSelect: () => {
            if (onResetBranch && (commit?.hash || shortHash)) {
              onResetBranch(commit?.hash || shortHash, 'soft')
            } else {
              onNotify?.('success', `软重置到：${shortHash}`)
            }
          },
        },
        {
          key: 'reset-mixed',
          label: tr('git.operations.resetMixedDesc', 'Mixed (保留工作区，清空暂存区)'),
          icon: <LuUndo2 className="size-3.5 shrink-0" />,
          onSelect: () => {
            if (onResetBranch && (commit?.hash || shortHash)) {
              onResetBranch(commit?.hash || shortHash, 'mixed')
            } else {
              onNotify?.('success', `重置到：${shortHash}`)
            }
          },
        },
      ],
    },
    'revert-commit': {
      key: 'revert-commit',
      label: shortHash ? tr('git.operations.revertCommit', `撤销提交 (Revert ${shortHash})`, { hash: shortHash }) : tr('git.operations.revertCommit', '撤销此提交 (Revert)'),
      icon: <LuUndo2 className="size-4 shrink-0 text-warn" />,
      onSelect: () => {
        if (onRevertCommit && (commit?.hash || shortHash)) {
          onRevertCommit(commit?.hash || shortHash)
        } else {
          onNotify?.('success', `准备 Revert 提交：${shortHash}`)
        }
      },
    },
    'create-annotated-tag': {
      key: 'create-annotated-tag',
      label: tr('git.operations.createAnnotatedTag', '创建附注标签 (Annotated Tag)…'),
      icon: <LuTag className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onCreateAnnotatedTag && (commit?.hash || branchName)) {
          onCreateAnnotatedTag(commit?.hash || branchName || '')
        } else {
          onNotify?.('success', `创建附注标签：${shortHash}`)
        }
      },
    },
    'compare-workdir': {
      key: 'compare-workdir',
      label: tr('git.operations.compareWorkdir', '与工作区对比 (Compare with Working Tree)'),
      icon: <LuGitCompare className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onCompareWorkdir && branchName) {
          onCompareWorkdir(branchName)
        } else {
          onNotify?.('success', `对比工作区：${branchName || shortHash}`)
        }
      },
    },
    'pin-branch': {
      key: 'pin-branch',
      label: isPinned ? tr('git.operations.unpinBranch', '取消固定 (Unpin)') : tr('git.operations.pinBranch', '固定到左侧 (Pin to Left)'),
      icon: <LuPin className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onPinBranch && branchName) {
          onPinBranch(branchName)
        } else {
          onNotify?.('success', `已切换固定状态：${branchName || ''}`)
        }
      },
    },
    'hide-branch': {
      key: 'hide-branch',
      label: isHidden ? tr('git.operations.unhideBranch', '取消隐藏 (Unhide)') : tr('git.operations.hideBranch', '隐藏分支 (Hide)'),
      icon: isHidden ? <LuEye className="size-4 shrink-0 text-accent" /> : <LuEyeOff className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (onHideBranch && branchName) {
          onHideBranch(branchName)
        } else {
          onNotify?.('success', `已切换隐藏状态：${branchName || ''}`)
        }
      },
    },
  }

  const quoteBranchAction: FloatingMenuItem = {
    key: 'quote-branch-to-agent',
    label: isRemote ? tr('git.operations.quoteRemoteToAgent', '引用远端分支到 Git Agent') : tr('git.operations.quoteBranchToAgent', '引用分支到 Git Agent'),
    icon: <LuBot className="size-4 shrink-0 text-accent" />,
    onSelect: () => {
      if (branchName) quoteBranchToAgent(branchName, isRemote, repo)
    },
  }

  const quoteCommitAction: FloatingMenuItem = {
    key: 'quote-commit-to-agent',
    label: tr('git.operations.quoteCommitToAgent', '引用提交到 Git Agent'),
    icon: <LuBot className="size-4 shrink-0 text-accent" />,
    onSelect: () => {
      if (commit) quoteCommitToAgent({ hash: commit.hash, summary: commit.subject, author: commit.author }, repo)
    },
  }

  const items: FloatingMenuItem[] = []

  // Helper: map quick action id to a logical group
  const getQuickActionCategory = (id: string): 'branch' | 'merge' | 'sync' | 'workspace' | 'copy' | 'other' => {
    if (['checkout-branch', 'new-branch', 'rename-branch', 'delete-branch'].includes(id)) return 'branch'
    if (['merge-branch', 'rebase-branch'].includes(id)) return 'merge'
    if (['pull-branch', 'push-branch', 'set-upstream'].includes(id)) return 'sync'
    if (['stash-changes', 'cherry-pick', 'reset-commit', 'revert-commit', 'compare-workdir'].includes(id)) return 'workspace'
    if (['copy-branch', 'copy-hash', 'copy-subject', 'copy-author', 'copy-date', 'copy-share-link', 'copy-issue-card'].includes(id)) return 'copy'
    return 'other'
  }

  // 2. Quick Actions Area: Pinned top-level items filtered by target focus and grouped by category
  const filteredQuickActionIds = (config.quickActions || []).filter((actionId) => {
    if (!allActions[actionId]) return false
    if (config.hideUnavailableCapabilities && isReadOnly && ['checkout-branch', 'rename-branch', 'delete-branch'].includes(actionId)) {
      return false
    }
    if (resolvedTarget === 'commit' && ['rename-branch', 'delete-branch'].includes(actionId)) {
      return false
    }
    if (resolvedTarget === 'branch' && ['cherry-pick', 'reset-commit', 'revert-commit'].includes(actionId)) {
      return false
    }
    return true
  })

  // Group quick actions by logical categories with dividers between categories
  const categoryOrder: Record<string, number> = {
    branch: 1,
    merge: 2,
    sync: 3,
    workspace: 4,
    copy: 5,
    other: 6,
  }

  const sortedQuickActionIds = [...filteredQuickActionIds].sort((a, b) => {
    const catA = categoryOrder[getQuickActionCategory(a)] || 99
    const catB = categoryOrder[getQuickActionCategory(b)] || 99
    return catA - catB
  })

  let prevQuickCategory: string | null = null
  for (const actionId of sortedQuickActionIds) {
    const action = allActions[actionId]
    const cat = getQuickActionCategory(actionId)
    const isNewCategory = prevQuickCategory !== null && prevQuickCategory !== cat
    items.push({
      ...action,
      dividerBefore: isNewCategory,
    })
    prevQuickCategory = cat
  }

  // 3. Focused Quick Quote to Git Agent (Only ONE quote action in top-level matching target focus)
  // Belongs to its own Agent Quick group with a divider
  if (resolvedTarget === 'branch') {
    if (branchName) {
      items.push({
        ...quoteBranchAction,
        dividerBefore: items.length > 0,
      })
    }
  } else if (resolvedTarget === 'commit') {
    if (commit) {
      items.push({
        ...quoteCommitAction,
        dividerBefore: items.length > 0,
      })
    }
  } else {
    // graph node / author
    if (commit) {
      items.push({
        ...quoteCommitAction,
        dividerBefore: items.length > 0,
      })
    }
  }

  // 4. SOLO branch view entry (when branch is specified and solo view is supported, focused on branch)
  if (branchName && onSoloBranch && resolvedTarget === 'branch') {
    items.push({
      ...allActions['solo-branch'],
      dividerBefore: items.length > 0,
    })
  }

  // Helper: ensure the first item of a secondary group gets dividerBefore: true to separate from previous group
  let isFirstGitSecondaryGroup = true
  const markGitSecondaryDivider = () => {
    if (isFirstGitSecondaryGroup) {
      isFirstGitSecondaryGroup = false
      return items.length > 0
    }
    return false
  }

  // 5. "Branch operations" submenu (dynamically filtered by repository capabilities; read-only mode hides write operations)
  const showBranchGroup = config.enabledGroups.branch && (!isReadOnly || !config.hideUnavailableCapabilities)
  if (showBranchGroup && branchName) {
    const branchChildren: FloatingMenuItem[] = []

    // Sub-group 1: 检出与新建/重命名
    const checkoutGroup: FloatingMenuItem[] = []
    if (resolvedTarget !== 'branch') {
      checkoutGroup.push({ ...quoteBranchAction, dividerBefore: false })
    }
    checkoutGroup.push(allActions['checkout-branch'], allActions['new-branch'], allActions['rename-branch'])
    branchChildren.push(...checkoutGroup)

    // Sub-group 2: 合流与集成
    const mergeGroup: FloatingMenuItem[] = [allActions['merge-branch'], allActions['rebase-branch']]
    mergeGroup.forEach((act, idx) => {
      branchChildren.push({
        ...act,
        dividerBefore: idx === 0 && branchChildren.length > 0,
      })
    })

    // Sub-group 3: 远端同步
    const syncGroup: FloatingMenuItem[] = [allActions['pull-branch'], allActions['push-branch']]
    syncGroup.forEach((act, idx) => {
      branchChildren.push({
        ...act,
        dividerBefore: idx === 0 && branchChildren.length > 0,
      })
    })

    // Sub-group 4: 标签管理
    branchChildren.push({
      ...allActions['create-tag'],
      dividerBefore: true,
    })

    // Sub-group 5: 危险操作
    branchChildren.push({
      ...allActions['delete-branch'],
      dividerBefore: true,
    })

    const branchGroupLabel = resolvedTarget === 'commit' ? tr('git.operations.groupRelatedBranchOps', '关联分支操作') : tr('git.operations.groupBranchOps', '分支操作')

    items.push({
      key: 'menu-branch-group',
      label: branchGroupLabel,
      icon: <LuGitBranch className="size-4 shrink-0 text-ink-soft" />,
      dividerBefore: markGitSecondaryDivider(),
      children: branchChildren,
    })
  }

  // 6. "Commit & Reset operations" submenu
  const showCommitGroup = (config.enabledGroups as any).commit !== false && (commit?.hash || onCreateTag || onResetBranch)
  if (showCommitGroup) {
    const commitChildren: FloatingMenuItem[] = []

    // Sub-group 1: Agent 智能引用
    if (resolvedTarget !== 'commit' && commit) {
      commitChildren.push({ ...quoteCommitAction, dividerBefore: false })
    }

    // Sub-group 2: 提交应用与撤销
    const applyGroup: FloatingMenuItem[] = []
    if (commit?.hash) {
      applyGroup.push(allActions['cherry-pick'])
      applyGroup.push(allActions['revert-commit'])
      applyGroup.push(allActions['undo-commit'])
    }
    applyGroup.forEach((act, idx) => {
      commitChildren.push({
        ...act,
        dividerBefore: idx === 0 && commitChildren.length > 0,
      })
    })

    // Sub-group 3: 指针重置
    if (commit?.hash) {
      commitChildren.push({
        ...allActions['reset-commit'],
        dividerBefore: commitChildren.length > 0,
      })
    }

    // Sub-group 4: 标签管理
    const tagGroup: FloatingMenuItem[] = [allActions['create-tag'], allActions['create-annotated-tag']]
    tagGroup.forEach((act, idx) => {
      commitChildren.push({
        ...act,
        dividerBefore: idx === 0 && commitChildren.length > 0,
      })
    })

    if (commitChildren.length > 0) {
      items.push({
        key: 'menu-commit-group',
        label: tr('git.operations.groupCommitOps', '提交与重置'),
        icon: <LuGitCommitHorizontal className="size-4 shrink-0 text-ink-soft" />,
        dividerBefore: markGitSecondaryDivider(),
        children: commitChildren,
      })
    }
  }

  // 7. "View & Compare" submenu
  const showViewGroup = (config.enabledGroups as any).view !== false && Boolean(branchName || onCompareWorkdir || onPinBranch || onHideBranch)
  if (showViewGroup) {
    const viewChildren: FloatingMenuItem[] = []

    // Sub-group 1: 对比分析
    viewChildren.push(allActions['compare-workdir'])

    // Sub-group 2: 分支组织与过滤
    if (branchName) {
      viewChildren.push({
        ...allActions['pin-branch'],
        dividerBefore: true,
      })
      viewChildren.push(allActions['hide-branch'])
    }

    // Sub-group 3: 上游跟踪
    if (onSetUpstream) {
      viewChildren.push({
        ...allActions['set-upstream'],
        dividerBefore: true,
      })
    }

    if (viewChildren.length > 0) {
      items.push({
        key: 'menu-view-group',
        label: tr('git.operations.groupViewOps', '视图与对比'),
        icon: <LuEye className="size-4 shrink-0 text-ink-soft" />,
        dividerBefore: markGitSecondaryDivider(),
        children: viewChildren,
      })
    }
  }

  // 8. Copy & Extensions Group (复制、Worktree、远程直达)
  let isFirstCopyExtensionGroup = true
  const markCopyExtensionDivider = () => {
    if (isFirstCopyExtensionGroup) {
      isFirstCopyExtensionGroup = false
      return items.length > 0
    }
    return false
  }

  // "Copy" submenu
  if (config.enabledGroups.copy) {
    const copyChildren: FloatingMenuItem[] = []

    // 1. Commit metadata items
    const commitMetaItems: FloatingMenuItem[] = []
    if (commit?.hash) commitMetaItems.push(allActions['copy-hash'])
    if (commit?.subject) commitMetaItems.push(allActions['copy-subject'])
    if (commit?.author) commitMetaItems.push(allActions['copy-author'])
    if (commit?.date) commitMetaItems.push(allActions['copy-date'])

    // 2. Branch name & path items
    const branchMetaItems: FloatingMenuItem[] = []
    if (cleanBranch || branchName) branchMetaItems.push(allActions['copy-branch'])
    if (fullBranch && cleanBranch && fullBranch !== cleanBranch) branchMetaItems.push(allActions['copy-full-branch'])

    // 3. Sharing & collaboration items
    const shareItems: FloatingMenuItem[] = []
    if (commit?.hash) shareItems.push(allActions['copy-share-link'])
    if (commit) shareItems.push(allActions['copy-issue-card'])

    // Order groups according to right-clicked target:
    // If clicking branch column, branch info is at the top; if clicking commit column, commit info is at the top
    const primarySection = resolvedTarget === 'branch' ? branchMetaItems : commitMetaItems
    const secondarySection = resolvedTarget === 'branch' ? commitMetaItems : branchMetaItems

    if (primarySection.length > 0) {
      copyChildren.push(...primarySection)
    }

    if (secondarySection.length > 0) {
      secondarySection.forEach((item, idx) => {
        copyChildren.push({
          ...item,
          dividerBefore: idx === 0 && copyChildren.length > 0,
        })
      })
    }

    if (shareItems.length > 0) {
      shareItems.forEach((item, idx) => {
        copyChildren.push({
          ...item,
          dividerBefore: idx === 0 && copyChildren.length > 0,
        })
      })
    }

    if (copyChildren.length > 0) {
      items.push({
        key: 'menu-copy-group',
        label: tr('git.operations.groupCopy', '复制'),
        icon: <LuCopy className="size-4 shrink-0 text-ink-soft" />,
        dividerBefore: markCopyExtensionDivider(),
        children: copyChildren,
      })
    }
  }

  // 9. "Worktree" submenu (displayed when repository supports worktrees and not read-only)
  const showWorktree = config.enabledGroups.worktree && (hasWorktrees || !config.hideUnavailableCapabilities) && !isReadOnly
  if (showWorktree) {
    items.push({
      key: 'menu-worktree-group',
      label: tr('git.operations.groupWorktree', 'Worktree'),
      icon: <LuFolderGit2 className="size-4 shrink-0 text-ink-soft" />,
      dividerBefore: markCopyExtensionDivider(),
      children: [allActions['new-worktree'], allActions['open-worktree']],
    })
  }

  // 10. "Open in Remote" entry (when remote repository URL is available)
  if (config.enabledGroups.remote && remoteUrl) {
    items.push({
      ...allActions['open-remote'],
      dividerBefore: markCopyExtensionDivider(),
    })
  }

  // 11. "Agent Intelligent Capabilities" (custom actions enabled in configuration)
  if (config.enabledGroups.agent && config.agentActions?.some((a) => a.enabled)) {
    const activeAgentActions = config.agentActions.filter((a) => a.enabled)
    items.push({
      key: 'menu-agent-group',
      label: tr('git.operations.groupAgent', 'Agent 智能诊断'),
      icon: <LuBot className="size-4 shrink-0 text-accent" />,
      dividerBefore: true,
      children: activeAgentActions.map((agentAct) => ({
        key: agentAct.id,
        label: agentAct.label,
        icon: <LuSparkles className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => {
          const prompt = `${agentAct.prompt}\n(目标仓库: ${repo || '当前项目'}, 分支: ${branchName || 'HEAD'}, Commit: ${shortHash || '最新'})`
          onAgentPrompt?.(prompt)
        },
      })),
    })
  }

  // 12. Undo commit (when right-clicking HEAD commit with undo support)
  if (onUndoCommit) {
    items.push({
      ...allActions['undo-commit'],
      dividerBefore: true,
    })
  }

  return items
}
