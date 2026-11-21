'use client'

import React from 'react'
import {
  LuArchive,
  LuArrowDownToLine,
  LuArrowUpFromLine,
  LuBot,
  LuClock,
  LuCopy,
  LuExternalLink,
  LuEye,
  LuEyeOff,
  LuFolderGit2,
  LuFolderPlus,
  LuGitBranch,
  LuGitBranchPlus,
  LuGitCommitHorizontal,
  LuGitMerge,
  LuGitPullRequest,
  LuHash,
  LuPencil,
  LuShare2,
  LuSparkles,
  LuTag,
  LuText,
  LuTrash2,
  LuUndo2,
  LuUser,
} from 'react-icons/lu'

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
  branchName?: string
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
  onAgentPrompt?: (prompt: string) => void
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
  branchName,
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
  onAgentPrompt,
}: BuildBranchMenuOptions): FloatingMenuItem[] {
  const shortHash = commit?.short || commit?.hash?.slice(0, 7) || ''
  const tr = (key: string, fallback: string, vars?: any) => (t ? t(key, vars) || fallback : fallback)
  const copyVal = async (text: string) => {
    const ok = await copyToClipboard(text)
    if (ok) onNotify?.('success', tr('git.operations.copiedToClipboard', '已复制到剪贴板'))
    else onNotify?.('error', tr('git.operations.copyFailed', '复制失败'))
  }

  const cleanBranch = isRemote && branchName ? branchName.replace(/^[^/]+\//, '') : branchName

  // 1. Definition of all atomic actions
  const allActions: Record<string, FloatingMenuItem> = {
    'solo-branch': {
      key: 'solo-branch',
      label: soloBranch === branchName ? tr('git.operations.unsoloBranch', '退出 SOLO') : tr('git.operations.soloBranch', 'SOLO 分支'),
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
        if (cleanBranch) void copyVal(cleanBranch)
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
        if (branchName && onPushBranch) {
          onPushBranch(branchName)
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
        if (branchName && onPullBranch) {
          onPullBranch(branchName)
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
        onNotify?.('success', `在此提交创建标签：${shortHash}`)
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
  }

  const items: FloatingMenuItem[] = []

  // 2. Quick Actions Area: Pinned top-level items
  for (const actionId of config.quickActions || []) {
    const action = allActions[actionId]
    if (action) {
      // Capability filter for quick actions
      if (config.hideUnavailableCapabilities && isReadOnly && ['checkout-branch', 'rename-branch', 'delete-branch'].includes(actionId)) {
        continue
      }
      items.push({ ...action })
    }
  }

  // 3. SOLO branch view entry (when branch is specified and solo view is supported)
  if (branchName && onSoloBranch) {
    items.push({
      ...allActions['solo-branch'],
      dividerBefore: items.length > 0,
    })
  }

  // 4. "Branch operations" submenu (dynamically filtered by repository capabilities; read-only mode hides write operations)
  const showBranchGroup = config.enabledGroups.branch && (!isReadOnly || !config.hideUnavailableCapabilities)
  if (showBranchGroup && branchName) {
    const branchChildren: FloatingMenuItem[] = [
      allActions['checkout-branch'],
      allActions['new-branch'],
      allActions['rename-branch'],
      allActions['merge-branch'],
      allActions['rebase-branch'],
      allActions['pull-branch'],
      allActions['push-branch'],
      allActions['create-tag'],
    ]

    // Destructive operations placed at the bottom of submenu
    branchChildren.push({
      ...allActions['delete-branch'],
      dividerBefore: true,
    })

    items.push({
      key: 'menu-branch-group',
      label: tr('git.operations.groupBranchOps', '分支操作'),
      icon: <LuGitBranch className="size-4 shrink-0 text-ink-soft" />,
      children: branchChildren,
    })
  }

  // 5. "Copy" submenu
  if (config.enabledGroups.copy) {
    const copyChildren: FloatingMenuItem[] = []
    if (branchName) copyChildren.push(allActions['copy-branch'])
    if (commit?.hash) copyChildren.push(allActions['copy-hash'])
    if (commit?.subject) copyChildren.push(allActions['copy-subject'])
    if (commit?.author) copyChildren.push(allActions['copy-author'])
    if (commit?.date) copyChildren.push(allActions['copy-date'])
    if (commit?.hash) copyChildren.push(allActions['copy-share-link'])
    if (commit) copyChildren.push(allActions['copy-issue-card'])

    if (copyChildren.length > 0) {
      items.push({
        key: 'menu-copy-group',
        label: tr('git.operations.groupCopy', '复制'),
        icon: <LuCopy className="size-4 shrink-0 text-ink-soft" />,
        dividerBefore: items.length > 0,
        children: copyChildren,
      })
    }
  }

  // 5. "Worktree" submenu (displayed when repository supports worktrees and not read-only)
  const showWorktree = config.enabledGroups.worktree && (hasWorktrees || !config.hideUnavailableCapabilities) && !isReadOnly
  if (showWorktree) {
    items.push({
      key: 'menu-worktree-group',
      label: tr('git.operations.groupWorktree', 'Worktree'),
      icon: <LuFolderGit2 className="size-4 shrink-0 text-ink-soft" />,
      children: [allActions['new-worktree'], allActions['open-worktree']],
    })
  }

  // 6. "Open in Remote" entry (when remote repository URL is available)
  if (config.enabledGroups.remote && remoteUrl) {
    items.push(allActions['open-remote'])
  }

  // 7. "Agent Intelligent Capabilities" (custom actions enabled in configuration)
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

  // 8. Undo commit (when right-clicking HEAD commit with undo support)
  if (onUndoCommit) {
    items.push({
      ...allActions['undo-commit'],
      dividerBefore: true,
    })
  }

  return items
}
