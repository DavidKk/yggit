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
    label: '切换到此分支 (Checkout)',
    category: 'branch',
    categoryLabel: '常用分支',
    description: '检出并切换工作区到目标分支，支持双击直接检出',
    badge: '推荐',
    badgeTone: 'accent',
    shortcut: '双击',
    icon: LuGitPullRequest,
  },
  {
    id: 'merge-branch',
    label: '合并到当前分支 (Merge)',
    category: 'branch',
    categoryLabel: '常用分支',
    description: '将所选分支快速合并进当前所在分支',
    badge: '推荐',
    badgeTone: 'accent',
    icon: LuGitMerge,
  },
  {
    id: 'rebase-branch',
    label: '变基到所选分支 (Rebase)',
    category: 'branch',
    categoryLabel: '常用分支',
    description: '以目标分支为基线重新应用当前分支提交',
    badge: '推荐',
    badgeTone: 'accent',
    icon: LuGitCommitHorizontal,
  },
  {
    id: 'new-branch',
    label: '基于此新建分支… (New)',
    category: 'branch',
    categoryLabel: '常用分支',
    description: '以当前选中的分支或提交为起点创建新分支',
    badge: '推荐',
    badgeTone: 'accent',
    icon: LuGitBranchPlus,
  },
  {
    id: 'rename-branch',
    label: '重命名分支… (Rename)',
    category: 'branch',
    categoryLabel: '常用分支',
    description: '修改当前分支或指定本地分支名称',
    icon: LuPencil,
  },
  {
    id: 'delete-branch',
    label: '删除此分支 (Delete)',
    category: 'branch',
    categoryLabel: '常用分支',
    description: '删除指定的本地分支',
    icon: LuTrash2,
  },
  {
    id: 'pin-branch',
    label: '固定到左侧 (Pin to Left)',
    category: 'branch',
    categoryLabel: '常用分支',
    description: '将常用分支固定在分支树快捷访问区',
    icon: LuPin,
  },
  {
    id: 'hide-branch',
    label: '隐藏分支 (Hide)',
    category: 'branch',
    categoryLabel: '常用分支',
    description: '隐藏不关注的分支泳道或目录',
    icon: LuEyeOff,
  },
  {
    id: 'create-tag',
    label: '创建标签… (Tag)',
    category: 'branch',
    categoryLabel: '常用分支',
    description: '在当前选中的提交或分支节点打标签',
    icon: LuTag,
  },
  {
    id: 'create-annotated-tag',
    label: '创建附注标签… (Annotated Tag)',
    category: 'branch',
    categoryLabel: '常用分支',
    description: '创建包含说明与作者签名的 Git 附注标签',
    icon: LuTag,
  },

  // 2. Remote synchronization and collaboration
  {
    id: 'pull-branch',
    label: '从远端拉取 (Pull)',
    category: 'sync',
    categoryLabel: '远端同步',
    description: '从远程对应上游分支拉取最新提交并合并',
    icon: LuArrowDownToLine,
  },
  {
    id: 'push-branch',
    label: '推送到远程 (Push)',
    category: 'sync',
    categoryLabel: '远端同步',
    description: '将本地分支推送到对应的远程仓库分支',
    icon: LuArrowUpFromLine,
  },
  {
    id: 'set-upstream',
    label: '设置上游分支… (Set Upstream)',
    category: 'sync',
    categoryLabel: '远端同步',
    description: '设置或修改本地分支关联跟踪的远程仓库分支',
    icon: LuCloud,
  },
  {
    id: 'open-remote',
    label: '在远程仓库打开 (Web)',
    category: 'sync',
    categoryLabel: '远端同步',
    description: '在浏览器新标签页中打开对应的远程仓库页面',
    icon: LuPanelTop,
  },

  // 3. Workspace and commits
  {
    id: 'stash-changes',
    label: '暂存当前更改 (Stash)',
    category: 'workspace',
    categoryLabel: '工作区与提交',
    description: '将工作区未提交修改暂存保存',
    icon: LuArchive,
  },
  {
    id: 'cherry-pick',
    label: '遴选此提交 (Cherry-pick)',
    category: 'workspace',
    categoryLabel: '工作区与提交',
    description: '将特定 Commit 的变动复制应用到当前分支上',
    icon: LuGitCommitHorizontal,
  },
  {
    id: 'reset-commit',
    label: '重置分支到此提交… (Reset)',
    category: 'workspace',
    categoryLabel: '工作区与提交',
    description: '将当前分支指针重置到所选提交位置',
    icon: LuRotateCcw,
  },
  {
    id: 'revert-commit',
    label: '撤销此提交 (Revert)',
    category: 'workspace',
    categoryLabel: '工作区与提交',
    description: '生成反向补丁提交撤销指定 Commit 的改动',
    icon: LuUndo2,
  },
  {
    id: 'compare-workdir',
    label: '与工作区对比 (Compare with Working Tree)',
    category: 'workspace',
    categoryLabel: '工作区与提交',
    description: '将所选提交快照与当前工作区未提交内容进行对比',
    icon: LuGitCompare,
  },

  // 4. Copy and share
  {
    id: 'copy-branch',
    label: '复制分支名',
    category: 'copy',
    categoryLabel: '复制与分享',
    description: '复制当前所在或所选分支的完整名称到剪贴板',
    shortcut: '⌘C',
    icon: LuGitBranch,
  },
  {
    id: 'copy-hash',
    label: '复制 Commit Hash',
    category: 'copy',
    categoryLabel: '复制与分享',
    description: '复制 40 位完整提交 SHA-1 哈希值',
    shortcut: '⌘⇧C',
    icon: LuHash,
  },
  {
    id: 'copy-subject',
    label: '复制提交说明',
    category: 'copy',
    categoryLabel: '复制与分享',
    description: '复制提交的第一行标题说明（Subject）',
    shortcut: '⌥⌘C',
    icon: LuText,
  },
  {
    id: 'copy-author',
    label: '复制作者信息',
    category: 'copy',
    categoryLabel: '复制与分享',
    description: '复制 Commit 提交者姓名与身份信息',
    shortcut: '⌘⌥C',
    icon: LuUser,
  },
  {
    id: 'copy-issue-card',
    label: '复制工单分享卡片 (Markdown)',
    category: 'copy',
    categoryLabel: '复制与分享',
    description: '生成包含仓库、分支、提交哈希与直达链接的 Markdown 引用卡片',
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
    label: '「复制 ›」二级菜单',
    summary: '聚合复制分支名、Hash、提交说明、作者、日期、分享链接与工单卡片',
    includedItems: ['复制分支名', 'Commit Hash', '提交说明', '作者', '提交日期', '分享链接', '工单分享卡片'],
    icon: LuShare2,
  },
  {
    key: 'branch',
    label: '「分支操作 ›」二级菜单',
    summary: '聚合切换分支、新建分支、重命名、合并、变基、拉取、推送及删除分支',
    includedItems: ['切换分支', '新建分支…', '重命名分支…', '合并到当前…', '变基到当前…', '拉取分支', '推送分支', '创建标签…', '删除分支 (危险)'],
    icon: LuGitBranch,
  },
  {
    key: 'commit',
    label: '「提交与重置 ›」二级菜单',
    summary: '聚合撤销提交 (Revert)、重置分支 (Reset)、遴选 (Cherry-pick) 等提交级操作',
    includedItems: ['撤销此提交 (Revert)', '重置分支到此提交…', '遴选此提交 (Cherry-pick)', '暂存当前更改'],
    icon: LuGitCommitHorizontal,
  },
  {
    key: 'view',
    label: '「视图与对比 ›」二级菜单',
    summary: '聚合工作区对比、隐藏/折叠、只看此分支等视图过滤动作',
    includedItems: ['与工作区对比', '隐藏', '只看此标签', '固定到左侧'],
    icon: LuGitCompare,
  },
  {
    key: 'worktree',
    label: '「Worktree ›」二级菜单',
    summary: '聚合在独立 Worktree 中检出分支及打开关联工作区',
    includedItems: ['在独立 Worktree 中检出…', '打开关联 Worktree 工作区'],
    icon: LuFolderGit2,
  },
  {
    key: 'remote',
    label: '「在远程仓库打开 ›」二级菜单',
    summary: '聚合在浏览器网页中直达查看此 Commit、分支、PR / MR 或仓库主页',
    includedItems: ['在网页打开此 Commit', '在网页打开此分支', '在网页创建 / 查看 PR', '打开仓库主页'],
    icon: LuPanelTop,
  },
  {
    key: 'agent',
    label: '「Agent 智能诊断 ›」二级菜单',
    summary: '调用 Git Agent 针对当前分支或提交执行 AI 审查、未合入排查或自定义诊断',
    includedItems: ['AI 审查分支改动', 'AI 诊断未合入提交', '自定义 Prompt 动作'],
    icon: LuBot,
  },
]

