'use client'

import { useRouter } from 'next/navigation'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { type ThemePreference, writeStoredTheme } from '@/lib/theme'

import { DEFAULT_MODEL_FILTER, isModelAllowed, type ModelFilterOptions } from './model-filter'
import { type AgentModelProfile, DEFAULT_MODEL_PROFILE, MODEL_PROFILES_STORAGE_KEY, parseModelProfiles, serializeModelProfiles } from './model-profiles'
import { sendAgentCompletion } from './openapi-client'
import { createRedactionSession } from './redact/engine'
import { RedactionEngine } from './redact/engine'
import type { RedactionOptions, RedactionSession } from './redact/types'
import { useOptionalSpotlight } from './spotlight-context'
import { AGENT_GIT_TOOLS, executeAgentTool } from './tools'
import type { AgentChatMessage, AgentDockMode, EphemeralAgentConfig } from './types'

export interface AgentContextValue {
  config: EphemeralAgentConfig
  profiles: AgentModelProfile[]
  activeProfileId: string
  saveProfile: (profile: AgentModelProfile) => void
  deleteProfile: (id: string) => void
  selectProfile: (id: string) => void
  redactionOptions: RedactionOptions
  setRedactionOptions: React.Dispatch<React.SetStateAction<RedactionOptions>>
  dockMode: AgentDockMode
  setDockMode: (mode: AgentDockMode) => void
  messages: AgentChatMessage[]
  isProcessing: boolean
  sendMessage: (content: string, repoPath?: string) => Promise<void>
  clearMessages: () => void
  activeResultSummary: string | null
  activeRepo: string
  setActiveRepo: (repo: string) => void
  modelFilter: ModelFilterOptions
  setModelFilter: React.Dispatch<React.SetStateAction<ModelFilterOptions>>
}

export const AgentContext = createContext<AgentContextValue | null>(null)

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

const AGENT_SYSTEM_PROMPT: AgentChatMessage = {
  id: 'system_instructions',
  role: 'system',
  content: `You are Git Agent, an expert Git diagnostic and application assistant embedded in Yggdrasil.
You have direct, standardized tool access to control Yggdrasil application capabilities and analyze repositories:

[Application Control & Navigation Capabilities]
- open_project: Open or switch to a registered repository/project in Yggdrasil by name, path, or ID (e.g. "帮我打开 test 项目", "切换到 admin 仓库", "进入 test 项目"). ALWAYS call open_project when the user asks to open or switch projects.
- list_projects: List all registered projects/repositories in Yggdrasil. Call this tool when the user asks what projects are available, or before opening a project if uncertain of the exact name.
- navigate_ui: Navigate to application pages or open UI panels when user requests to open settings, switch panels, or add/configure models. Destination targets:
  * "settings_models_new": New model configuration page (/settings/models/new). ALWAYS call navigate_ui with "settings_models_new" when user asks to add/configure/connect a new model (e.g. "帮我接入新 CHATGPT 模型", "新建模型", "接入模型", "添加大模型").
  * "settings_models": Models list & settings page (/settings/models).
  * "settings_privacy": Privacy & masking settings (/settings/privacy).
  * "settings_general": General settings (/settings/general).
  * "settings_menus": Context menu actions settings (/settings/menus).
  * "git_home": Repository catalog home (/git).
  * Panels: "panel_commit", "panel_conflicts", "panel_worktree", "panel_branches", "panel_stash", "panel_tags".
CRITICAL: You MUST actually call navigate_ui tool via tool_calls! Do not merely claim in text that the page is opened without calling the tool.
- set_ui_theme: Switch application appearance theme between "auto" (跟随系统), "light" (浅色模式), and "dark" (深色模式) (e.g. "切换深色模式", "切浅色模式", "切换为系统主题").

[Git Repository Diagnostic Capabilities]
- focus_branch: Focus and jump the visual Git graph view to a specific branch (e.g. "feat/agent-system"). In Yggdrasil, when a user asks to "跳转到/切换到/定位到/选中某分支", they mean focusing and jumping the visual Git graph to that branch's latest commit, NOT running git checkout on the local disk. ALWAYS call focus_branch for requests like "帮我跳转到 xxx", "切换到 xxx 分支", "定位分支 xxx", etc.
- get_unmerged_branches: Check which branches have not yet been merged into a base branch (e.g. "master" or "main"). Returns unmerged branch names, count, commits ahead, and latest commit info. ALWAYS call this tool when users ask questions like "还有多少个分支还没合并到 MASTER", "哪些分支未合并", etc.
- check_branch_containment: Check if a specific branch is merged into a target branch or contains unwanted commits.
- get_branches: List all branches in the repository with counts.
- get_repo_summary: Overview of the repository status, current branch, and total commits.
- get_today_merges: View merge commits created today or in a recent time frame.
- find_commits: Search commits by keyword or author.
- get_commit_details: Detailed diff/stats of a specific commit.
- spotlight_commits: Focus or highlight specific commits on the visual Git graph.
- inspect_code_issue: Jump to a file and highlight a specific line/range in code diff or preview with an Agent diagnostic review note. Use this when pointing out an issue, existing commit duplication, logic bug, or developer finding directly on the code line.

[Strict Boundary & Safe Execution Rules]
- In Yggdrasil, all application and repository operations are provided via standardized, safe tool-calling APIs.
- NEVER refuse application operations (like opening settings, opening projects, or switching panels) by claiming you lack UI capabilities. You have dedicated safe tools (open_project, navigate_ui, set_ui_theme) to perform them!
- Never attempt to execute raw shell commands or arbitrary eval; all actions are performed strictly through the above predefined tools.
- Always answer concisely and accurately in the language used by the user (Chinese if asked in Chinese).`,
  createdAt: 0,
}

