'use client'

import React from 'react'
import {
  LuBot,
  LuClock,
  LuExternalLink,
  LuFolderGit2,
  LuFolderPlus,
  LuGitBranch,
  LuGitBranchPlus,
  LuGitMerge,
  LuGitPullRequest,
  LuHash,
  LuPencil,
  LuShare2,
  LuSparkles,
  LuTag,
  LuText,
  LuTrash2,
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
  hasWorktrees?: boolean
  config: ContextMenuUserConfig
  onNotify?: (type: 'success' | 'error', message: string) => void
  onCheckoutBranch?: (branch: string) => void
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
  hasWorktrees = false,
  config,
  onNotify,
  onCheckoutBranch,
  onAgentPrompt,
}: BuildBranchMenuOptions): FloatingMenuItem[] {
  const shortHash = commit?.short || commit?.hash?.slice(0, 7) || ''
  const copyVal = async (text: string) => {
    const ok = await copyToClipboard(text)
    if (ok) onNotify?.('success', '已复制到剪贴板')
    else onNotify?.('error', '复制失败')
  }

  // 1. Definition of all atomic actions
  const allActions: Record<string, FloatingMenuItem> = {
    'copy-branch': {
      key: 'copy-branch',
      label: branchName ? `复制分支名` : '复制分支名',
      icon: <LuGitBranch className="size-4 shrink-0 text-accent" />,
      shortcut: '⌘C',
      onSelect: () => {
        if (branchName) void copyVal(branchName)
      },
    },
    'copy-hash': {
      key: 'copy-hash',
      label: '复制 Commit Hash',
      icon: <LuHash className="size-4 shrink-0 text-ink-soft" />,
      badge: shortHash,
      shortcut: '⌘⇧C',
      onSelect: () => {
        if (commit?.hash) void copyVal(commit.hash)
      },
    },
    'copy-subject': {
      key: 'copy-subject',
      label: '复制提交说明',
      icon: <LuText className="size-4 shrink-0 text-ink-soft" />,
      shortcut: '⌥⌘C',
      onSelect: () => {
        if (commit?.subject) void copyVal(commit.subject)
      },
    },
    'copy-author': {
      key: 'copy-author',
      label: '复制作者',
      icon: <LuUser className="size-4 shrink-0 text-ink-soft" />,
      shortcut: '⌘⌥C',
      onSelect: () => {
        if (commit?.author) void copyVal(commit.author)
      },
    },
    'copy-date': {
      key: 'copy-date',
      label: '复制提交日期',
      icon: <LuClock className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        if (commit?.date) void copyVal(commit.date)
      },
    },
    'copy-share-link': {
      key: 'copy-share-link',
      label: '复制分享链接',
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
      label: '复制工单分享卡片 (Markdown)',
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
      label: branchName ? `切换到 ${branchName}` : '切换到此分支',
      icon: <LuGitPullRequest className="size-4 shrink-0 text-accent" />,
      onSelect: () => {
        if (branchName) onCheckoutBranch?.(branchName)
      },
    },
    'new-branch': {
      key: 'new-branch',
      label: '基于此分支新建分支…',
      icon: <LuGitBranchPlus className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        onNotify?.('success', `准备基于 ${branchName || shortHash} 创建分支`)
      },
    },
    'rename-branch': {
      key: 'rename-branch',
      label: '重命名分支…',
      icon: <LuPencil className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        onNotify?.('success', `重命名分支：${branchName}`)
      },
    },
    'merge-branch': {
      key: 'merge-branch',
      label: '合并到当前分支…',
      icon: <LuGitMerge className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        onNotify?.('success', `合并分支：${branchName}`)
      },
    },
    'create-tag': {
      key: 'create-tag',
      label: '创建标签…',
      icon: <LuTag className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        onNotify?.('success', `在此提交创建标签：${shortHash}`)
      },
    },
    'delete-branch': {
      key: 'delete-branch',
      label: branchName ? `删除分支 ${branchName}` : '删除此分支',
      icon: <LuTrash2 className="size-4 shrink-0 text-fail" />,
      danger: true,
      needsConfirm: config.dangerConfirm,
      confirmText: '确定删除此分支？再次点击执行',
      onSelect: () => {
        onNotify?.('success', `已删除分支：${branchName}`)
      },
    },
    'new-worktree': {
      key: 'new-worktree',
      label: '在独立 Worktree 中检出…',
      icon: <LuFolderPlus className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        onNotify?.('success', `创建 Worktree：${branchName}`)
      },
    },
    'open-worktree': {
      key: 'open-worktree',
      label: '打开关联 Worktree 工作区',
      icon: <LuFolderGit2 className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () => {
        onNotify?.('success', `打开 Worktree 工作区`)
      },
    },
    'open-remote': {
      key: 'open-remote',
      label: '在远程仓库打开',
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

  // 2. 快捷区 (Quick Actions Area): Pinned top-level items
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

  // 3. 「复制 ›」二级子菜单
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
        label: '复制',
        icon: <LuShare2 className="size-4 shrink-0 text-ink-soft" />,
        dividerBefore: items.length > 0,
        children: copyChildren,
      })
    }
  }

  // 4. 「分支操作 ›」二级子菜单 (动态根据仓库能力展示；只读模式隐藏本地写操作)
  const showBranchGroup = config.enabledGroups.branch && (!isReadOnly || !config.hideUnavailableCapabilities)
  if (showBranchGroup && branchName) {
    const branchChildren: FloatingMenuItem[] = [
      allActions['checkout-branch'],
      allActions['new-branch'],
      allActions['rename-branch'],
      allActions['merge-branch'],
      allActions['create-tag'],
    ]

    // 危险操作位于子菜单底部
    branchChildren.push({
      ...allActions['delete-branch'],
      dividerBefore: true,
    })

    items.push({
      key: 'menu-branch-group',
      label: '分支操作',
      icon: <LuGitBranch className="size-4 shrink-0 text-ink-soft" />,
      children: branchChildren,
    })
  }

  // 5. 「Worktree ›」二级子菜单 (当仓库具备 Worktree 能力且非只读时展示)
  const showWorktree = config.enabledGroups.worktree && (hasWorktrees || !config.hideUnavailableCapabilities) && !isReadOnly
  if (showWorktree) {
    items.push({
      key: 'menu-worktree-group',
      label: 'Worktree',
      icon: <LuFolderGit2 className="size-4 shrink-0 text-ink-soft" />,
      children: [allActions['new-worktree'], allActions['open-worktree']],
    })
  }

  // 6. 「在远程打开」入口 (如果有远程仓库地址)
  if (config.enabledGroups.remote && remoteUrl) {
    items.push(allActions['open-remote'])
  }

  // 7. 「Agent 智能能力 ›」 (从配置中读取启用的扩展动作)
  if (config.enabledGroups.agent && config.agentActions?.some((a) => a.enabled)) {
    const activeAgentActions = config.agentActions.filter((a) => a.enabled)
    items.push({
      key: 'menu-agent-group',
      label: 'Agent 智能诊断',
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

  return items
}
