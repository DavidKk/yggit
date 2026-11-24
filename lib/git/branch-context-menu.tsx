'use client'

import React from 'react'
import { LuBot, LuCopy, LuEye, LuFolderGit2, LuGitBranch, LuGitCommitHorizontal, LuPanelTop, LuSparkles } from 'react-icons/lu'

import { quoteBranchToAgent, quoteCommitToAgent } from '@/lib/agent/agent-quote'
import { copyToClipboard } from '@/lib/clipboard'
import { buildBranchContextActions } from '@/lib/git/branch-context-actions'
import type { ContextMenuUserConfig } from '@/lib/git/context-menu-config'
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
 * Normalizes remote repository URL into clean HTTPS web base URL and detects host provider
 */
export function getRemoteWebBase(remoteUrl?: string): { httpsUrl: string; isGitLab: boolean } | null {
  if (!remoteUrl) return null
  const trimmed = remoteUrl.trim()
  if (!trimmed) return null
  let url = trimmed
  if (url.startsWith('git@') && url.includes(':')) {
    url = url.replace(/^git@([^:]+):/, 'https://$1/')
  } else if (url.startsWith('ssh://git@')) {
    url = url.replace(/^ssh:\/\/git@([^/]+)\//, 'https://$1/')
  }
  url = url.replace(/\.git$/, '').replace(/\/$/, '')
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }
  const isGitLab = url.toLowerCase().includes('gitlab')
  return { httpsUrl: url, isGitLab }
}

/**
 * Builds structured branch / commit context menu adhering to user design specifications:
 * - 4-5 concise main entries: 'Copy ›', 'Branch ops ›', 'Worktree ›', 'Open in remote'
 * - Pinned quick actions area at the top
 * - Dynamic capability checking (read-only repos hide local mutating operations)
 * - Dangerous actions at bottom with confirmation
 * - Agent extension capabilities
 */
