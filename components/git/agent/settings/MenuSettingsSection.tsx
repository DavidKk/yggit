'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'
import {
  LuArchive,
  LuArrowDownToLine,
  LuArrowUpFromLine,
  LuBot,
  LuClipboardList,
  LuCloud,
  LuEyeOff,
  LuFolderGit2,
  LuGitBranch,
  LuGitBranchPlus,
  LuGitCommitHorizontal,
  LuGitCompare,
  LuGitMerge,
  LuGitPullRequest,
  LuHash,
  LuPackage,
  LuPanelTop,
  LuPencil,
  LuPin,
  LuPlus,
  LuRocket,
  LuRotateCcw,
  LuShare2,
  LuShieldAlert,
  LuSparkles,
  LuTag,
  LuText,
  LuTrash2,
  LuUndo2,
  LuUser,
} from 'react-icons/lu'

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, SwitchToggle } from '@/components/sk'
import { CONTEXT_MENU_PRESETS, ContextMenuPresetId, useContextMenuConfig } from '@/lib/git/context-menu-config'
import { useModeHref } from '@/lib/git/driver'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

export type ActionCategory = 'all' | 'branch' | 'sync' | 'workspace' | 'copy'

export interface QuickActionDef {
  id: string
  label: string
  category: 'branch' | 'sync' | 'workspace' | 'copy'
  categoryLabel: string
  description: string
  badge?: string
  badgeTone?: 'accent' | 'ok' | 'fail' | 'neutral' | 'warn'
  shortcut?: string
  icon: React.ComponentType<{ className?: string }>
}