function withSystemPrompt(history: AgentChatMessage[]): AgentChatMessage[] {
  if (history.some((m) => m.role === 'system')) return history
  return [AGENT_SYSTEM_PROMPT, ...history]
}

function useOptionalRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter()
  } catch {
    return null
  }
}

export function AgentProvider({ children, currentRepo }: { children: React.ReactNode; currentRepo?: string }) {
  const router = useOptionalRouter()

  const [profiles, setProfiles] = useState<AgentModelProfile[]>([DEFAULT_MODEL_PROFILE])
  const [activeProfileId, selectProfile] = useState(DEFAULT_MODEL_PROFILE.id)
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const config = (profiles.find((profile) => profile.id === activeProfileId) || profiles[0]).config

  useEffect(() => {
    try {
      const stored = parseModelProfiles(localStorage.getItem(MODEL_PROFILES_STORAGE_KEY))
      if (stored) {
        setProfiles(stored.profiles)
        selectProfile(stored.activeId)
      }
    } catch {
      // Keep the in-memory defaults when browser storage is unavailable.
    }
    setProfilesLoaded(true)
  }, [])

  useEffect(() => {
    if (!profilesLoaded) return
    try {
      localStorage.setItem(MODEL_PROFILES_STORAGE_KEY, serializeModelProfiles(profiles, activeProfileId))
    } catch {
      // Profiles remain usable for this session when browser storage is unavailable.
    }
  }, [profiles, activeProfileId, profilesLoaded])

  const saveProfile = useCallback((profile: AgentModelProfile) => {
    setProfiles((previous) => (previous.some((item) => item.id === profile.id) ? previous.map((item) => (item.id === profile.id ? profile : item)) : [...previous, profile]))
    selectProfile(profile.id)
  }, [])

  const deleteProfile = useCallback(
    (id: string) => {
      setProfiles((previous) => {
        if (previous.length <= 1) return previous
        const next = previous.filter((item) => item.id !== id)
        if (activeProfileId === id && next.length > 0) {
          selectProfile(next[0].id)
        }
        return next
      })
    },
    [activeProfileId]
  )

  const activeProfile = useMemo(() => profiles.find((p) => p.id === activeProfileId) || profiles[0], [profiles, activeProfileId])

  const modelFilter = activeProfile?.filter || DEFAULT_MODEL_FILTER

  const setModelFilter = useCallback(
    (action: React.SetStateAction<ModelFilterOptions>) => {
      setProfiles((previous) =>
        previous.map((item) => {
          if (item.id === activeProfileId) {
            const currentFilter = item.filter || DEFAULT_MODEL_FILTER
            const nextFilter = typeof action === 'function' ? action(currentFilter) : action
            return { ...item, filter: nextFilter }
          }
          return item
        })
      )
    },
    [activeProfileId]
  )
  const [redactionOptions, setRedactionOptions] = useState<RedactionOptions>(DEFAULT_REDACTION_OPTIONS)
  const [dockMode, setDockMode] = useState<AgentDockMode>('collapsed')
  const [messages, setMessages] = useState<AgentChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeResultSummary, setActiveResultSummary] = useState<string | null>(null)
  const [activeRepo, setActiveRepo] = useState<string>(currentRepo || '')

  useEffect(() => {
    if (currentRepo) {
      setActiveRepo(currentRepo)
    } else if (typeof window !== 'undefined' && window.location.pathname.startsWith('/git/')) {
      const match = window.location.pathname.match(/^\/git\/(.+?)(?:\/(?:commit|branch|tag|blob|tree)\/|$)/)
      if (match?.[1]) {
        setActiveRepo(match[1])
      }
    }
  }, [currentRepo])

  const redactionSessionRef = useRef<RedactionSession>(createRedactionSession())
  const spotlightCtx = useOptionalSpotlight()

  const clearMessages = useCallback(() => {
    setMessages([])
    setActiveResultSummary(null)
    redactionSessionRef.current = createRedactionSession()
    if (spotlightCtx) {
      spotlightCtx.clearSpotlight()
    }
  }, [spotlightCtx])

  const sendMessage = useCallback(
    async (userText: string, repoPath?: string) => {
      const trimmed = userText.trim()
      if (!trimmed || isProcessing) return

      let repo = repoPath || activeRepo || currentRepo || ''
      if (!repo && typeof window !== 'undefined' && window.location.pathname.startsWith('/git/')) {
        const match = window.location.pathname.match(/^\/git\/(.+?)(?:\/(?:commit|branch|tag|blob|tree)\/|$)/)
        if (match?.[1]) {
          repo = match[1]
        }
      }
      const userMsgId = `msg_${Date.now()}`
      const userMessage: AgentChatMessage = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      }

      const assistantMsgId = `msg_${Date.now() + 1}`
      const initialAssistantMessage: AgentChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        createdAt: Date.now() + 1,
      }

      const updatedHistory = [...messages, userMessage]
      setMessages([...updatedHistory, initialAssistantMessage])
      setIsProcessing(true)

      if (!isModelAllowed(config.model, modelFilter)) {
        setIsProcessing(false)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: `🚫 模型受限：当前模型 "${config.model}" 命中黑名单规则，已被禁止提交。请在设置中切换为合规模型。`,
                  isStreaming: false,
                }
              : m
          )
        )
        return
      }

      const engine = redactionOptions.enabled ? new RedactionEngine(redactionOptions, redactionSessionRef.current) : undefined

      try {
        let accumulatedDelta = ''

        // 1. Send first turn to LLM
        const res = await sendAgentCompletion({
          config,
          messages: withSystemPrompt(updatedHistory),
          tools: AGENT_GIT_TOOLS,
          redactionEngine: engine,
          onDelta: (chunk) => {
            accumulatedDelta += chunk
            setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulatedDelta } : m)))
          },
        })

        // 2. If the LLM returned tool calls, execute them
        if (res.toolCalls && res.toolCalls.length > 0) {
          const toolCalls = res.toolCalls
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: res.content || '',
                    tool_calls: toolCalls,
                    isStreaming: false,
                  }
                : m
            )
          )

          const toolMessages: AgentChatMessage[] = []

          for (const tc of toolCalls) {
            let parsedArgs: Record<string, unknown> = {}
            try {
              parsedArgs = JSON.parse(tc.function.arguments)
            } catch {
              parsedArgs = {}
            }

            const toolExec = await executeAgentTool(tc.function.name, parsedArgs, repo)

            // If tool yielded spotlight targets, update the graph spotlight!
            if (toolExec.spotlightTargets && spotlightCtx) {
              spotlightCtx.setSpotlightTargets(toolExec.spotlightTargets)
            }
            if (toolExec.codeAnnotation && spotlightCtx) {
              spotlightCtx.setCodeAnnotation(toolExec.codeAnnotation)
            }
            if (toolExec.uiNavigation) {
              const target = toolExec.uiNavigation.target
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('yggit:ui_navigate', { detail: toolExec.uiNavigation }))
              }
              if (target.startsWith('settings_') || target === 'git_home') {
                const routeMap: Record<string, string> = {
                  settings_models_new: '/settings/models/new',
                  settings_models: '/settings/models',
                  settings_privacy: '/settings/privacy',
                  settings_general: '/settings/general',
                  settings_menus: '/settings/menus',
                  git_home: '/git',
                }
                const route = routeMap[target] || (target.startsWith('settings_') ? `/settings/${target.replace('settings_', '')}` : '/settings/models')
                if (typeof window !== 'undefined') {
                  if (router) {
                    router.push(route)
                  } else {
                    window.location.href = route
                  }
                }
              }
            }

            if (toolExec.projectNavigation) {
              const { project, target, url } = toolExec.projectNavigation
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('yggit:open_project', {
                    detail: { project, target, url },
                  })
                )
              }
              if (router) {
                router.push(url)
              } else if (typeof window !== 'undefined') {
                window.location.href = url
              }
            }

            if (toolExec.uiPreference) {
              if (toolExec.uiPreference.type === 'theme') {
                const val = toolExec.uiPreference.value as ThemePreference
                writeStoredTheme(val)
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('yggit:set_theme', { detail: val }))
                }
              }
            }

            const contentStr = typeof toolExec.result === 'string' ? toolExec.result : JSON.stringify(toolExec.result, null, 2)

            toolMessages.push({
              id: `tool_${tc.id}_${Date.now()}`,
              role: 'tool',
              name: tc.function.name,
              tool_call_id: tc.id,
              content: contentStr,
              createdAt: Date.now(),
            })
          }

          // 3. Send tool results back to LLM for final response synthesis
          const secondTurnAssistantId = `msg_${Date.now() + 2}`
          const secondAssistantMessage: AgentChatMessage = {
            id: secondTurnAssistantId,
            role: 'assistant',
            content: '',
            isStreaming: true,
            createdAt: Date.now() + 2,
          }

          const turnTwoMessages = [
            ...updatedHistory,
            {
              id: assistantMsgId,
              role: 'assistant' as const,
              content: res.content,
              tool_calls: toolCalls,
            },
            ...toolMessages,
          ]

          setMessages([...turnTwoMessages, secondAssistantMessage])

          let secondTurnDelta = ''
          const finalRes = await sendAgentCompletion({
            config,
            messages: withSystemPrompt(turnTwoMessages),
            redactionEngine: engine,
            onDelta: (chunk) => {
              secondTurnDelta += chunk
              setMessages((prev) => prev.map((m) => (m.id === secondTurnAssistantId ? { ...m, content: secondTurnDelta } : m)))
            },
          })

          setMessages((prev) => prev.map((m) => (m.id === secondTurnAssistantId ? { ...m, content: finalRes.content, isStreaming: false } : m)))
          setActiveResultSummary(finalRes.content.slice(0, 120))
        } else {
          // No tools called, finalize message
          setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: res.content, isStreaming: false } : m)))
          setActiveResultSummary(res.content.slice(0, 120))

          // Fallback UI navigation if model emitted text intending to navigate without structured tool calls
          const contentLower = (res.content || '').toLowerCase()
          const userLower = trimmed.toLowerCase()
          let fallbackRoute: string | null = null

          if (
            userLower.includes('接入') ||
            userLower.includes('新增模型') ||
            userLower.includes('添加模型') ||
            userLower.includes('配置模型') ||
            contentLower.includes('settings_models_new')
          ) {
            const isChatGpt = userLower.includes('chatgpt') || userLower.includes('openai') || contentLower.includes('chatgpt') || contentLower.includes('openai')
            fallbackRoute = isChatGpt ? '/settings/models/new?provider=openai' : '/settings/models/new'
          } else if (contentLower.includes('settings_models') || userLower.includes('模型设置') || userLower.includes('模型列表')) {
            fallbackRoute = '/settings/models'
          } else if (contentLower.includes('settings_privacy') || userLower.includes('隐私设置') || userLower.includes('脱敏设置')) {
            fallbackRoute = '/settings/privacy'
          } else if (contentLower.includes('settings_general') || userLower.includes('通用设置')) {
            fallbackRoute = '/settings/general'
          } else if (contentLower.includes('settings_menus') || userLower.includes('菜单设置')) {
            fallbackRoute = '/settings/menus'
          }

          if (fallbackRoute && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('yggit:ui_navigate', { detail: { route: fallbackRoute } }))
            router?.push(fallbackRoute)
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Agent invocation failed'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: `❌ Error: ${errorMsg}`,
                  isStreaming: false,
                }
              : m
          )
        )
      } finally {
        setIsProcessing(false)
      }
    },
    [config, redactionOptions, messages, isProcessing, activeRepo, currentRepo, spotlightCtx, modelFilter, router]
  )

  const value = useMemo(
    () => ({
      config,
      profiles,
      activeProfileId,
      saveProfile,
      deleteProfile,
      selectProfile,
      redactionOptions,
      setRedactionOptions,
      dockMode,
      setDockMode,
      messages,
      isProcessing,
      sendMessage,
      clearMessages,
      activeResultSummary,
      activeRepo,
      setActiveRepo,
      modelFilter,
      setModelFilter,
    }),
    [
      config,
      profiles,
      activeProfileId,
      saveProfile,
      deleteProfile,
      redactionOptions,
      dockMode,
      messages,
      isProcessing,
      sendMessage,
      clearMessages,
      activeResultSummary,
      activeRepo,
      modelFilter,
      setModelFilter,
    ]
  )

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
}

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext)
  if (!ctx) {
    throw new Error('useAgent must be used within AgentProvider')
  }
  return ctx
}

export function useOptionalAgent(): AgentContextValue | null {
  return useContext(AgentContext)
}