export function MenuSettingsSection() {
  const [config, setConfig] = useContextMenuConfig()
  const t = useT()
  const confirm = useConfirm()
  const notify = useNotification()
  const router = useRouter()
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
      onConfirm: () => setConfig({ ...config, agentActions: config.agentActions.filter((item) => item.id !== id) }),
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
      {/* 1. 快捷区 (Quick Actions Zone) */}
      <SettingsSectionCard title="快捷区（主菜单置顶直达）" description="选择在右键主菜单顶部直达的高频操作。">
        <div className="flex flex-col gap-3">
          {/* 预设切换栏 */}
          <div className="flex flex-col gap-2 rounded-lg border border-line/70 bg-panel-2/30 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-soft flex items-center gap-1.5">
                <LuSparkles className="size-3.5 text-accent" />
                <span>预设方案</span>
              </span>
              <span className="text-[11px] text-ink-soft">
                已置顶 <span className="font-semibold text-accent">{currentQuickActions.length}</span> 项
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
              { key: 'all' as const, label: `全部工具 (${AVAILABLE_QUICK_ACTIONS.length})` },
              { key: 'branch' as const, label: '常用分支', icon: LuGitBranch },
              { key: 'sync' as const, label: '远端同步', icon: LuRocket },
              { key: 'workspace' as const, label: '工作区与提交', icon: LuPackage },
              { key: 'copy' as const, label: '复制与分享', icon: LuClipboardList },
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

          {/* 工具卡片列表 */}
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
                    <SwitchToggle checked={isPinned} onCheckedChange={(val) => handleToggleQuickAction(action.id, val)} size="sm" aria-label={`置顶 ${action.label}`} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-line/60">
            <span className="text-[11px] text-ink-soft">若工具配置混乱，可随时恢复为官方推荐配置</span>
            <Button variant="default" size="sm" onClick={handleResetDefaults}>
              <LuRotateCcw className="size-3.5 mr-1 text-ink-soft" />
              <span>重置</span>
            </Button>
          </div>
        </div>
      </SettingsSectionCard>

      {/* 2. 分组区 (Grouped / Cascading Area) */}
      <SettingsSectionCard title="分组区（二级子菜单）" description="按类别收纳次高频操作，保持主菜单简洁。">
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
                      <span className="rounded-full bg-panel-2 px-1.5 py-0.2 text-[10px] text-ink-soft border border-line/60">包含 {group.includedItems.length} 项</span>
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
                  <SwitchToggle checked={isEnabled} onCheckedChange={(val) => handleToggleGroup(group.key, val)} size="sm" aria-label={`启用 ${group.label}`} />
                </div>
              </div>
            )
          })}
        </div>
      </SettingsSectionCard>

      {/* 3. 配置区 (Configuration & Extensibility Area) */}
      <SettingsSectionCard title="安全防护与动态自适应" description="管理菜单的安全防误触策略与基于仓库环境能力的动态自适应过滤。">
        <fieldset className="divide-y divide-line/60">
          {/* Row 1: Danger Confirm */}
          <div className="flex items-start justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <span>危险操作二次确认 (防误触保护)</span>
                <LuShieldAlert className="size-3.5 text-fail shrink-0" aria-hidden="true" />
              </div>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                开启后，针对「删除分支」等不可逆破坏性操作，首次点击将切换为确认状态（“确定删除？再次点击执行”），必须二次点击才会触发。
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              <SwitchToggle checked={config.dangerConfirm} onCheckedChange={handleToggleDangerConfirm} size="sm" aria-label="危险操作二次确认" />
            </div>
          </div>

          {/* Row 2: Dynamic Capability Filtering */}
          <div className="flex items-start justify-between gap-3 py-3 last:pb-0">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-ink">仓库能力自适应过滤</span>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                根据仓库的实际运行模式动态过滤菜单项：仅远程只读仓库自动隐藏无法执行的本地写操作；不支持 Worktree 的仓库自动隐藏 Worktree 子菜单。
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              <SwitchToggle checked={config.hideUnavailableCapabilities} onCheckedChange={handleToggleHideUnavailable} size="sm" aria-label="仓库能力自适应过滤" />
            </div>
          </div>
        </fieldset>
      </SettingsSectionCard>

      {/* 4. Agent 菜单自定义能力 */}
      <SettingsSectionCard
        title={t('gitAgent.menuActionsTitle')}
        description={t('gitAgent.menuActionsDesc')}
        titleAction={
          <Button variant="accent" size="sm" onClick={() => router.push('/settings/menus/new')}>
            <LuPlus className="size-3.5 mr-1" aria-hidden="true" />
            <span>{t('gitAgent.addAction')}</span>
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {(config.agentActions || []).map((action) => (
            <li key={action.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Link
                href={`/settings/menus/${encodeURIComponent(action.id)}`}
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