export const AVAILABLE_QUICK_ACTIONS: QuickActionDef[] = [
  // 1. Common branch operations (default recommended)
  {
    id: 'checkout-branch',
    label: 'Checkout Branch',
    category: 'branch',
    categoryLabel: 'Branches',
    description: 'Check out and switch the working tree to the target branch (supports double-click)',
    badge: 'Recommended',
    badgeTone: 'accent',
    shortcut: 'Double-click',
    icon: LuGitPullRequest,
  },
  {
    id: 'merge-branch',
    label: 'Merge into Current',
    category: 'branch',
    categoryLabel: 'Branches',
    description: 'Quickly merge the selected branch into the current branch',
    badge: 'Recommended',
    badgeTone: 'accent',
    icon: LuGitMerge,
  },
  {
    id: 'rebase-branch',
    label: 'Rebase onto Selected',
    category: 'branch',
    categoryLabel: 'Branches',
    description: 'Reapply current branch commits on top of the target branch',
    badge: 'Recommended',
    badgeTone: 'accent',
    icon: LuGitCommitHorizontal,
  },
  {
    id: 'new-branch',
    label: 'New Branch from Here…',
    category: 'branch',
    categoryLabel: 'Branches',
    description: 'Create a new branch starting from the selected branch or commit',
    badge: 'Recommended',
    badgeTone: 'accent',
    icon: LuGitBranchPlus,
  },
  {
    id: 'rename-branch',
    label: 'Rename Branch…',
    category: 'branch',
    categoryLabel: 'Branches',
    description: 'Rename the current or selected local branch',
    icon: LuPencil,
  },
  {
    id: 'delete-branch',
    label: 'Delete Branch',
    category: 'branch',
    categoryLabel: 'Branches',
    description: 'Delete the selected local branch',
    icon: LuTrash2,
  },
  {
    id: 'pin-branch',
    label: 'Pin to Left',
    category: 'branch',
    categoryLabel: 'Branches',
    description: 'Pin frequently used branches to the branch tree quick-access area',
    icon: LuPin,
  },
  {
    id: 'hide-branch',
    label: 'Hide Branch',
    category: 'branch',
    categoryLabel: 'Branches',
    description: 'Hide branch lanes or folders you do not want to track',
    icon: LuEyeOff,
  },
  {
    id: 'create-tag',
    label: 'Create Tag…',
    category: 'branch',
    categoryLabel: 'Branches',
    description: 'Create a lightweight tag on the selected commit or branch',
    icon: LuTag,
  },
  {
    id: 'create-annotated-tag',
    label: 'Create Annotated Tag…',
    category: 'branch',
    categoryLabel: 'Branches',
    description: 'Create an annotated Git tag with message and author signature',
    icon: LuTag,
  },

  // 2. Remote synchronization and collaboration
  {
    id: 'pull-branch',
    label: 'Pull from Remote',
    category: 'sync',
    categoryLabel: 'Remote Sync',
    description: 'Fetch and merge latest commits from the upstream remote branch',
    icon: LuArrowDownToLine,
  },
  {
    id: 'push-branch',
    label: 'Push to Remote',
    category: 'sync',
    categoryLabel: 'Remote Sync',
    description: 'Push the local branch to its corresponding remote branch',
    icon: LuArrowUpFromLine,
  },
  {
    id: 'set-upstream',
    label: 'Set Upstream…',
    category: 'sync',
    categoryLabel: 'Remote Sync',
    description: 'Configure or change the remote tracking branch for this local branch',
    icon: LuCloud,
  },
  {
    id: 'open-remote',
    label: 'Open in Remote (Web)',
    category: 'sync',
    categoryLabel: 'Remote Sync',
    description: 'Open the corresponding remote repository page in a new browser tab',
    icon: LuPanelTop,
  },

  // 3. Workspace and commits
  {
    id: 'stash-changes',
    label: 'Stash Changes',
    category: 'workspace',
    categoryLabel: 'Workspace & Commits',
    description: 'Stash uncommitted working tree modifications',
    icon: LuArchive,
  },
  {
    id: 'cherry-pick',
    label: 'Cherry-pick Commit',
    category: 'workspace',
    categoryLabel: 'Workspace & Commits',
    description: 'Apply changes from a specific commit onto the current branch',
    icon: LuGitCommitHorizontal,
  },
  {
    id: 'reset-commit',
    label: 'Reset Branch to Commit…',
    category: 'workspace',
    categoryLabel: 'Workspace & Commits',
    description: 'Reset the current branch pointer to the selected commit',
    icon: LuRotateCcw,
  },
  {
    id: 'revert-commit',
    label: 'Revert Commit',
    category: 'workspace',
    categoryLabel: 'Workspace & Commits',
    description: 'Create a new commit that reverses the changes of the selected commit',
    icon: LuUndo2,
  },
  {
    id: 'compare-workdir',
    label: 'Compare with Working Tree',
    category: 'workspace',
    categoryLabel: 'Workspace & Commits',
    description: 'Compare the selected commit snapshot with uncommitted working tree changes',
    icon: LuGitCompare,
  },

  // 4. Copy and share
  {
    id: 'copy-branch',
    label: 'Copy Branch Name',
    category: 'copy',
    categoryLabel: 'Copy & Share',
    description: 'Copy the full name of the current or selected branch to the clipboard',
    shortcut: '⌘C',
    icon: LuGitBranch,
  },
  {
    id: 'copy-hash',
    label: 'Copy Commit Hash',
    category: 'copy',
    categoryLabel: 'Copy & Share',
    description: 'Copy the full 40-character SHA-1 commit hash',
    shortcut: '⌘⇧C',
    icon: LuHash,
  },
  {
    id: 'copy-subject',
    label: 'Copy Commit Subject',
    category: 'copy',
    categoryLabel: 'Copy & Share',
    description: 'Copy the first line (subject) of the commit message',
    shortcut: '⌥⌘C',
    icon: LuText,
  },
  {
    id: 'copy-author',
    label: 'Copy Author Info',
    category: 'copy',
    categoryLabel: 'Copy & Share',
    description: 'Copy the commit author name and email identity',
    shortcut: '⌘⌥C',
    icon: LuUser,
  },
  {
    id: 'copy-issue-card',
    label: 'Copy Issue Card (Markdown)',
    category: 'copy',
    categoryLabel: 'Copy & Share',
    description: 'Generate a Markdown quote card with repository, branch, commit hash, and direct link',
    icon: LuShare2,
  },
]

interface GroupDef {
  key: 'copy' | 'branch' | 'commit' | 'view' | 'worktree' | 'remote' | 'agent'
  label: string
  summary: string
  includedItems: string[]
  icon: React.ComponentType<{ className?: string }>
}

