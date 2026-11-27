'use client'

import React from 'react'

import type { RunWithGraphRollback } from '@/components/git/hooks/useOptimisticGitActions'
import type { FloatingMenuItem } from '@/components/git/RefChipsCell'
import { useT } from '@/components/i18n/LocaleProvider'
import { quotePromptToAgent } from '@/lib/agent/agent-quote'
import { buildBranchContextMenu } from '@/lib/git/branch-context-menu'
import type { ContextMenuUserConfig } from '@/lib/git/context-menu-config'
import { getGitDriver } from '@/lib/git/driver'
import { applyOptimisticTagCreate } from '@/lib/git/optimistic-updates'
import type { GitCommit, GitLogView, GitSelection } from '@/lib/git/types'

import type { BranchItem } from './sidebarUtils'

export interface UseBranchContextMenuOptions {
  view: GitLogView
  isEdge: boolean
  soloBranch?: string | null
  contextConfig: ContextMenuUserConfig
  notify: {
    success: (msg: string) => void
    error: (msg: string) => void
    info: (msg: string) => void
  }
  runWithGraphRollback?: RunWithGraphRollback
  onCheckoutBranch?: (branch: string, isRemote?: boolean) => Promise<void> | void
  onCreateBranch?: (branch: string, startPoint?: string) => void
  onDeleteBranch?: (branch: string) => void
  onRenameBranch?: (oldName: string) => void
  onMergeBranch?: (branch: string) => void
  onRebaseBranch?: (branch: string) => void
  onPushBranch?: (branch: string) => void
  onPullBranch?: (branch: string) => void
  onSoloBranch?: (branch: string | null) => void
  onRefresh?: () => Promise<void> | void
  setSetUpstreamBranch: (b: string | null) => void
  setPinnedBranches: React.Dispatch<React.SetStateAction<string[]>>
  pinnedBranches: string[]
  setHiddenBranches: React.Dispatch<React.SetStateAction<string[]>>
  hiddenBranches: string[]
  onSelect: (selection: GitSelection) => void
  setContextMenu: (m: { anchor: { x: number; y: number }; ariaLabel: string; items: FloatingMenuItem[] } | null) => void
}

