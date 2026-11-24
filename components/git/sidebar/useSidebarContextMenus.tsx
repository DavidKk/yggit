'use client'

import React from 'react'
import {
  LuArchive,
  LuArchiveRestore,
  LuArrowDownToLine,
  LuBot,
  LuChevronDown,
  LuChevronRight,
  LuCopy,
  LuCornerDownRight,
  LuExternalLink,
  LuEye,
  LuEyeOff,
  LuFolder,
  LuGitBranch,
  LuGitCommitHorizontal,
  LuGitMerge,
  LuHash,
  LuPencil,
  LuText,
  LuTrash2,
} from 'react-icons/lu'

import type { FloatingMenuItem } from '@/components/git/RefChipsCell'
import { useT } from '@/components/i18n/LocaleProvider'
import { quoteRemoteToAgent, quoteStashToAgent, quoteTagToAgent, quoteWorktreeToAgent } from '@/lib/agent/agent-quote'
import { copyToClipboard } from '@/lib/clipboard'
import { getGitDriver } from '@/lib/git/driver'
import type { GitLogView } from '@/lib/git/types'

import { type BranchNode, collectAllBranchItems } from './sidebarUtils'

export interface UseSidebarContextMenusOptions {
  view: GitLogView
  onRefresh?: () => Promise<void> | void
  onCheckoutBranch?: (branch: string, isRemote?: boolean) => Promise<void> | void
  onSoloRemote?: (remote: string | null) => void
  onToggleHideRemote?: (remote: string) => void
  onStashAction?: (action: 'apply' | 'pop' | 'drop', index: number) => void
  soloRemote?: string | null
  hiddenRemotes?: string[]
  openRemotes: Record<string, boolean>
  setOpenRemotes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  remoteDefault: boolean
  toggleFolder: (id: string) => void
  setContextMenu: (m: { anchor: { x: number; y: number }; ariaLabel: string; items: FloatingMenuItem[] } | null) => void
  setHiddenStashes: React.Dispatch<React.SetStateAction<string[]>>
  copyValue: (v: string) => Promise<void> | void
  setDeleteFolderModal: (v: { open: boolean; folderLabel: string; branchesToDelete: string[]; skippedCurrentBranch: string | null } | null) => void
  setEditRemoteState: React.Dispatch<React.SetStateAction<{ open: boolean; remote: string; url: string }>>
  notify: {
    success: (msg: string) => void
    error: (msg: string) => void
    info: (msg: string) => void
  }
}