const AVAILABLE_GROUPS: GroupDef[] = [
  {
    key: 'copy',
    label: '"Copy ›" Submenu',
    summary: 'Groups Copy Branch Name, Hash, Subject, Author, Date, Share Link, and Issue Card',
    includedItems: ['Copy Branch Name', 'Commit Hash', 'Commit Subject', 'Author', 'Commit Date', 'Share Link', 'Issue Card'],
    icon: LuShare2,
  },
  {
    key: 'branch',
    label: '"Branch Actions ›" Submenu',
    summary: 'Groups Checkout, New Branch, Rename, Merge, Rebase, Pull, Push, and Delete Branch',
    includedItems: ['Checkout', 'New Branch…', 'Rename Branch…', 'Merge into Current…', 'Rebase onto Current…', 'Pull', 'Push', 'Create Tag…', 'Delete Branch (Danger)'],
    icon: LuGitBranch,
  },
  {
    key: 'commit',
    label: '"Commit & Reset ›" Submenu',
    summary: 'Groups commit-level actions such as Revert, Reset, Cherry-pick, and Stash',
    includedItems: ['Revert Commit', 'Reset Branch to Commit…', 'Cherry-pick Commit', 'Stash Changes'],
    icon: LuGitCommitHorizontal,
  },
  {
    key: 'view',
    label: '"View & Compare ›" Submenu',
    summary: 'Groups view filters such as Compare with Working Tree, Hide, Only This Branch, and Pin to Left',
    includedItems: ['Compare with Working Tree', 'Hide', 'Only This Ref', 'Pin to Left'],
    icon: LuGitCompare,
  },
  {
    key: 'worktree',
    label: '"Worktree ›" Submenu',
    summary: 'Groups checking out a branch in an isolated Worktree and opening linked Worktree workspaces',
    includedItems: ['Checkout in Isolated Worktree…', 'Open Linked Worktree Workspace'],
    icon: LuFolderGit2,
  },
  {
    key: 'remote',
    label: '"Open in Remote ›" Submenu',
    summary: 'Groups direct browser links to view the Commit, Branch, PR / MR, or Repository Home',
    includedItems: ['Open Commit in Web', 'Open Branch in Web', 'Create / View PR in Web', 'Open Repository Home'],
    icon: LuPanelTop,
  },
  {
    key: 'agent',
    label: '"Agent Diagnostics ›" Submenu',
    summary: 'Invoke Yggi for AI diff review, unmerged commit checks, or custom prompt diagnostics',
    includedItems: ['AI Review Branch Changes', 'AI Diagnose Unmerged Commits', 'Custom Prompt Actions'],
    icon: LuBot,
  },
]

