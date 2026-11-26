'use client'

import { LuArchive, LuArchiveRestore, LuBot, LuCopy, LuEyeOff, LuHash, LuPencil, LuText, LuTrash2 } from 'react-icons/lu'

import type { FloatingMenuItem } from '@/components/git/RefChipsCell'
import type { useT } from '@/components/i18n/LocaleProvider'
import { quotePromptToAgent, quoteStashToAgent, quoteWorktreeToAgent } from '@/lib/agent/agent-quote'
import { buildBranchContextMenu } from '@/lib/git/branch-context-menu'
import { getGitDriver } from '@/lib/git/driver'
import type { GitCommit, GitStash, GitWorktree } from '@/lib/git/types'

type TFn = ReturnType<typeof useT>

export function buildWorktreeContextItems(params: {
  wt: GitWorktree
  repo?: string
  t: TFn
  copyValue: (text: string) => Promise<void> | void
  onSelectWorktree?: () => void
}): FloatingMenuItem[] {
  const { wt, repo, t, copyValue, onSelectWorktree } = params
  return [
    {
      key: 'select-wt',
      label: t('git.graph.workingTree') || 'View Working Tree',
      icon: <LuCopy className="size-4 shrink-0 text-accent" />,
      onSelect: () => onSelectWorktree?.(),
    },
    {
      key: 'quote-wt',
      label: t('git.operations.quoteWorktreeToAgent') || 'Quote Worktree to Yggi',
      icon: <LuBot className="size-4 shrink-0 text-accent" />,
      onSelect: () => quoteWorktreeToAgent(repo || '.', undefined, repo),
    },
    {
      key: 'status',
      label: t('git.graph.copyWorktreeChanges'),
      icon: <LuCopy className="size-4 shrink-0 text-ink-soft" />,
      onSelect: () =>
        void copyValue(
          wt.insertions || wt.deletions
            ? `${t('git.graph.workingTree')}: +${wt.insertions} -${wt.deletions} (${t('git.graph.filesCount', { count: wt.files })})`
            : `${t('git.graph.workingTree')}: ${t('git.graph.filesCount', { count: wt.files })}`
        ),
    },
  ]
}

export function buildStashContextItems(params: {
  stash: GitStash
  repo?: string
  t: TFn
  copyValue: (text: string) => Promise<void> | void
  onStashAction: (action: 'apply' | 'pop' | 'drop' | 'edit', index: number, message?: string) => Promise<void> | void
  onHideStash: (name: string) => void
}): FloatingMenuItem[] {
  const { stash, repo, t, copyValue, onStashAction, onHideStash } = params
  const idx = Number(stash.name.match(/\d+/)?.[0] ?? 0)
  return [
    {
      key: 'apply-stash',
      label: t('git.operations.applyStashAction', { stash: stash.name }) || `Apply Stash (${stash.name})`,
      icon: <LuArchive className="size-3.5 shrink-0 text-accent" aria-hidden />,
      onSelect: () => void onStashAction('apply', idx),
    },
    {
      key: 'pop-stash',
      label: t('git.operations.popStashAction', { stash: stash.name }) || `Pop Stash (${stash.name})`,
      icon: <LuArchiveRestore className="size-3.5 shrink-0 text-ok" aria-hidden />,
      onSelect: () => void onStashAction('pop', idx),
    },
    {
      key: 'quote-stash',
      label: t('git.operations.quoteStashToAgent') || 'Quote Stash to Yggi',
      icon: <LuBot className="size-3.5 shrink-0 text-accent" aria-hidden />,
      onSelect: () => quoteStashToAgent(stash.name, stash.subject, repo),
    },
    {
      key: 'drop-stash',
      label: t('git.operations.deleteStashAction', { stash: stash.name }) || `Delete Stash (${stash.name})`,
      icon: <LuTrash2 className="size-3.5 shrink-0 text-fail" aria-hidden />,
      danger: true,
      onSelect: () => void onStashAction('drop', idx),
    },
    {
      key: 'edit-stash-message',
      label: t('git.operations.editStashMessageAction') || 'Edit Stash Message...',
      icon: <LuPencil className="size-3.5 shrink-0 text-ink-soft" aria-hidden />,
      dividerBefore: true,
      onSelect: () => {
        const msg = window.prompt(t('git.operations.editStashPrompt') || 'Please enter new stash message:', stash.subject || '')
        if (msg && msg.trim()) void onStashAction('edit', idx, msg.trim())
      },
    },
    {
      key: 'hide-stash',
      label: t('git.operations.hideStashAction') || 'Hide Stash',
      icon: <LuEyeOff className="size-3.5 shrink-0 text-ink-soft" aria-hidden />,
      dividerBefore: true,
      onSelect: () => onHideStash(stash.name),
    },
    {
      key: 'copy-stash-group',
      label: t('git.operations.groupCopy') || 'Copy',
      icon: <LuCopy className="size-3.5 shrink-0 text-ink-soft" aria-hidden />,
      dividerBefore: true,
      children: [
        {
          key: 'subject',
          label: t('git.graph.copyStashSubject'),
          icon: <LuText className="size-3.5 shrink-0" aria-hidden />,
          onSelect: () => void copyValue(stash.subject || stash.name),
        },
        {
          key: 'name',
          label: `${t('git.graph.copyStashName')} (${stash.name})`,
          icon: <LuCopy className="size-3.5 shrink-0" aria-hidden />,
          onSelect: () => void copyValue(stash.name),
        },
        {
          key: 'base',
          label: t('git.graph.copyStashBase'),
          icon: <LuHash className="size-3.5 shrink-0" aria-hidden />,
          onSelect: () => void copyValue(stash.base),
        },
      ],
    },
  ]
}

