'use client'

import { useCallback, useEffect, useState } from 'react'

export interface AgentCustomMenuAction {
  id: string
  label: string
  description?: string
  prompt: string
  enabled: boolean
}

export type ContextMenuPresetId = 'standard' | 'minimal' | 'review' | 'expert'

export interface ContextMenuPreset {
  id: ContextMenuPresetId
  name: string
  desc: string
  badge?: string
  quickActions: string[]
  enabledGroups: {
    copy: boolean
    branch: boolean
    commit: boolean
    view: boolean
    worktree: boolean
    remote: boolean
    agent: boolean
  }
}

export const CONTEXT_MENU_PRESETS: Record<ContextMenuPresetId, ContextMenuPreset> = {
  standard: {
    id: 'standard',
    name: '标准模式',
    desc: '按右键列智能聚焦首要操作，核心功能置顶，完整高级操作收纳于二级菜单',
    badge: '默认推荐',
    quickActions: ['checkout-branch', 'merge-branch', 'rebase-branch', 'new-branch'],
    enabledGroups: {
      copy: true,
      branch: true,
      commit: true,
      view: true,
      worktree: true,
      remote: true,
      agent: true,
    },
  },
  minimal: {
    id: 'minimal',
    name: '极简模式',
    desc: '极致简洁，一级仅保留最高频操作与快捷引用，最大化减少视觉干扰',
    badge: '极简',
    quickActions: ['checkout-branch', 'new-branch'],
    enabledGroups: {
      copy: true,
      branch: true,
      commit: true,
      view: false,
      worktree: false,
      remote: true,
      agent: true,
    },
  },
  review: {
    id: 'review',
    name: '审查模式',
    desc: '侧重代码审查、提交对比、工单卡片复制与远程仓库直达',
    badge: '代码审查',
    quickActions: ['checkout-branch', 'merge-branch', 'compare-workdir', 'copy-hash', 'open-remote'],
    enabledGroups: {
      copy: true,
      branch: true,
      commit: true,
      view: true,
      worktree: false,
      remote: true,
      agent: true,
    },
  },
  expert: {
    id: 'expert',
    name: '专家模式',
    desc: '展开变基、遴选、暂存等丰富快捷动作，适合高效键盘与鼠标流用户',
    badge: '全能',
    quickActions: ['checkout-branch', 'merge-branch', 'rebase-branch', 'cherry-pick', 'new-branch', 'stash-changes'],
    enabledGroups: {
      copy: true,
      branch: true,
      commit: true,
      view: true,
      worktree: true,
      remote: true,
      agent: true,
    },
  },
}

export interface ContextMenuUserConfig {
  /** 当前预设模式 */
  presetMode?: ContextMenuPresetId
  /** 快捷区：直接在主菜单一级置顶展示的操作 ID 列表（无需进入二级子菜单） */
  quickActions: string[]
  /** 分组区：各二级子菜单的启用状态 */
  enabledGroups: {
    copy: boolean
    branch: boolean
    commit?: boolean
    view?: boolean
    worktree: boolean
    remote: boolean
    agent: boolean
  }
  /** 配置区：危险操作必须二次确认 */
  dangerConfirm: boolean
  /** 配置区：根据仓库能力动态隐藏不可用操作（如只读模式隐藏本地写操作） */
  hideUnavailableCapabilities: boolean
  /** 配置区：Agent 协助提供的额外自定义菜单能力清单 */
  agentActions: AgentCustomMenuAction[]
}

export const CONTEXT_MENU_STORAGE_KEY = 'yggit.context-menu.config.v2'
const OLD_CONTEXT_MENU_STORAGE_KEY = 'yggit.context-menu.config.v1'

export const DEFAULT_CONTEXT_MENU_CONFIG: ContextMenuUserConfig = {
  presetMode: 'standard',
  quickActions: CONTEXT_MENU_PRESETS.standard.quickActions,
  enabledGroups: { ...CONTEXT_MENU_PRESETS.standard.enabledGroups },
  dangerConfirm: true,
  hideUnavailableCapabilities: true,
  agentActions: [
    {
      id: 'agent-review',
      label: 'AI 审查分支改动',
      prompt: '请分析该分支最新的改动内容，排查潜在代码缺陷并评估合入风险。',
      enabled: true,
    },
    {
      id: 'agent-unmerged',
      label: 'AI 诊断未合入提交',
      prompt: '请检查该分支与 master 分支的包含关系，统计未合入提交清单与改动说明。',
      enabled: true,
    },
  ],
}

export function loadContextMenuConfig(): ContextMenuUserConfig {
  if (typeof window === 'undefined') return DEFAULT_CONTEXT_MENU_CONFIG
  try {
    let raw = localStorage.getItem(CONTEXT_MENU_STORAGE_KEY)
    if (!raw) {
      // Migrate from v1 if present
      const oldRaw = localStorage.getItem(OLD_CONTEXT_MENU_STORAGE_KEY)
      if (oldRaw) {
        try {
          const oldParsed = JSON.parse(oldRaw)
          // If old quickActions was just the default 'copy-branch', upgrade to new defaults
          if (Array.isArray(oldParsed.quickActions) && oldParsed.quickActions.length === 1 && oldParsed.quickActions[0] === 'copy-branch') {
            oldParsed.quickActions = DEFAULT_CONTEXT_MENU_CONFIG.quickActions
          }
          raw = JSON.stringify(oldParsed)
          localStorage.setItem(CONTEXT_MENU_STORAGE_KEY, raw)
        } catch {
          // ignore parse error
        }
      }
    }
    if (!raw) return DEFAULT_CONTEXT_MENU_CONFIG
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_CONTEXT_MENU_CONFIG,
      ...parsed,
      quickActions: Array.isArray(parsed.quickActions) ? parsed.quickActions : DEFAULT_CONTEXT_MENU_CONFIG.quickActions,
      enabledGroups: {
        ...DEFAULT_CONTEXT_MENU_CONFIG.enabledGroups,
        ...(parsed.enabledGroups || {}),
      },
      agentActions: Array.isArray(parsed.agentActions) ? parsed.agentActions : DEFAULT_CONTEXT_MENU_CONFIG.agentActions,
    }
  } catch {
    return DEFAULT_CONTEXT_MENU_CONFIG
  }
}

export function saveContextMenuConfig(config: ContextMenuUserConfig): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CONTEXT_MENU_STORAGE_KEY, JSON.stringify(config))
    window.dispatchEvent(new CustomEvent('yggit-context-menu-config-changed', { detail: config }))
  } catch {
    // LocalStorage quota or privacy mode fallback
  }
}

export function useContextMenuConfig(): [ContextMenuUserConfig, (config: ContextMenuUserConfig) => void] {
  const [config, setConfig] = useState<ContextMenuUserConfig>(DEFAULT_CONTEXT_MENU_CONFIG)

  useEffect(() => {
    setConfig(loadContextMenuConfig())

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<ContextMenuUserConfig>
      if (customEvent.detail) {
        setConfig(customEvent.detail)
      } else {
        setConfig(loadContextMenuConfig())
      }
    }

    window.addEventListener('yggit-context-menu-config-changed', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('yggit-context-menu-config-changed', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const updateConfig = useCallback((newConfig: ContextMenuUserConfig) => {
    setConfig(newConfig)
    saveContextMenuConfig(newConfig)
  }, [])

  return [config, updateConfig]
}