export function MenuSettingsSection() {
  const [config, setConfig] = useContextMenuConfig()
  const t = useT()
  const confirm = useConfirm()
  const notify = useNotification()
  const router = useRouter()
  const modeHref = useModeHref()
  const [activeCategory, setActiveCategory] = useState<ActionCategory>('all')

  const currentQuickActions = useMemo(() => config.quickActions || [], [config.quickActions])

  const handleToggleQuickAction = (id: string, checked: boolean) => {
    const current = config.quickActions || []
    const updated = checked ? (current.includes(id) ? current : [...current, id]) : current.filter((item) => item !== id)
    setConfig({ ...config, quickActions: updated })
  }

  const applyPreset = (presetId: ContextMenuPresetId) => {
    const preset = CONTEXT_MENU_PRESETS[presetId]
    if (!preset) return
    setConfig({
      ...config,
      presetMode: presetId,
      quickActions: [...preset.quickActions],
      enabledGroups: {
        ...config.enabledGroups,
        ...preset.enabledGroups,
      },
    })
    notify.success(t('gitAgent.presetApplied', { name: preset.name }) || `Applied preset "${preset.name}"`)
  }

  const handleResetDefaults = () => {
    setConfig({
      ...config,
      presetMode: 'standard',
      quickActions: [...CONTEXT_MENU_PRESETS.standard.quickActions],
      enabledGroups: {
        ...config.enabledGroups,
        ...CONTEXT_MENU_PRESETS.standard.enabledGroups,
      },
    })
    notify.success(t('gitAgent.presetReset') || 'Restored to standard mode configuration')
  }

  const handleToggleGroup = (key: keyof typeof config.enabledGroups, checked: boolean) => {
    setConfig({
      ...config,
      enabledGroups: {
        ...config.enabledGroups,
        [key]: checked,
      },
    })
  }

  const handleToggleDangerConfirm = (checked: boolean) => {
    setConfig({ ...config, dangerConfirm: checked })
  }

  const handleToggleHideUnavailable = (checked: boolean) => {
    setConfig({ ...config, hideUnavailableCapabilities: checked })
  }

  const handleToggleAgentAction = (id: string, checked: boolean) => {
    const updated = (config.agentActions || []).map((action) => (action.id === id ? { ...action, enabled: checked } : action))
    setConfig({ ...config, agentActions: updated })
  }

  const handleDeleteAgentAction = async (id: string) => {
    const action = config.agentActions.find((item) => item.id === id)
    if (!action) return
    await confirm({
      title: t('gitAgent.deleteActionConfirm', { name: action.label }),
      description: t('gitAgent.deleteActionHint'),
      confirmLabel: t('gitAgent.deleteAction', { name: action.label }),
      confirmVariant: 'fail',
      onConfirm: () => {
        setConfig({ ...config, agentActions: config.agentActions.filter((item) => item.id !== id) })
        notify.success(t('common.remove') ? `${action.label} removed` : 'Action removed')
      },
    })
  }

  const filteredActions = useMemo(() => {
    if (activeCategory === 'all') return AVAILABLE_QUICK_ACTIONS
    return AVAILABLE_QUICK_ACTIONS.filter((action) => action.category === activeCategory)
  }, [activeCategory])

  const activePresetId = useMemo(() => {
    for (const [id, preset] of Object.entries(CONTEXT_MENU_PRESETS)) {
      if (preset.quickActions.length === currentQuickActions.length && preset.quickActions.every((act) => currentQuickActions.includes(act))) {
        return id as ContextMenuPresetId
      }
    }
    return config.presetMode || null
  }, [config.presetMode, currentQuickActions])

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Quick Actions Zone */}
      <SettingsSectionCard title="Quick Actions (Pinned to Top)" description="Choose high-frequency actions pinned to the top of the branch context menu.">
        <div className="flex flex-col gap-3">
          {/* Preset switcher bar */}
          <div className="flex flex-col gap-2 rounded-lg border border-line/70 bg-panel-2/30 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-soft flex items-center gap-1.5">
                <LuSparkles className="size-3.5 text-accent" />
                <span>Presets</span>
              </span>
              <span className="text-[11px] text-ink-soft">
                Pinned <span className="font-semibold text-accent">{currentQuickActions.length}</span> items
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {Object.values(CONTEXT_MENU_PRESETS).map((preset) => {
                const active = activePresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className={cn(
                      'flex flex-col gap-1 rounded-lg border p-2.5 text-left transition-all cursor-pointer select-none',
                      active
                        ? 'border-accent bg-accent/10 text-accent font-semibold shadow-2xs ring-1 ring-accent/30'
                        : 'border-line/70 bg-panel text-ink hover:border-line hover:bg-panel-2'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-ink">{preset.name}</span>
                      {preset.badge && (
                        <Badge tone={active ? 'accent' : 'neutral'} size="mini" dot={false}>
                          {preset.badge}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-ink-soft font-normal leading-tight line-clamp-2">{preset.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-line/60 pb-1.5 pt-0.5">
            {[
              { key: 'all' as const, label: `All (${AVAILABLE_QUICK_ACTIONS.length})` },
              { key: 'branch' as const, label: 'Branches', icon: LuGitBranch },
              { key: 'sync' as const, label: 'Remote Sync', icon: LuRocket },
              { key: 'workspace' as const, label: 'Workspace & Commits', icon: LuPackage },
              { key: 'copy' as const, label: 'Copy & Share', icon: LuClipboardList },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveCategory(tab.key as ActionCategory)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer select-none whitespace-nowrap',
                    activeCategory === tab.key ? 'bg-accent/15 text-accent font-semibold' : 'text-ink-soft hover:bg-panel-2 hover:text-ink'
                  )}
                >
                  {Icon && <Icon className="size-3.5 shrink-0" />}
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tool cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredActions.map((action) => {
              const isPinned = currentQuickActions.includes(action.id)
              const Icon = action.icon
              return (
                <div
                  key={action.id}
                  onClick={() => handleToggleQuickAction(action.id, !isPinned)}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-all cursor-pointer select-none',
                    isPinned ? 'border-accent/80 bg-accent/5 shadow-2xs' : 'border-line/70 bg-panel-2/40 hover:bg-panel-2/80 hover:border-line'
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border text-xs',
                        isPinned ? 'border-accent/40 bg-accent/15 text-accent font-semibold' : 'border-line/70 bg-panel text-ink-soft'
                      )}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-ink">{action.label}</span>
                        {action.badge && (
                          <Badge tone={action.badgeTone || 'neutral'} size="mini" dot={false}>
                            {action.badge}
                          </Badge>
                        )}
                        {action.shortcut && (
                          <kbd className="inline-block rounded border border-line bg-panel px-1 py-0.2 text-[10px] font-mono text-ink-soft">{action.shortcut}</kbd>
                        )}
                      </div>
                      <p className="text-[11px] text-ink-soft leading-tight mt-1">{action.description}</p>
                    </div>
                  </div>

                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <SwitchToggle checked={isPinned} onCheckedChange={(val) => handleToggleQuickAction(action.id, val)} size="sm" aria-label={`Pin ${action.label}`} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-line/60">
            <span className="text-[11px] text-ink-soft">Restore recommended defaults anytime if needed</span>
            <Button variant="default" size="sm" onClick={handleResetDefaults}>
              <LuRotateCcw className="size-3.5 mr-1 text-ink-soft" />
              <span>Reset</span>
            </Button>
          </div>
        </div>
      </SettingsSectionCard>

      {/* 2. Grouped / Cascading Area */}
      <SettingsSectionCard title="Grouped Submenus" description="Organize secondary actions into cascading submenus to keep the root menu clean.">
        <div className="flex flex-col divide-y divide-line/60">
          {AVAILABLE_GROUPS.map((group) => {
            const isEnabled = Boolean(config.enabledGroups[group.key])
            const Icon = group.icon
            return (
              <div key={group.key} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border text-xs',
                      isEnabled ? 'border-accent/40 bg-accent/15 text-accent' : 'border-line/70 bg-panel text-ink-soft'
                    )}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink">{group.label}</span>
                      <span className="rounded-full bg-panel-2 px-1.5 py-0.2 text-[10px] text-ink-soft border border-line/60">{group.includedItems.length} items</span>
                    </div>
                    <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{group.summary}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {group.includedItems.map((item) => (
                        <span key={item} className="inline-block rounded bg-panel px-1.5 py-0.5 text-[10px] text-ink-soft border border-line/60 font-mono">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 pt-0.5">
                  <SwitchToggle checked={isEnabled} onCheckedChange={(val) => handleToggleGroup(group.key, val)} size="sm" aria-label={`Enable ${group.label}`} />
                </div>
              </div>
            )
          })}
        </div>
      </SettingsSectionCard>

      {/* 3. Configuration & Extensibility Area */}
      <SettingsSectionCard title="Safety & Adaptive Filtering" description="Manage accidental-click protection and repository capability-based menu filtering.">
        <fieldset className="divide-y divide-line/60">
          {/* Row 1: Danger Confirm */}
          <div className="flex items-start justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <span>Two-Step Confirmation for Destructive Actions</span>
                <LuShieldAlert className="size-3.5 text-fail shrink-0" aria-hidden="true" />
              </div>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                When enabled, irreversible actions such as Delete Branch switch to a confirmation state on first click and require a second click to execute.
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              <SwitchToggle checked={config.dangerConfirm} onCheckedChange={handleToggleDangerConfirm} size="sm" aria-label="Two-step confirmation for destructive actions" />
            </div>
          </div>

          {/* Row 2: Dynamic Capability Filtering */}
          <div className="flex items-start justify-between gap-3 py-3 last:pb-0">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-ink">Adaptive Repository Capability Filtering</span>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                Dynamically hides menu items unsupported by the current repository runtime, such as local write actions in read-only mode or Worktree submenus when unavailable.
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              <SwitchToggle
                checked={config.hideUnavailableCapabilities}
                onCheckedChange={handleToggleHideUnavailable}
                size="sm"
                aria-label="Adaptive repository capability filtering"
              />
            </div>
          </div>
        </fieldset>
      </SettingsSectionCard>

      {/* 4. Agent Custom Menu Actions */}
      <SettingsSectionCard
        title={t('gitAgent.menuActionsTitle')}
        description={t('gitAgent.menuActionsDesc')}
        titleAction={
          <Button variant="accent" size="sm" onClick={() => router.push(modeHref('/settings/menus/new'))}>
            <LuPlus className="size-3.5 mr-1" aria-hidden="true" />
            <span>{t('gitAgent.addAction')}</span>
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {(config.agentActions || []).map((action) => (
            <li key={action.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Link
                href={modeHref(`/settings/menus/${encodeURIComponent(action.id)}`)}
                className="group min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={t('gitAgent.editNamedAction', { name: action.label })}
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink group-hover:text-accent">
                  {action.label}
                  <LuPencil className="size-3" aria-hidden="true" />
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-soft">{action.description || action.prompt}</span>
              </Link>
              <Button size="mini" variant="plain" aria-label={t('gitAgent.deleteAction', { name: action.label })} onClick={() => handleDeleteAgentAction(action.id)}>
                <LuTrash2 className="size-3.5" aria-hidden="true" />
              </Button>
              <SwitchToggle
                checked={action.enabled}
                onCheckedChange={(checked) => handleToggleAgentAction(action.id, checked)}
                size="sm"
                aria-label={t('gitAgent.enableAction', { name: action.label })}
              />
            </li>
          ))}
        </ul>
      </SettingsSectionCard>
    </div>
  )
}
