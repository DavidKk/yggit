'use client'

import React, { useMemo } from 'react'
import { LuBot, LuChevronRight, LuExternalLink, LuEye, LuFolderGit2, LuGitBranch, LuShare2, LuShieldAlert, LuSparkles } from 'react-icons/lu'

import { Badge } from '@/components/sk'
import { useContextMenuConfig } from '@/lib/git/context-menu-config'

import { AVAILABLE_QUICK_ACTIONS } from './MenuSettingsSection'
import { SettingsSectionCard } from './SettingsSectionCard'

export function ContextMenuPreviewToolbar() {
  const [config] = useContextMenuConfig()
  const currentQuickActions = useMemo(() => config.quickActions || [], [config.quickActions])
  const activeAgentActions = useMemo(() => (config.agentActions || []).filter((a) => a.enabled), [config.agentActions])

  return (
    <SettingsSectionCard
      title={
        <div className="flex items-center gap-1.5">
          <LuEye className="size-4 text-accent" />
          <span>右键菜单实时效果预览</span>
        </div>
      }
      description="右键任意分支时的弹出菜单视图，修改左侧配置实时联动。"
      titleAction={
        <Badge tone="accent" size="mini">
          Live
        </Badge>
      }
    >
      <div className="flex flex-col gap-2.5">
        {/* Mock branch chip */}
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-paper-2 border border-line text-xs font-mono text-ink-soft">
          <span className="flex items-center gap-1.5 truncate text-ink font-semibold">
            <LuGitBranch className="size-3.5 text-accent shrink-0" />
            <span className="truncate">feature/payment-v2</span>
          </span>
          <span className="text-[10px] text-ink-soft/70 shrink-0">模拟分支</span>
        </div>

        {/* Mock Context Menu Window */}
        <div className="rounded-lg border border-line bg-panel p-1.5 shadow-lg flex flex-col gap-0.5 select-none">
          {/* Quick Actions Zone */}
          {currentQuickActions.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {currentQuickActions.map((actionId) => {
                const def = AVAILABLE_QUICK_ACTIONS.find((a) => a.id === actionId)
                if (!def) return null
                const Icon = def.icon
                return (
                  <div key={actionId} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs text-ink hover:bg-accent/10 transition-colors">
                    <span className="flex items-center gap-2 truncate font-medium">
                      <Icon className="size-3.5 text-accent shrink-0" />
                      <span className="truncate">{def.label.split(' (')[0]}</span>
                    </span>
                    {def.shortcut && <span className="text-[10px] font-mono text-ink-soft">{def.shortcut}</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-2 py-1.5 text-center text-xs text-ink-soft italic">(暂无置顶快捷工具)</div>
          )}

          <div className="my-1 h-px bg-line/60" />

          {/* Submenu Groups Zone */}
          <div className="flex flex-col gap-0.5 text-xs text-ink-soft">
            {config.enabledGroups.copy && (
              <div className="flex items-center justify-between rounded px-2 py-1 hover:bg-paper-2 transition-colors">
                <span className="flex items-center gap-2">
                  <LuShare2 className="size-3.5 text-ink-soft" />
                  <span>复制</span>
                </span>
                <LuChevronRight className="size-3" />
              </div>
            )}
            {config.enabledGroups.branch && (
              <div className="flex items-center justify-between rounded px-2 py-1 hover:bg-paper-2 transition-colors">
                <span className="flex items-center gap-2">
                  <LuGitBranch className="size-3.5 text-ink-soft" />
                  <span>分支操作</span>
                </span>
                <LuChevronRight className="size-3" />
              </div>
            )}
            {config.enabledGroups.worktree && (
              <div className="flex items-center justify-between rounded px-2 py-1 hover:bg-paper-2 transition-colors">
                <span className="flex items-center gap-2">
                  <LuFolderGit2 className="size-3.5 text-ink-soft" />
                  <span>Worktree</span>
                </span>
                <LuChevronRight className="size-3" />
              </div>
            )}
            {config.enabledGroups.remote && (
              <div className="flex items-center justify-between rounded px-2 py-1 hover:bg-paper-2 transition-colors">
                <span className="flex items-center gap-2">
                  <LuExternalLink className="size-3.5 text-ink-soft" />
                  <span>在远程仓库打开</span>
                </span>
              </div>
            )}
            {config.enabledGroups.agent && (
              <div className="flex items-center justify-between rounded px-2 py-1 hover:bg-paper-2 text-accent font-medium transition-colors">
                <span className="flex items-center gap-2">
                  <LuBot className="size-3.5" />
                  <span>Agent 智能诊断</span>
                </span>
                <LuChevronRight className="size-3" />
              </div>
            )}
          </div>

          {/* Active Agent Actions nested hint */}
          {config.enabledGroups.agent && activeAgentActions.length > 0 && (
            <div className="mt-1 pt-1 border-t border-dashed border-line/60 px-2 pb-0.5">
              <span className="text-[10px] text-ink-soft/70 block mb-1">Agent 扩展能力:</span>
              <div className="flex flex-wrap gap-1">
                {activeAgentActions.map((action) => (
                  <span key={action.id} className="text-[10px] rounded bg-accent/10 text-accent px-1.5 py-0.5 font-medium truncate max-w-[130px]">
                    {action.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feature status badges */}
        <div className="flex flex-col gap-1.5 pt-1">
          {config.dangerConfirm && (
            <div className="flex items-center gap-1.5 text-[11px] text-fail/90 bg-fail/10 border border-fail/20 rounded p-2">
              <LuShieldAlert className="size-3.5 shrink-0 text-fail" />
              <span>危险操作二次确认保护已开启</span>
            </div>
          )}
          {config.hideUnavailableCapabilities && (
            <div className="flex items-center gap-1.5 text-[11px] text-ink-soft bg-paper-2 border border-line rounded p-2">
              <LuSparkles className="size-3.5 shrink-0 text-accent" />
              <span>仓库能力自适应过滤已启用</span>
            </div>
          )}
        </div>
      </div>
    </SettingsSectionCard>
  )
}
