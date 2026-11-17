'use client'

import React, { useState } from 'react'
import {
  LuBot,
  LuExternalLink,
  LuFolderGit2,
  LuGitBranch,
  LuGitBranchPlus,
  LuGitPullRequest,
  LuHash,
  LuPlus,
  LuShare2,
  LuShieldAlert,
  LuSparkles,
  LuText,
  LuTrash2,
  LuUser,
} from 'react-icons/lu'

import { Button, SwitchToggle } from '@/components/sk'
import { useContextMenuConfig } from '@/lib/git/context-menu-config'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

interface QuickActionDef {
  id: string
  label: string
  description: string
  shortcut?: string
  icon: React.ComponentType<{ className?: string }>
}

const AVAILABLE_QUICK_ACTIONS: QuickActionDef[] = [
  {
    id: 'copy-branch',
    label: '复制分支名',
    description: '复制当前所在或所选分支的完整名称',
    shortcut: '⌘C',
    icon: LuGitBranch,
  },
  {
    id: 'copy-hash',
    label: '复制 Commit Hash',
    description: '复制 40 位完整提交哈希值',
    shortcut: '⌘⇧C',
    icon: LuHash,
  },
  {
    id: 'copy-subject',
    label: '复制提交说明',
    description: '复制提交的首行说明（Subject）',
    shortcut: '⌥⌘C',
    icon: LuText,
  },
  {
    id: 'copy-author',
    label: '复制作者',
    description: '复制 Commit 提交者姓名与身份',
    shortcut: '⌘⌥C',
    icon: LuUser,
  },
  {
    id: 'checkout-branch',
    label: '切换/跳转到此分支',
    description: '快速将图谱视野聚焦并定位到所选分支的最新提交',
    icon: LuGitPullRequest,
  },
  {
    id: 'new-branch',
    label: '基于此分支新建…',
    description: '以当前选中的分支或提交为基线创建新的分支',
    icon: LuGitBranchPlus,
  },
  {
    id: 'open-remote',
    label: '在远程打开',
    description: '在浏览器新标签页中打开 GitHub / GitLab 对应提交或分支页面',
    icon: LuExternalLink,
  },
]

interface GroupDef {
  key: 'copy' | 'branch' | 'worktree' | 'remote' | 'agent'
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
    summary: '聚合切换分支、新建分支、重命名、合并当前、创建标签及删除分支',
    includedItems: ['切换分支', '新建分支…', '重命名分支…', '合并到当前…', '创建标签…', '删除分支 (危险)'],
    icon: LuGitBranch,
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
    label: '「在远程打开」入口',
    summary: '当仓库已配置远程仓库地址时，直接跳转网页端查看',
    includedItems: ['在远程仓库打开 (GitHub / GitLab)'],
    icon: LuExternalLink,
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
  const [newActionLabel, setNewActionLabel] = useState('')
  const [newActionPrompt, setNewActionPrompt] = useState('')
  const [isAddingAgentAction, setIsAddingAgentAction] = useState(false)