export function useSidebarContextMenus({
  view,
  onRefresh,
  onCheckoutBranch,
  onSoloRemote,
  onToggleHideRemote,
  onStashAction,
  soloRemote,
  hiddenRemotes,
  openRemotes,
  setOpenRemotes,
  remoteDefault,
  toggleFolder,
  setContextMenu,
  setHiddenStashes,
  copyValue,
  setDeleteFolderModal,
  setEditRemoteState,
  notify,
}: UseSidebarContextMenusOptions) {
  const t = useT()

  const executeStashAction = async (action: 'apply' | 'pop' | 'drop' | 'edit', index: number, message?: string) => {
    if (onStashAction && action !== 'edit') {
      onStashAction(action, index)
      return
    }
    try {
      const driver = getGitDriver()
      const res = await driver.stash(view.repo, { action, index, message })
      notify.success(res.message || 'Operation succeeded')
      await onRefresh?.()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  const handleTagContextMenu = (e: React.MouseEvent, tag: { name: string; tip: string }) => {
    e.preventDefault()
    e.stopPropagation()
    const currentBranch = view.branch || 'HEAD'

    const items: FloatingMenuItem[] = [
      {
        key: 'fast-forward-tag',
        label: t('git.operations.fastForwardTagTo', { tag: tag.name, branch: currentBranch }) || `Fast-forward ${tag.name} to ${currentBranch}`,
        icon: <LuGitMerge className="size-3.5 shrink-0 text-accent" />,
        onSelect: async () => {
          try {
            const driver = getGitDriver()
            await driver.mergeBranch(view.repo, tag.name)
            notify.success(`Fast-forwarded ${tag.name} to ${currentBranch}`)
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : 'Fast-forward failed')
          }
        },
      },
      {
        key: 'merge-into-tag',
        label: t('git.operations.mergeBranchIntoTag', { branch: currentBranch, tag: tag.name }) || `Merge ${currentBranch} into ${tag.name}`,
        icon: <LuGitMerge className="size-3.5 shrink-0 text-ink-soft" />,
        onSelect: async () => {
          try {
            const driver = getGitDriver()
            await driver.mergeBranch(view.repo, tag.tip)
            notify.success(`Merged ${currentBranch} into ${tag.name}`)
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : 'Merge failed')
          }
        },
      },
      {
        key: 'rebase-onto-tag',
        label: t('git.operations.rebaseBranchOntoTag', { branch: currentBranch, tag: tag.name }) || `Rebase ${currentBranch} onto ${tag.name}`,
        icon: <LuGitCommitHorizontal className="size-3.5 shrink-0 text-accent" />,
        onSelect: async () => {
          try {
            const driver = getGitDriver()
            await driver.rebaseBranch(view.repo, tag.name)
            notify.success(`Rebased ${currentBranch} onto ${tag.name}`)
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : 'Rebase failed')
          }
        },
      },
      {
        key: 'checkout-tag',
        label: t('git.operations.checkoutTagCommit', { tag: tag.name }) || `Checkout the commit at ${tag.name}`,
        icon: <LuCornerDownRight className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void onCheckoutBranch?.(tag.tip),
      },
      {
        key: 'quote-tag-to-agent',
        label: t('git.operations.quoteTagToAgent') || 'Quote Tag to Agent',
        icon: <LuBot className="size-3.5 shrink-0 text-accent" />,
        shortcut: '⌥A',
        dividerBefore: true,
        onSelect: () => {
          quoteTagToAgent(tag.name, tag.tip, view.repo)
        },
      },
      {
        key: 'delete-tag',
        label: t('git.operations.deleteTagLocally', { tag: tag.name }) || `Delete tag ${tag.name}`,
        icon: <LuTrash2 className="size-3.5 shrink-0 text-fail" />,
        danger: true,
        dividerBefore: true,
        onSelect: async () => {
          const confirmed = window.confirm(`Are you sure you want to delete tag "${tag.name}"?`)
          if (!confirmed) return
          try {
            const driver = getGitDriver()
            await driver.deleteTag?.(view.repo, tag.name)
            notify.success(`Deleted tag ${tag.name}`)
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : 'Failed to delete tag')
          }
        },
      },
    ]

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: tag.name,
      items,
    })
  }

  const handleStashContextMenu = (e: React.MouseEvent, stash: { name: string; subject?: string; hash: string }) => {
    e.preventDefault()
    e.stopPropagation()
    const idx = Number(stash.name.match(/\d+/)?.[0] ?? 0)
    const items: FloatingMenuItem[] = [
      {
        key: 'quote-stash-to-agent',
        label: t('git.operations.quoteStashToAgent') || 'Quote Stash to Agent',
        icon: <LuBot className="size-3.5 shrink-0 text-accent" />,
        shortcut: '⌥A',
        onSelect: () => {
          quoteStashToAgent(stash.name, stash.subject, view.repo)
        },
      },
      {
        key: 'apply-stash',
        label: t('git.operations.applyStash') || 'Apply Stash',
        icon: <LuArchive className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void executeStashAction('apply', idx),
      },
      {
        key: 'pop-stash',
        label: t('git.operations.popStash') || 'Pop Stash',
        icon: <LuArchiveRestore className="size-3.5 shrink-0 text-ok" />,
        onSelect: () => void executeStashAction('pop', idx),
      },
      {
        key: 'drop-stash',
        label: t('git.operations.deleteStash') || 'Delete Stash',
        icon: <LuTrash2 className="size-3.5 shrink-0 text-fail" />,
        danger: true,
        onSelect: () => void executeStashAction('drop', idx),
      },
      {
        key: 'edit-stash-message',
        label: t('git.operations.editStashMessage') || 'Edit stash message',
        icon: <LuPencil className="size-3.5 shrink-0 text-ink-soft" />,
        dividerBefore: true,
        onSelect: () => {
          const msg = window.prompt(t('git.operations.editStashPrompt') || 'Enter new stash message:', stash.subject || '')
          if (msg && msg.trim()) void executeStashAction('edit', idx, msg.trim())
        },
      },
      {
        key: 'hide-stash',
        label: t('git.operations.hide') || 'Hide',
        icon: <LuEyeOff className="size-3.5 shrink-0 text-ink-soft" />,
        dividerBefore: true,
        onSelect: () => setHiddenStashes((prev) => (prev.includes(stash.name) ? prev.filter((s) => s !== stash.name) : [...prev, stash.name])),
      },
    ]

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: stash.name,
      items,
    })
  }

  const handleWorktreeContextMenu = (e: React.MouseEvent, entry: { path: string; branch?: string; head: string }) => {
    e.preventDefault()
    e.stopPropagation()
    const items: FloatingMenuItem[] = [
      {
        key: 'quote-worktree-to-agent',
        label: t('git.operations.quoteWorktreeToAgent') || 'Quote Worktree to Agent',
        icon: <LuBot className="size-3.5 shrink-0 text-accent" />,
        shortcut: '⌥A',
        onSelect: () => {
          quoteWorktreeToAgent(entry.path, entry.branch, view.repo)
        },
      },
      {
        key: 'copy-path',
        label: t('git.operations.copyLocalPathAction', { path: entry.path }),
        icon: <LuFolder className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void copyValue(entry.path),
        group: t('git.operations.groupCopy'),
      },
    ]
    if (entry.branch) {
      const br = entry.branch
      items.push({
        key: 'copy-branch',
        label: `${t('git.graph.copyBranchName')} (${br})`,
        icon: <LuGitBranch className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void copyValue(br),
        group: t('git.operations.groupCopy'),
      })
    }
    items.push({
      key: 'copy-head',
      label: `${t('git.graph.copyCommitHash')} (${entry.head.slice(0, 7)})`,
      icon: <LuHash className="size-3.5 shrink-0 text-ink-soft" />,
      onSelect: () => void copyValue(entry.head),
      group: t('git.operations.groupCopy'),
    })
    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: entry.branch || entry.path,
      items,
    })
  }

  const handleFolderContextMenu = (e: React.MouseEvent, node: BranchNode, kind: 'local' | 'remote', folderId: string, expanded: boolean) => {
    e.preventDefault()
    e.stopPropagation()

    const branchItems = collectAllBranchItems(node)
    const items: FloatingMenuItem[] = []

    if (node.children.length > 0) {
      items.push({
        key: 'toggle-folder',
        label: expanded ? t('git.operations.collapseGroup') || 'Collapse group' : t('git.operations.expandGroup') || 'Expand group',
        icon: expanded ? <LuChevronDown className="size-3.5 shrink-0" /> : <LuChevronRight className="size-3.5 shrink-0" />,
        onSelect: () => toggleFolder(folderId),
      })
    }

    const copyChildren: FloatingMenuItem[] = [
      {
        key: 'copy-folder-name',
        label: (t('git.operations.copyGroupName') || 'Copy group name ({name})').replace('{name}', node.label),
        icon: <LuFolder className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void copyValue(node.label),
      },
    ]

    if (node.id && node.id !== node.label) {
      copyChildren.push({
        key: 'copy-folder-path',
        label: (t('git.operations.copyGroupPath') || 'Copy full group path ({path})').replace('{path}', node.id),
        icon: <LuCopy className="size-3.5 shrink-0" />,
        onSelect: () => void copyValue(node.id),
      })
    }

    if (branchItems.length > 0) {
      copyChildren.push({
        key: 'copy-branches-list',
        label: (t('git.operations.copyGroupBranches') || 'Copy branch names in group ({count})').replace('{count}', String(branchItems.length)),
        icon: <LuGitBranch className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => void copyValue(branchItems.map((b) => b.name).join('\n')),
      })
    }

    if (node.item) {
      const tipCommit = view.commits.find((c) => c.hash === node.item?.tip)
      if (tipCommit) {
        copyChildren.push(
          {
            key: 'copy-commit-subject',
            label: `${t('git.graph.copyCommitSubject') || 'Copy commit message'} (${tipCommit.subject})`,
            icon: <LuText className="size-3.5 shrink-0 text-ink-soft" />,
            onSelect: () => void copyValue(tipCommit.subject),
          },
          {
            key: 'copy-commit-hash',
            label: `${t('git.graph.copyCommitHash') || 'Copy Commit SHA'} (${tipCommit.short || tipCommit.hash.slice(0, 7)})`,
            icon: <LuHash className="size-3.5 shrink-0 text-ink-soft" />,
            onSelect: () => void copyValue(tipCommit.hash),
          }
        )
      } else if (node.item.tip) {
        const hash = node.item.tip
        copyChildren.push({
          key: 'copy-commit-hash',
          label: `${t('git.graph.copyCommitHash') || 'Copy Commit SHA'} (${hash.slice(0, 7)})`,
          icon: <LuHash className="size-3.5 shrink-0 text-ink-soft" />,
          onSelect: () => void copyValue(hash),
        })
      }
    }

    if (copyChildren.length > 0) {
      items.push({
        key: 'copy-folder-group',
        label: t('git.operations.groupCopy') || 'Copy',
        icon: <LuCopy className="size-3.5 shrink-0 text-ink-soft" />,
        dividerBefore: items.length > 0,
        children: copyChildren,
      })
    }

    if (kind === 'local' && branchItems.length > 0) {
      const allBranchNames = branchItems.map((b) => b.name)
      const currentBranch = view.head || view.branch
      const isCurrentInFolder = allBranchNames.includes(currentBranch)
      const branchesToDelete = allBranchNames.filter((b) => b !== currentBranch)

      if (branchesToDelete.length > 0) {
        items.push({
          key: 'delete-folder-branches',
          label: t('git.operations.deleteFolderBranches', { count: branchesToDelete.length }) || `Delete all branches in folder (${branchesToDelete.length})`,
          icon: <LuTrash2 className="size-3.5 shrink-0 text-fail" />,
          danger: true,
          dividerBefore: true,
          onSelect: () => {
            setDeleteFolderModal({
              open: true,
              folderLabel: node.label,
              branchesToDelete,
              skippedCurrentBranch: isCurrentInFolder ? currentBranch : null,
            })
          },
        })
      }
    }

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: node.label,
      items,
    })
  }

  const handleRemoteGroupContextMenu = (e: React.MouseEvent, group: { source: string; count: number; tree: BranchNode[] }) => {
    e.preventDefault()
    e.stopPropagation()

    const allRemoteBranches = group.tree.flatMap(collectAllBranchItems)
    const expanded = openRemotes[group.source] ?? remoteDefault
    const isSolo = soloRemote === group.source
    const isHidden = hiddenRemotes?.includes(group.source)

    const remoteSource = view.remoteSources?.find((r) => r.name === group.source)
    const remoteUrl = remoteSource?.url || (group.source === 'origin' ? view.remoteUrl : '') || ''

    const items: FloatingMenuItem[] = [
      {
        key: 'quote-remote-to-agent',
        label: t('git.operations.quoteRemoteToAgent') || 'Quote Remote to Agent',
        icon: <LuBot className="size-3.5 shrink-0 text-accent" />,
        shortcut: '⌥A',
        onSelect: () => {
          quoteRemoteToAgent(group.source, remoteUrl, view.repo)
        },
      },
      {
        key: 'fetch-remote',
        label: (t('git.operations.fetchRemoteActionSimple') || `Fetch ${group.source}`).replace('{remote}', group.source),
        icon: <LuArrowDownToLine className="size-3.5 shrink-0 text-accent" />,
        onSelect: async () => {
          try {
            notify.info((t('git.operations.fetchingRemote') || `Fetching ${group.source}...`).replace('{remote}', group.source))
            const driver = getGitDriver()
            await driver.fetch(view.repo, { remote: group.source, prune: true })
            notify.success((t('git.operations.fetchRemoteSuccess') || `Fetched ${group.source}`).replace('{remote}', group.source))
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : 'Fetch failed')
          }
        },
      },
      {
        key: 'edit-remote',
        label: (t('git.operations.editRemoteActionSimple') || `Edit ${group.source}`).replace('{remote}', group.source),
        icon: <LuPencil className="size-3.5 shrink-0 text-ink-soft" />,
        onSelect: async () => {
          let url = remoteUrl
          if (!url) {
            const driver = getGitDriver()
            url = (await driver.getRemoteUrl?.(view.repo, group.source).catch(() => '')) || ''
          }
          setEditRemoteState({ open: true, remote: group.source, url })
        },
      },
      {
        key: 'remove-remote',
        label: (t('git.operations.removeRemoteActionSimple') || `Remove ${group.source}`).replace('{remote}', group.source),
        icon: <LuTrash2 className="size-3.5 shrink-0 text-fail" />,
        danger: true,
        onSelect: async () => {
          const confirmed = window.confirm(
            (t('git.operations.removeRemoteConfirm') || `Are you sure you want to remove remote "${group.source}"? This will remove the remote and its tracking branches.`).replace(
              '{remote}',
              group.source
            )
          )
          if (!confirmed) return
          try {
            notify.info(`Removing remote ${group.source}...`)
            const driver = getGitDriver()
            await driver.removeRemote?.(view.repo, group.source)
            notify.success((t('git.operations.removeRemoteSuccess') || `Successfully removed remote ${group.source}`).replace('{remote}', group.source))
            await onRefresh?.()
          } catch (err) {
            notify.error(err instanceof Error ? err.message : 'Failed to remove remote')
          }
        },
      },
      {
        key: 'hide-remote',
        label: isHidden ? t('git.operations.unhide') || 'Unhide' : t('git.operations.hide') || 'Hide',
        icon: isHidden ? <LuEye className="size-3.5 shrink-0 text-accent" /> : <LuEyeOff className="size-3.5 shrink-0 text-ink-soft" />,
        dividerBefore: true,
        onSelect: () => onToggleHideRemote?.(group.source),
      },
      {
        key: 'solo-remote',
        label: isSolo ? t('git.operations.unsolo') || 'Unsolo' : t('git.operations.solo') || 'Solo',
        icon: isSolo ? <LuEyeOff className="size-3.5 shrink-0 text-accent" /> : <LuEye className="size-3.5 shrink-0 text-accent" />,
        onSelect: () => onSoloRemote?.(isSolo ? null : group.source),
      },
      {
        key: 'copy-remote-link',
        label: (t('git.operations.copyLinkToRemoteSimple') || `Copy link to remote: ${group.source}`).replace('{remote}', group.source),
        icon: <LuCopy className="size-3.5 shrink-0 text-accent" />,
        dividerBefore: true,
        onSelect: async () => {
          let url = remoteUrl
          if (!url) {
            const driver = getGitDriver()
            url = (await driver.getRemoteUrl?.(view.repo, group.source).catch(() => '')) || ''
          }
          if (!url) {
            notify.error('Remote URL not found')
            return
          }
          const ok = await copyToClipboard(url)
          if (ok) {
            notify.success((t('git.operations.copyRemoteUrlSuccess') || 'Copied remote URL: {url}').replace('{url}', url))
          } else {
            notify.error('Copy failed')
          }
        },
      },
    ]

    const webUrl = remoteUrl ? remoteUrl.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '') : ''
    if (webUrl && (webUrl.startsWith('http://') || webUrl.startsWith('https://'))) {
      items.push({
        key: 'open-remote-browser',
        label: t('git.operations.openRemoteInBrowser') || 'Open remote repository in browser',
        icon: <LuExternalLink className="size-3.5 shrink-0 text-ink-soft" />,
        onSelect: () => {
          window.open(webUrl, '_blank', 'noopener,noreferrer')
        },
      })
    }

    if (allRemoteBranches.length > 0) {
      items.push({
        key: 'copy-remote-branches',
        label: (t('git.operations.copyAllRemoteBranches') || 'Copy all branch names in remote ({count})').replace('{count}', String(allRemoteBranches.length)),
        icon: <LuGitBranch className="size-3.5 shrink-0 text-accent" />,
        dividerBefore: true,
        onSelect: () => void copyValue(allRemoteBranches.map((b) => b.name).join('\n')),
      })
    }

    items.push({
      key: 'toggle-remote-group',
      label: expanded ? t('git.operations.collapseRemote') || 'Collapse remote' : t('git.operations.expandRemote') || 'Expand remote',
      icon: expanded ? <LuChevronDown className="size-3.5 shrink-0" /> : <LuChevronRight className="size-3.5 shrink-0" />,
      onSelect: () => setOpenRemotes((prev) => ({ ...prev, [group.source]: !expanded })),
    })

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: group.source,
      items,
    })
  }

  return {
    handleTagContextMenu,
    handleStashContextMenu,
    handleWorktreeContextMenu,
    handleFolderContextMenu,
    handleRemoteGroupContextMenu,
  }
}