export function buildCommitContextItems(params: {
  commit: GitCommit
  branchNames?: string[] | string
  target?: 'branch' | 'commit' | 'graph'
  repo?: string
  remoteUrl?: string
  remoteNames: string[]
  worktreeBranches: string[]
  worktree?: GitWorktree | null
  soloBranch?: string | null
  onSoloBranch?: (name: string | null) => void
  contextConfig: Parameters<typeof buildBranchContextMenu>[0]['config']
  t: TFn
  notify: { success: (msg: string) => void; error: (msg: string) => void }
  onCheckoutBranch?: (branch: string, isRemote?: boolean) => Promise<void> | void
  onPushBranch?: (branch: string) => Promise<void> | void
  onPullBranch?: (branch: string) => Promise<void> | void
  onCreateBranch?: (from: string) => Promise<void> | void
  onDeleteBranch?: (branch: string, isRemote?: boolean) => Promise<void> | void
  onRenameBranch?: (branch: string) => Promise<void> | void
  headCommitHash?: string
  onRefresh?: () => Promise<void> | void
}): FloatingMenuItem[] {
  const {
    commit,
    branchNames,
    target,
    repo,
    remoteUrl,
    remoteNames,
    worktreeBranches,
    worktree,
    soloBranch,
    onSoloBranch,
    contextConfig,
    t,
    notify,
    onCheckoutBranch,
    onPushBranch,
    onPullBranch,
    onCreateBranch,
    onDeleteBranch,
    onRenameBranch,
    headCommitHash,
    onRefresh,
  } = params
  const rawList = Array.isArray(branchNames) ? branchNames : branchNames ? [branchNames] : []
  const branches = Array.from(new Set(rawList.filter(Boolean)))
  const primaryBranch = branches[0]

  return buildBranchContextMenu({
    target,
    branchName: primaryBranch,
    commit,
    repo,
    remoteUrl,
    remoteNames,
    isReadOnly: false,
    hasWorktrees: worktreeBranches.length > 0 || Boolean(worktree),
    soloBranch,
    onSoloBranch,
    config: contextConfig,
    t,
    onNotify: (type, msg) => {
      if (type === 'success') notify.success(msg)
      else notify.error(msg)
    },
    onCheckoutBranch: (branch, isRemote) => {
      if (onCheckoutBranch) {
        void onCheckoutBranch(branch, isRemote)
      } else {
        quotePromptToAgent(`${t('git.operations.checkoutBranch') || 'Switch to'} ${branch}`)
      }
    },
    onPushBranch,
    onPullBranch,
    onCreateBranch,
    onDeleteBranch,
    onRenameBranch,
    onAgentPrompt: (prompt) => {
      quotePromptToAgent(prompt)
    },
    onUndoCommit:
      commit.hash === headCommitHash
        ? async () => {
            if (!repo) return
            try {
              const driver = getGitDriver()
              const res = await driver.undo(repo)
              notify.success(res.message || t('git.operations.undoSuccess') || 'Undid last commit')
              await onRefresh?.()
            } catch (err) {
              notify.error(err instanceof Error ? err.message : t('git.operations.undoError') || 'Undo failed')
            }
          }
        : undefined,
  })
}