  const handleToggleQuickAction = (id: string, checked: boolean) => {
    const current = config.quickActions || []
    const updated = checked ? (current.includes(id) ? current : [...current, id]) : current.filter((item) => item !== id)
    setConfig({ ...config, quickActions: updated })
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

  const handleDeleteAgentAction = (id: string) => {
    const updated = (config.agentActions || []).filter((action) => action.id !== id)
    setConfig({ ...config, agentActions: updated })
  }

  const handleAddAgentAction = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedLabel = newActionLabel.trim()
    const trimmedPrompt = newActionPrompt.trim()
    if (!trimmedLabel || !trimmedPrompt) return

    const newId = `agent_custom_${Date.now()}`
    const updated = [
      ...(config.agentActions || []),
      {
        id: newId,
        label: trimmedLabel,
        prompt: trimmedPrompt,
        enabled: true,
      },
    ]

    setConfig({ ...config, agentActions: updated })
    setNewActionLabel('')
    setNewActionPrompt('')
    setIsAddingAgentAction(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 1. 快捷区 (Quick Actions Zone) */}
      <SettingsSectionCard
        title="快捷区（一级主菜单置顶直达）"
        description="勾选希望直接置顶显示在右键主菜单的一级操作。无需进入二级子菜单即可一键直达，适合超高频快捷操作。"
        descriptionTooltip="快捷区操作将直接呈现在右键主菜单顶部，与下方子菜单互不冲突。"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AVAILABLE_QUICK_ACTIONS.map((action) => {
            const isPinned = (config.quickActions || []).includes(action.id)
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-ink">{action.label}</span>
                      {action.shortcut && <kbd className="inline-block rounded border border-line bg-panel px-1 py-0.2 text-[10px] font-mono text-ink-soft">{action.shortcut}</kbd>}
                    </div>
                    <p className="text-[11px] text-ink-soft truncate mt-0.5">{action.description}</p>
                  </div>
                </div>

                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <SwitchToggle checked={isPinned} onCheckedChange={(val) => handleToggleQuickAction(action.id, val)} size="sm" aria-label={`置顶 ${action.label}`} />
                </div>
              </div>
            )
          })}
        </div>
      </SettingsSectionCard>

      {/* 2. 分组区 (Grouped / Cascading Area) */}
      <SettingsSectionCard
        title="分组区（二级子菜单分类收纳）"
        description="通过二级子菜单聚合归类操作，使主菜单始终保持在 4~5 项左右的紧凑尺寸，避免菜单项过多导致屏幕溢出或视觉杂乱。"
        descriptionTooltip="开启的二级子菜单将显示在主菜单中，鼠标悬停时平滑滑出二级子菜单。"
      >
        <div className="flex flex-col divide-y divide-line/60">
          {AVAILABLE_GROUPS.map((group) => {
            const isEnabled = config.enabledGroups[group.key]
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
                  <SwitchToggle checked={isEnabled} onCheckedChange={(val) => handleToggleGroup(group.key, val)} size="md" aria-label={`启用 ${group.label}`} />
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
                <LuShieldAlert className="size-3.5 text-fail shrink-0" />
                <span>危险操作二次确认 (防误触保护)</span>
              </div>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                开启后，针对「删除分支」等不可逆破坏性操作，首次点击将切换为确认状态（“确定删除？再次点击执行”），必须二次点击才会触发。
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              <SwitchToggle checked={config.dangerConfirm} onCheckedChange={handleToggleDangerConfirm} size="md" aria-label="危险操作二次确认" />
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
              <SwitchToggle checked={config.hideUnavailableCapabilities} onCheckedChange={handleToggleHideUnavailable} size="md" aria-label="仓库能力自适应过滤" />
            </div>
          </div>
        </fieldset>
      </SettingsSectionCard>

      {/* 4. Agent 智能菜单能力扩展 (Agent Assisted Menu Extensions) */}
      <SettingsSectionCard
        title="Agent 智能菜单扩展"
        description="管理在右键菜单「Agent 智能诊断 ›」中呈现的 AI 快捷指令。支持自定义 Prompt，点击时将当前分支或 Commit 自动填入提示词发起智能分析。"
        titleAction={
          !isAddingAgentAction ? (
            <Button variant="default" size="xs" onClick={() => setIsAddingAgentAction(true)} className="gap-1.5 text-xs font-medium cursor-pointer">
              <LuPlus className="size-3.5 text-accent" />
              <span>添加 Agent 动作</span>
            </Button>
          ) : null
        }
      >
        <div className="flex flex-col gap-2">
          {/* List of current Agent Menu Actions */}
          {(config.agentActions || []).map((agentAction) => {
            return (
              <div key={agentAction.id} className="flex items-start justify-between gap-3 rounded-lg border border-line/80 bg-panel-2/30 p-2.5 transition-all">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded bg-accent/15 text-accent">
                    <LuSparkles className="size-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink">{agentAction.label}</span>
                    </div>
                    <p className="text-[11px] text-ink-soft leading-relaxed font-mono mt-0.5 bg-panel/60 rounded px-1.5 py-1 border border-line/50">{agentAction.prompt}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <SwitchToggle
                    checked={agentAction.enabled}
                    onCheckedChange={(val) => handleToggleAgentAction(agentAction.id, val)}
                    size="sm"
                    aria-label={`启用 ${agentAction.label}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteAgentAction(agentAction.id)}
                    className="flex size-6 items-center justify-center rounded text-ink-soft hover:text-fail hover:bg-fail/10 transition-colors cursor-pointer"
                    title="删除此 Agent 动作"
                    aria-label={`删除 ${agentAction.label}`}
                  >
                    <LuTrash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Add Agent Action Inline Form */}
          {isAddingAgentAction && (
            <form onSubmit={handleAddAgentAction} className="flex flex-col gap-2.5 rounded-lg border border-accent/60 bg-panel p-3 shadow-md animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <LuSparkles className="size-3.5 text-accent" />
                  <span>添加新的 Agent 上下文动作</span>
                </span>
                <button type="button" onClick={() => setIsAddingAgentAction(false)} className="text-xs text-ink-soft hover:text-ink cursor-pointer">
                  取消
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-ink-soft">菜单显示名称</label>
                <input
                  type="text"
                  required
                  value={newActionLabel}
                  onChange={(e) => setNewActionLabel(e.target.value)}
                  placeholder="例如：AI 生成变更说明、检查冲突隐患…"
                  className="h-8 rounded border border-line bg-panel-2/60 px-2.5 text-xs text-ink placeholder:text-ink-soft/50 outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-ink-soft">向 Agent 发送的 Prompt 提示词</label>
                <textarea
                  required
                  rows={2}
                  value={newActionPrompt}
                  onChange={(e) => setNewActionPrompt(e.target.value)}
                  placeholder="例如：请分析当前分支的提交内容，并生成简洁的发布更新文档…"
                  className="rounded border border-line bg-panel-2/60 p-2 text-xs text-ink placeholder:text-ink-soft/50 outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="xs" onClick={() => setIsAddingAgentAction(false)}>
                  取消
                </Button>
                <Button type="submit" variant="accent" size="xs" disabled={!newActionLabel.trim() || !newActionPrompt.trim()}>
                  确认添加
                </Button>
              </div>
            </form>
          )}
        </div>
      </SettingsSectionCard>
    </div>
  )
}