export function useBranchContextMenu({
  view,
  isEdge: _isEdge,
  soloBranch,
  contextConfig,
  notify,
  onCheckoutBranch,
  onCreateBranch,
  onDeleteBranch,
  onRenameBranch,
  onMergeBranch,
  onRebaseBranch,
  onPushBranch,
  onPullBranch,
  onSoloBranch,
  onRefresh,
  runWithGraphRollback,
  setSetUpstreamBranch,
  setPinnedBranches,
  pinnedBranches,
  setHiddenBranches,
  hiddenBranches,
  onSelect,
  setContextMenu,
}: UseBranchContextMenuOptions) {
  const t = useT()

  return (e: React.MouseEvent, item: BranchItem, kind: 'local' | 'remote') => {
    e.preventDefault()
    e.stopPropagation()

    const foundCommit = item.tip ? view.commits.find((c) => c.hash === item.tip) : undefined
    const commit: GitCommit | undefined =
      foundCommit ||
      (item.tip
        ? {
            hash: item.tip,
            short: item.tip.slice(0, 7),
            subject: '',
            author: '',
            date: '',
            parents: [],
            refs: [item.name],
          }
        : undefined)

    const remoteNames = Array.from(new Set(view.remotes.map((r) => r.remote)))
    const remoteUrl = view.remoteUrl

    const actionItems = buildBranchContextMenu({
      branchName: item.name,
      rawBranchName: item.name,
      remoteNames,
      commit,
      repo: view.repo,
      remoteUrl,
      isReadOnly: false,
      isRemote: kind === 'remote',
      hasWorktrees: view.worktrees.length > 0,
      soloBranch,
      config: contextConfig,
      t,
      onNotify: (type, msg) => {
        if (type === 'success') notify.success(msg)
        else notify.error(msg)
      },
      onCheckoutBranch: (name, isRem) => void onCheckoutBranch?.(name, isRem ?? kind === 'remote'),
      onCreateBranch: (name, tip) => void onCreateBranch?.(name, tip),
      onDeleteBranch: (name) => void onDeleteBranch?.(name),
      onRenameBranch: (name) => void onRenameBranch?.(name),
      onMergeBranch: (name) => void onMergeBranch?.(name),
      onRebaseBranch: (name) => void onRebaseBranch?.(name),
      onPushBranch: (name) => void onPushBranch?.(name),
      onPullBranch: (name) => void onPullBranch?.(name),
      onCherryPick: async (hash) => {
        try {
          const driver = getGitDriver()
          await driver.cherryPick(view.repo, hash)
          notify.success(`Cherry-picked commit ${hash.slice(0, 7)}`)
          await onRefresh?.()
        } catch (err) {
          notify.error(err instanceof Error ? err.message : 'Cherry-pick failed')
        }
      },
      onResetBranch: async (hash: string, mode: 'soft' | 'mixed') => {
        try {
          const driver = getGitDriver()
          if (driver.reset) {
            await driver.reset(view.repo, hash, mode)
            notify.success(`${mode === 'soft' ? 'Soft ' : ''}Reset to ${hash.slice(0, 7)}`)
            await onRefresh?.()
          }
        } catch (err) {
          notify.error(err instanceof Error ? err.message : 'Reset failed')
        }
      },
      onRevertCommit: async (hash) => {
        try {
          const driver = getGitDriver()
          if (driver.revert) {
            await driver.revert(view.repo, hash)
            notify.success(`Reverted commit ${hash.slice(0, 7)}`)
            await onRefresh?.()
          }
        } catch (err) {
          notify.error(err instanceof Error ? err.message : 'Revert failed')
        }
      },
      onSetUpstream: (b) => setSetUpstreamBranch(b),
      onSoloBranch: (b) => void onSoloBranch?.(b),
      onPinBranch: (b) => {
        setPinnedBranches((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))
        notify.success(`Toggled pin for branch ${b}`)
      },
      isPinned: pinnedBranches.includes(item.name),
      onHideBranch: (b) => {
        setHiddenBranches((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))
      },
      isHidden: hiddenBranches.includes(item.name),
      onCompareWorkdir: () => {
        onSelect({ kind, name: item.name })
      },
      onCreateTag: async (target) => {
        const tagName = window.prompt('Enter tag name:')
        if (!tagName?.trim() || !target) return
        const cleanName = tagName.trim()
        if (runWithGraphRollback) {
          await runWithGraphRollback(
            (state) => applyOptimisticTagCreate(state, cleanName, target),
            async () => {
              const driver = getGitDriver()
              const res = await driver.createTag?.(view.repo, cleanName, { target })
              if (res && !res.ok) throw new Error(res.message || 'Failed to create tag')
            },
            'Failed to create tag'
          )
          return
        }
        try {
          const driver = getGitDriver()
          await driver.createTag?.(view.repo, cleanName, { target })
          await onRefresh?.()
        } catch (err) {
          notify.error(err instanceof Error ? err.message : 'Failed to create tag')
        }
      },
      onCreateAnnotatedTag: async (target) => {
        const tagName = window.prompt('Enter annotated tag name:')
        if (!tagName?.trim() || !target) return
        const msg = window.prompt('Enter annotation message:')
        if (!msg?.trim()) return
        const cleanName = tagName.trim()
        const cleanMsg = msg.trim()
        if (runWithGraphRollback) {
          await runWithGraphRollback(
            (state) => applyOptimisticTagCreate(state, cleanName, target),
            async () => {
              const driver = getGitDriver()
              const res = await driver.createTag?.(view.repo, cleanName, { target, message: cleanMsg })
              if (res && !res.ok) throw new Error(res.message || 'Failed to create annotated tag')
            },
            'Failed to create annotated tag'
          )
          return
        }
        try {
          const driver = getGitDriver()
          await driver.createTag?.(view.repo, cleanName, { target, message: cleanMsg })
          await onRefresh?.()
        } catch (err) {
          notify.error(err instanceof Error ? err.message : 'Failed to create annotated tag')
        }
      },
      onAgentPrompt: (prompt) => {
        quotePromptToAgent(prompt)
      },
    })

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: item.name,
      items: actionItems,
    })
  }
}