export function buildBranchContextMenu(options: BuildBranchMenuOptions): FloatingMenuItem[] {
  const {
    target,
    branchName,
    rawBranchName,
    remoteNames,
    commit,
    repo,
    remoteUrl,
    isReadOnly = false,
    isRemote = false,
    hasWorktrees = false,
    config,
    t,
    onNotify,
    onAgentPrompt,
    onSoloBranch,
    onCreateTag,
    onResetBranch,
    onCompareWorkdir,
    onPinBranch,
    onHideBranch,
    onSetUpstream,
    onUndoCommit,
  } = options
  const shortHash = commit?.short || commit?.hash?.slice(0, 7) || ''
  const tr = (key: string, fallback: string, vars?: any) => {
    if (!t) return fallback
    const res = t(key, vars)
    return res && res !== key ? res : fallback
  }
  const resolvedTarget: 'branch' | 'commit' | 'graph' = target || (branchName ? 'branch' : 'commit')
  const copyVal = async (text: string) => {
    const ok = await copyToClipboard(text)
    if (ok) onNotify?.('success', tr('git.operations.copiedToClipboard', 'Copied to clipboard'))
    else onNotify?.('error', tr('git.operations.copyFailed', 'Copy failed'))
  }

  const cleanBranch = isRemote && branchName ? stripRemotePrefix(branchName, remoteNames) : branchName
  const fullBranch = rawBranchName || (isRemote && branchName ? branchName : '')

  // 1. Definition of all atomic actions
  const allActions = buildBranchContextActions({
    options,
    tr,
    shortHash,
    copyVal,
    cleanBranch,
    fullBranch,
  })

  const quoteBranchAction: FloatingMenuItem = {
    key: 'quote-branch-to-agent',
    label: tr('git.operations.quoteBranchSimple', 'Quote Branch to Agent'),
    icon: <LuBot className="size-4 shrink-0 text-accent" />,
    shortcut: '⌥A',
    onSelect: () => {
      if (branchName) quoteBranchToAgent(branchName, isRemote, repo)
    },
  }

  const quoteCommitAction: FloatingMenuItem = {
    key: 'quote-commit-to-agent',
    label: tr('git.operations.quoteCommitSimple', 'Quote Commit to Agent'),
    icon: <LuBot className="size-4 shrink-0 text-accent" />,
    shortcut: '⌥A',
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

    // Sub-group 1: Checkout, new branch & rename
    const checkoutGroup: FloatingMenuItem[] = []
    if (resolvedTarget !== 'branch') {
      checkoutGroup.push({ ...quoteBranchAction, dividerBefore: false })
    }
    checkoutGroup.push(allActions['checkout-branch'], allActions['new-branch'], allActions['rename-branch'])
    branchChildren.push(...checkoutGroup)

    // Sub-group 2: Merge & rebase
    const mergeGroup: FloatingMenuItem[] = [allActions['merge-branch'], allActions['rebase-branch']]
    mergeGroup.forEach((act, idx) => {
      branchChildren.push({
        ...act,
        dividerBefore: idx === 0 && branchChildren.length > 0,
      })
    })

    // Sub-group 3: Remote sync
    const syncGroup: FloatingMenuItem[] = [allActions['pull-branch'], allActions['push-branch']]
    syncGroup.forEach((act, idx) => {
      branchChildren.push({
        ...act,
        dividerBefore: idx === 0 && branchChildren.length > 0,
      })
    })

    // Sub-group 4: Tag management
    branchChildren.push({
      ...allActions['create-tag'],
      dividerBefore: true,
    })

    // Sub-group 5: Danger zone
    branchChildren.push({
      ...allActions['delete-branch'],
      dividerBefore: true,
    })

    const branchGroupLabel =
      resolvedTarget === 'commit' ? tr('git.operations.groupRelatedBranchOps', 'Related Branch Operations') : tr('git.operations.groupBranchOps', 'Branch Operations')

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

    // Sub-group 1: Agent quote
    if (resolvedTarget !== 'commit' && commit) {
      commitChildren.push({ ...quoteCommitAction, dividerBefore: false })
    }

    // Sub-group 2: Commit apply and revert
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

    // Sub-group 3: Reset pointers
    if (commit?.hash) {
      commitChildren.push({
        ...allActions['reset-commit'],
        dividerBefore: commitChildren.length > 0,
      })
    }

    // Sub-group 4: Tag management
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
        label: tr('git.operations.groupCommitOps', 'Commit & Reset'),
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

    // Sub-group 1: Compare & diff
    viewChildren.push(allActions['compare-workdir'])

    // Sub-group 2: Branch organization & filtering
    if (branchName) {
      viewChildren.push({
        ...allActions['pin-branch'],
        dividerBefore: true,
      })
      viewChildren.push(allActions['hide-branch'])
    }

    // Sub-group 3: Upstream tracking
    if (onSetUpstream) {
      viewChildren.push({
        ...allActions['set-upstream'],
        dividerBefore: true,
      })
    }

    if (viewChildren.length > 0) {
      items.push({
        key: 'menu-view-group',
        label: tr('git.operations.groupViewOps', 'View & Compare'),
        icon: <LuEye className="size-4 shrink-0 text-ink-soft" />,
        dividerBefore: markGitSecondaryDivider(),
        children: viewChildren,
      })
    }
  }

  // 8. Copy & Extensions Group (Copy, Worktree, Open in remote)
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
        label: tr('git.operations.groupCopy', 'Copy'),
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

  // 10. "Open in Remote" (Direct clean remote link for the targeted commit or branch)
  const remoteBase = getRemoteWebBase(remoteUrl)
  if (config.enabledGroups.remote && remoteBase) {
    const { httpsUrl } = remoteBase
    const targetBranch = cleanBranch || branchName

    if (resolvedTarget === 'branch' && targetBranch) {
      items.push({
        key: 'open-remote-branch',
        label: tr('git.operations.openRemoteBranchSimple', 'Open Branch in Remote'),
        icon: <LuPanelTop className="size-4 shrink-0 text-ink-soft" />,
        dividerBefore: markCopyExtensionDivider(),
        onSelect: () => {
          window.open(`${httpsUrl}/tree/${encodeURIComponent(targetBranch)}`, '_blank', 'noopener,noreferrer')
        },
      })
    } else if (commit?.hash) {
      items.push({
        key: 'open-remote-commit',
        label: tr('git.operations.openRemoteCommitSimple', 'Open Commit in Remote'),
        icon: <LuPanelTop className="size-4 shrink-0 text-ink-soft" />,
        dividerBefore: markCopyExtensionDivider(),
        onSelect: () => {
          window.open(`${httpsUrl}/commit/${commit.hash}`, '_blank', 'noopener,noreferrer')
        },
      })
    } else if (targetBranch) {
      items.push({
        key: 'open-remote-branch',
        label: tr('git.operations.openRemoteBranchSimple', 'Open Branch in Remote'),
        icon: <LuPanelTop className="size-4 shrink-0 text-ink-soft" />,
        dividerBefore: markCopyExtensionDivider(),
        onSelect: () => {
          window.open(`${httpsUrl}/tree/${encodeURIComponent(targetBranch)}`, '_blank', 'noopener,noreferrer')
        },
      })
    }
  }

  // 11. "Agent Intelligent Capabilities" (custom actions enabled in configuration)
  if (config.enabledGroups.agent && config.agentActions?.some((a) => a.enabled)) {
    const activeAgentActions = config.agentActions.filter((a) => a.enabled)
    items.push({
      key: 'menu-agent-group',
      label: tr('git.operations.groupAgent', 'Agent AI Diagnostics'),
      icon: <LuBot className="size-4 shrink-0 text-accent" />,
      dividerBefore: true,
      children: activeAgentActions.map((agentAct) => ({
        key: agentAct.id,
        label: agentAct.label,
        icon: <LuSparkles className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => {
          const prompt = `${agentAct.prompt}\n(Target repo: ${repo || 'Current project'}, Branch: ${branchName || 'HEAD'}, Commit: ${shortHash || 'Latest'})`
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
