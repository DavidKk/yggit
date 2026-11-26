import { usePathname, useRouter } from 'next/navigation'
import type React from 'react'

import type { ModelFilterOptions } from './model-filter'
import type { AgentModelProfile } from './model-profiles'
import type { RedactionOptions } from './redact/types'
import { withSystemPrompt } from './system-prompt'
import type { AgentChatMessage, AgentDockMode, EphemeralAgentConfig } from './types'
import { getWorkdeskContext } from './workdesk-context'

export function buildAgentSystemMessages(history: AgentChatMessage[], skillsPrompt: string): AgentChatMessage[] {
  const base = withSystemPrompt(history)
  let extraSystem = skillsPrompt
  const wdCtx = getWorkdeskContext()
  if (wdCtx) {
    extraSystem += `\n\n[Active Workdesk Context]\n- Current Task: ${wdCtx.taskTitle}\n- Current Item: ${wdCtx.targetRef || ''}\n- Target Repository: ${wdCtx.repoAlias} (${wdCtx.repoIdentity})\n- Status: ${wdCtx.state}\n- Summary: ${wdCtx.summary}`
  }
  if (extraSystem) {
    const sys = base[0]
    return [{ ...sys, content: sys.content + extraSystem }, ...base.slice(1)]
  }
  return base
}

export function useOptionalRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter()
  } catch {
    return null
  }
}

export function useOptionalPathname(): string {
  try {
    return usePathname() || (typeof window !== 'undefined' ? window.location.pathname : '/')
  } catch {
    return typeof window !== 'undefined' ? window.location.pathname : '/'
  }
}

export const DEFAULT_REDACTION_OPTIONS: RedactionOptions = {
  enabled: true,
  categories: {
    secrets: true,
    pii: true,
    network: true,
    custom: true,
  },
  customWords: [],
  allowList: [],
}

export function resolveFallbackUiRoute(userPrompt: string, responseContent: string): string | null {
  const contentLower = responseContent.toLowerCase()
  const userLower = userPrompt.toLowerCase()

  if (
    userLower.includes('接入') ||
    userLower.includes('新增模型') ||
    userLower.includes('添加模型') ||
    userLower.includes('配置模型') ||
    contentLower.includes('settings_models_new')
  ) {
    const isChatGpt = userLower.includes('chatgpt') || contentLower.includes('chatgpt')
    const isOpenAi = userLower.includes('openai') || contentLower.includes('openai')
    return isChatGpt ? '/settings/models/new?provider=chatgpt' : isOpenAi ? '/settings/models/new?provider=openai' : '/settings/models/new'
  }
  if (contentLower.includes('settings_models') || userLower.includes('模型设置') || userLower.includes('模型列表')) {
    return '/settings/models'
  }
  if (contentLower.includes('settings_privacy') || userLower.includes('隐私设置') || userLower.includes('脱敏设置')) {
    return '/settings/privacy'
  }
  if (contentLower.includes('settings_general') || userLower.includes('通用设置')) {
    return '/settings/general'
  }
  if (contentLower.includes('settings_menus') || userLower.includes('菜单设置')) {
    return '/settings/menus'
  }
  return null
}

export interface AgentContextValue {
  config: EphemeralAgentConfig
  profiles: AgentModelProfile[]
  activeProfileId: string
  saveProfile: (profile: AgentModelProfile, options?: { clearApiKey?: boolean }) => void
  deleteProfile: (id: string) => void
  selectProfile: (id: string) => void
  toggleProfileEnabled: (id: string, enabled: boolean) => void
  redactionOptions: RedactionOptions
  setRedactionOptions: React.Dispatch<React.SetStateAction<RedactionOptions>>
  dockMode: AgentDockMode
  setDockMode: (mode: AgentDockMode) => void
  messages: AgentChatMessage[]
  isProcessing: boolean
  sendMessage: (content: string, repoPath?: string, options?: { quotedMessage?: AgentChatMessage['quotedMessage']; llmPrompt?: string }) => Promise<void>
  retryMessage: (assistantMsgId?: string) => Promise<void>
  clearMessages: () => void
  activeResultSummary: string | null
  activeRepo: string
  setActiveRepo: (repo: string) => void
  activeBranch?: string
  setActiveBranch?: (branch: string) => void
  modelFilter: ModelFilterOptions
  setModelFilter: React.Dispatch<React.SetStateAction<ModelFilterOptions>>
}
