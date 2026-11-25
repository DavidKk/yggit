'use client'

import { usePathname, useRouter } from 'next/navigation'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { getDriverMode, type GitDriverMode } from '@/lib/git/driver'
import { logError, logInfo } from '@/lib/logger'
import { listMcpServers } from '@/lib/mcp/storage'
import { isAllowedAgentPath } from '@/lib/security/agent-paths'
import { deleteEdgeSecret, isWebCryptoVaultSupported, listEdgeSecretIds, openEdgeSecret, sealEdgeSecret } from '@/lib/security/edge-vault'
import { buildSkillsSystemPrompt, matchSkillsForPrompt } from '@/lib/skills/matcher'
import { listSkills } from '@/lib/skills/storage'
import { type ThemePreference, writeStoredTheme } from '@/lib/theme'
import { workdeskEngine } from '@/lib/workdesk/engine'

import { getLocalModelSpec } from './local-models'
import { isLocalRuntimeWarmedUp } from './local-warmup'
import { DEFAULT_MODEL_FILTER, isModelAllowed, type ModelFilterOptions } from './model-filter'
import { type AgentModelProfile, DEFAULT_BROWSER_AI_PROFILE, DEFAULT_MODEL_PROFILE, MODEL_PROFILES_STORAGE_KEY, parseModelProfiles, serializeModelProfiles } from './model-profiles'
import { sendAgentCompletion } from './openapi-client'
import { createRedactionSession } from './redact/engine'
import { RedactionEngine } from './redact/engine'
import type { RedactionOptions, RedactionSession } from './redact/types'
import { useOptionalSpotlight } from './spotlight-context'
import { withSystemPrompt } from './system-prompt'
import { addStepToTask, completeTask, createTask, failTask } from './tasks/storage'
import { AGENT_GIT_TOOLS, buildMcpToolDefinitions, executeAgentTool } from './tools'
import type { AgentChatMessage, AgentDockMode, EphemeralAgentConfig } from './types'
import { markBrowserAiDismissed, useBrowserAiAutoRegister } from './use-browser-ai-auto-register'
import { getWorkdeskContext } from './workdesk-context'

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
  sendMessage: (content: string, repoPath?: string) => Promise<void>
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

export const AgentContext = createContext<AgentContextValue | null>(null)

const REDACTION_OPTIONS_STORAGE_KEY = 'yggit.agent.redaction-options.v1'

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

function useOptionalRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter()
  } catch {
    return null
  }
}

function useOptionalPathname(): string {
  try {
    return usePathname() || (typeof window !== 'undefined' ? window.location.pathname : '/')
  } catch {
    return typeof window !== 'undefined' ? window.location.pathname : '/'
  }
}

export function AgentProvider({ children, currentRepo }: { children: React.ReactNode; currentRepo?: string }) {
  const router = useOptionalRouter()
  const pathname = useOptionalPathname()

  const [driverMode, setDriverMode] = useState<GitDriverMode>(() => getDriverMode())
  const [profiles, setProfiles] = useState<AgentModelProfile[]>([DEFAULT_MODEL_PROFILE])
  const [activeProfileId, setActiveProfileId] = useState(DEFAULT_MODEL_PROFILE.id)
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const config = (profiles.find((profile) => profile.id === activeProfileId) || profiles[0]).config

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncMode = () => setDriverMode(getDriverMode())
    window.addEventListener('yggit:driver_mode_changed', syncMode)
    return () => window.removeEventListener('yggit:driver_mode_changed', syncMode)
  }, [])

  useEffect(() => {
    let cancelled = false
    const useLocalServerStore = driverMode === 'local' && typeof fetch === 'function'

    if (useLocalServerStore) {
      // Local mode is strictly isolated from Edge browser localStorage
      setProfiles([DEFAULT_MODEL_PROFILE])
      setActiveProfileId(DEFAULT_MODEL_PROFILE.id)
      setProfilesLoaded(false)

      if (!isAllowedAgentPath(pathname)) {
        return () => {
          cancelled = true
        }
      }

      void (async () => {
        try {
          const res = await fetch('/api/git/agent/profiles')
          if (!res.ok) return
          const data = (await res.json()) as { stored?: { profiles: AgentModelProfile[]; activeId: string } | null }
          if (!cancelled && data?.stored?.profiles?.length) {
            setProfiles(data.stored.profiles)
            setActiveProfileId(data.stored.activeId)
          }
        } catch {
          // Local backend vault unavailable
        } finally {
          if (!cancelled) setProfilesLoaded(true)
        }
      })()

      return () => {
        cancelled = true
      }
    }

    // Edge mode (or test environment without fetch): strictly isolated browser storage + Edge IndexedDB vault
    try {
      const stored = parseModelProfiles(localStorage.getItem(MODEL_PROFILES_STORAGE_KEY))
      if (stored) {
        setProfiles(stored.profiles)
        setActiveProfileId(stored.activeId)
      } else {
        setProfiles([DEFAULT_MODEL_PROFILE])
        setActiveProfileId(DEFAULT_MODEL_PROFILE.id)
      }
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('yggit.agent.session-keys.v1')
      }
    } catch {
      // Keep the in-memory defaults when browser storage is unavailable.
    }
    setProfilesLoaded(true)

    if (!isAllowedAgentPath(pathname)) {
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      try {
        const secretIds = await listEdgeSecretIds()
        if (cancelled || secretIds.size === 0) return
        setProfiles((prev) => prev.map((p) => (secretIds.has(p.id) ? { ...p, config: { ...p.config, apiKey: undefined, hasApiKey: true } } : p)))
      } catch {
        // Edge Web Crypto vault unavailable
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pathname, driverMode])

  useEffect(() => {
    if (!profilesLoaded) return
    if (driverMode === 'local' && typeof fetch === 'function') return
    try {
      localStorage.setItem(MODEL_PROFILES_STORAGE_KEY, serializeModelProfiles(profiles, activeProfileId))
    } catch {
      // Profiles remain usable for this session when browser storage is unavailable.
    }
  }, [profiles, activeProfileId, profilesLoaded, driverMode])

  useBrowserAiAutoRegister({ profilesLoaded, pathname, profiles, setProfiles })

  const selectProfile = useCallback((id: string) => {
    setActiveProfileId(id)
    if (getDriverMode() === 'local' && typeof fetch === 'function') {
      void fetch('/api/git/agent/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select', profileId: id }),
      }).catch(() => {})
    }
  }, [])

  const saveProfile = useCallback((profile: AgentModelProfile, options?: { clearApiKey?: boolean }) => {
    const mode = getDriverMode()
    const edgeVaultReady = mode === 'edge' && isWebCryptoVaultSupported()
    const hasApiKey = Boolean(profile.config.apiKey?.trim() || (profile.config.hasApiKey && !options?.clearApiKey))
    const trimmedKey = profile.config.apiKey?.trim()
    const normalized: AgentModelProfile = {
      ...profile,
      config: {
        ...profile.config,
        // Never retain plaintext apiKey in React state when sealed into Local or Edge encrypted vault
        ...(mode === 'local' && typeof fetch === 'function' ? { apiKey: undefined } : {}),
        ...(edgeVaultReady ? { apiKey: undefined } : {}),
        ...(hasApiKey ? { hasApiKey: true } : { hasApiKey: false }),
      },
    }
    setProfiles((previous) =>
      previous.some((item) => item.id === normalized.id) ? previous.map((item) => (item.id === normalized.id ? normalized : item)) : [...previous, normalized]
    )
    setActiveProfileId(normalized.id)

    if (mode === 'local') {
      if (typeof fetch === 'function') {
        void fetch('/api/git/agent/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: { ...normalized, config: { ...normalized.config, apiKey: trimmedKey } },
            clearApiKey: Boolean(options?.clearApiKey),
            setActive: true,
          }),
        }).catch(() => {})
      }
    } else {
      if (options?.clearApiKey) {
        void deleteEdgeSecret(normalized.id)
      } else if (trimmedKey) {
        void sealEdgeSecret(normalized.id, trimmedKey)
      }
    }
  }, [])

  const deleteProfile = useCallback(
    (id: string) => {
      setProfiles((previous) => {
        if (previous.length <= 1) return previous
        const target = previous.find((item) => item.id === id)
        if (target?.config.provider === 'browser-ai' || id === DEFAULT_BROWSER_AI_PROFILE.id) {
          markBrowserAiDismissed()
        }
        const next = previous.filter((item) => item.id !== id)
        if (activeProfileId === id && next.length > 0) {
          setActiveProfileId(next[0].id)
        }
        return next
      })
      if (getDriverMode() === 'local') {
        if (typeof fetch === 'function') {
          void fetch(`/api/git/agent/profiles?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
        }
      } else {
        void deleteEdgeSecret(id)
      }
    },
    [activeProfileId]
  )

  const toggleProfileEnabled = useCallback(
    (id: string, enabled: boolean) => {
      let updatedProfile: AgentModelProfile | null = null
      setProfiles((previous) => {
        const next = previous.map((item) => {
          if (item.id !== id) return item
          updatedProfile = { ...item, enabled }
          return updatedProfile
        })
        if (!enabled && activeProfileId === id) {
          const fallback = next.find((item) => item.enabled !== false) || next[0]
          if (fallback) setActiveProfileId(fallback.id)
        }
        return next
      })
      if (updatedProfile && getDriverMode() === 'local' && typeof fetch === 'function') {
        void fetch('/api/git/agent/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: updatedProfile,
            clearApiKey: false,
            setActive: false,
          }),
        }).catch(() => {})
      }
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
  const [redactionLoaded, setRedactionLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REDACTION_OPTIONS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<RedactionOptions>
        if (parsed && typeof parsed === 'object') {
          setRedactionOptions({
            enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_REDACTION_OPTIONS.enabled,
            categories: {
              secrets: typeof parsed.categories?.secrets === 'boolean' ? parsed.categories.secrets : DEFAULT_REDACTION_OPTIONS.categories.secrets,
              pii: typeof parsed.categories?.pii === 'boolean' ? parsed.categories.pii : DEFAULT_REDACTION_OPTIONS.categories.pii,
              network: typeof parsed.categories?.network === 'boolean' ? parsed.categories.network : DEFAULT_REDACTION_OPTIONS.categories.network,
              custom: typeof parsed.categories?.custom === 'boolean' ? parsed.categories.custom : DEFAULT_REDACTION_OPTIONS.categories.custom,
            },
            customWords: Array.isArray(parsed.customWords) ? parsed.customWords : DEFAULT_REDACTION_OPTIONS.customWords,
            allowList: Array.isArray(parsed.allowList) ? parsed.allowList : DEFAULT_REDACTION_OPTIONS.allowList,
          })
        }
      }
    } catch {
      // Keep default redaction options when storage is unavailable.
    }
    setRedactionLoaded(true)
  }, [])

  useEffect(() => {
    if (!redactionLoaded) return
    try {
      localStorage.setItem(REDACTION_OPTIONS_STORAGE_KEY, JSON.stringify(redactionOptions))
    } catch {
      // Ignore storage write errors.
    }
  }, [redactionOptions, redactionLoaded])
  const [dockMode, setDockMode] = useState<AgentDockMode>('collapsed')

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.agentSidebarOpen = dockMode !== 'collapsed' ? 'true' : 'false'
      document.documentElement.dataset.agentDockMode = dockMode
    }
  }, [dockMode])
  const [messages, setMessages] = useState<AgentChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeResultSummary, setActiveResultSummary] = useState<string | null>(null)
  const [activeRepo, setActiveRepo] = useState<string>(currentRepo || '')
  const [activeBranch, setActiveBranch] = useState<string>('')

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

  const executeAgentTurn = useCallback(
    async (updatedHistory: AgentChatMessage[], trimmed: string, assistantMsgId: string, repo: string) => {
      if (!isModelAllowed(config.model, modelFilter)) {
        setIsProcessing(false)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: `模型受限：当前模型 "${config.model}" 命中黑名单规则，已被禁止提交。请在设置中切换为合规模型。`,
                  isStreaming: false,
                  isError: true,
                }
              : m
          )
        )
        return
      }

      const engine = redactionOptions.enabled ? new RedactionEngine(redactionOptions, redactionSessionRef.current) : undefined

      let activeTaskId: string | undefined
      try {
        const task = await createTask({
          title: trimmed.slice(0, 50),
          prompt: trimmed,
          model: config.model,
          repo,
        })
        activeTaskId = task.id
        logInfo('agent', `Started agent task: ${trimmed.slice(0, 50)}`)
      } catch {
        // Fallback
      }

      // 0. Match Custom Skills and discover enabled MCP tools
      let skillsPrompt = ''
      try {
        const skills = await listSkills()
        const matched = matchSkillsForPrompt(trimmed, skills)
        if (matched.length > 0) {
          skillsPrompt = buildSkillsSystemPrompt(matched)
          if (activeTaskId) {
            await addStepToTask(activeTaskId, {
              type: 'skill_match',
              title: `Matched Skills: ${matched.map((s) => s.name).join(', ')}`,
              detail: matched.map((s) => s.description).join('; '),
            })
          }
          logInfo('skill', `Matched ${matched.length} skills for prompt: ${matched.map((s) => s.name).join(', ')}`)
        }
      } catch {
        // Fallback
      }

      let combinedTools = AGENT_GIT_TOOLS
      try {
        const mcpServers = await listMcpServers()
        const mcpTools = buildMcpToolDefinitions(mcpServers)
        if (mcpTools.length > 0) {
          combinedTools = [...AGENT_GIT_TOOLS, ...mcpTools]
        }
      } catch {
        // Fallback
      }

      const buildSystemHistory = (history: AgentChatMessage[]) => {
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

      try {
        let accumulatedDelta = ''
        let effectiveConfig = config
        if (getDriverMode() === 'edge' && !config.apiKey && config.hasApiKey) {
          const ephemeralKey = await openEdgeSecret(activeProfileId)
          if (ephemeralKey) {
            effectiveConfig = { ...config, apiKey: ephemeralKey }
          }
        }

        const needsLocalWarmup =
          (effectiveConfig.provider === 'browser-ai' && !isLocalRuntimeWarmedUp('browser-ai')) ||
          (effectiveConfig.provider === 'browser-local' && !isLocalRuntimeWarmedUp(`browser-local:${getLocalModelSpec(effectiveConfig.model).id}`))
        if (needsLocalWarmup) {
          setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, statusTool: { name: '__local_warmup__' } } : m)))
        }

        // 1. Send first turn to LLM
        const res = await sendAgentCompletion({
          config: effectiveConfig,
          profileId: activeProfileId,
          messages: buildSystemHistory(updatedHistory),
          tools: combinedTools,
          redactionEngine: engine,
          purpose: 'chat',
          taskId: activeTaskId,
          onDelta: (chunk) => {
            accumulatedDelta += chunk
            setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulatedDelta, statusTool: undefined } : m)))
          },
        })

        if (activeTaskId) {
          await addStepToTask(activeTaskId, {
            type: 'llm_turn',
            title: 'Agent Turn 1 Completed',
            detail: res.content ? res.content.slice(0, 160) : 'Tool execution required',
            tokenUsage: res.usage,
          })
        }

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
                    isStreaming: true,
                    statusTool: { name: toolCalls[0]?.function.name || '' },
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

            const branchArg = typeof parsedArgs.branch === 'string' && parsedArgs.branch.trim() ? parsedArgs.branch.trim() : undefined
            setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, statusTool: { name: tc.function.name, branch: branchArg } } : m)))

            const toolExec = await executeAgentTool(tc.function.name, parsedArgs, repo)

            if (tc.function.name === 'sync_branch' && toolExec.ok) {
              const syncedBranch = typeof parsedArgs.branch === 'string' ? parsedArgs.branch : undefined
              workdeskEngine.markBranchSynced(repo, syncedBranch)
            }

            if (activeTaskId) {
              await addStepToTask(activeTaskId, {
                type: 'tool_call',
                title: `Execute Tool: ${tc.function.name}`,
                input: parsedArgs,
                output: toolExec.result,
                status: toolExec.ok ? 'success' : 'error',
              })
            }

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
            statusTool: { name: '__synthesizing__' },
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
            config: effectiveConfig,
            profileId: activeProfileId,
            messages: buildSystemHistory(turnTwoMessages),
            redactionEngine: engine,
            purpose: 'chat',
            taskId: activeTaskId,
            onDelta: (chunk) => {
              secondTurnDelta += chunk
              setMessages((prev) => prev.map((m) => (m.id === secondTurnAssistantId ? { ...m, content: secondTurnDelta } : m)))
            },
          })

          if (activeTaskId) {
            await addStepToTask(activeTaskId, {
              type: 'llm_turn',
              title: 'Agent Response Synthesized',
              detail: finalRes.content.slice(0, 160),
              tokenUsage: finalRes.usage,
            })
            await completeTask(activeTaskId, { tokenUsage: finalRes.usage })
          }

          setMessages((prev) => prev.map((m) => (m.id === secondTurnAssistantId ? { ...m, content: finalRes.content, isStreaming: false } : m)))
          setActiveResultSummary(finalRes.content.slice(0, 120))
        } else {
          // No tools called, finalize message
          if (activeTaskId) {
            await completeTask(activeTaskId, { tokenUsage: res.usage })
          }
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
            const isChatGpt = userLower.includes('chatgpt') || contentLower.includes('chatgpt')
            const isOpenAi = userLower.includes('openai') || contentLower.includes('openai')
            fallbackRoute = isChatGpt ? '/settings/models/new?provider=chatgpt' : isOpenAi ? '/settings/models/new?provider=openai' : '/settings/models/new'
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
        if (activeTaskId) {
          await failTask(activeTaskId, errorMsg)
        }
        logError('agent', `Agent task failed: ${errorMsg}`)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: errorMsg,
                  isStreaming: false,
                  isError: true,
                }
              : m
          )
        )
      } finally {
        setIsProcessing(false)
      }
    },
    [config, activeProfileId, redactionOptions, spotlightCtx, modelFilter, router]
  )

  const resolveRepoTarget = useCallback(
    (repoPath?: string) => {
      const wdCtx = getWorkdeskContext()
      let repo = repoPath || activeRepo || currentRepo || wdCtx?.repoIdentity || ''
      if (!repo && typeof window !== 'undefined' && window.location.pathname.startsWith('/git/')) {
        const match = window.location.pathname.match(/^\/git\/(.+?)(?:\/(?:commit|branch|tag|blob|tree)\/|$)/)
        if (match?.[1]) {
          repo = match[1]
        }
      }
      return repo
    },
    [activeRepo, currentRepo]
  )

  const sendMessage = useCallback(
    async (userText: string, repoPath?: string) => {
      const trimmed = userText.trim()
      if (!trimmed || isProcessing) return

      const repo = resolveRepoTarget(repoPath)
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
      await executeAgentTurn(updatedHistory, trimmed, assistantMsgId, repo)
    },
    [isProcessing, messages, resolveRepoTarget, executeAgentTurn]
  )

  const retryMessage = useCallback(
    async (assistantMsgId?: string) => {
      if (isProcessing || messages.length === 0) return

      const targetIndex = assistantMsgId ? messages.findIndex((m) => m.id === assistantMsgId) : messages.length - 1
      if (targetIndex < 0) return

      let userIndex = -1
      for (let i = targetIndex; i >= 0; i -= 1) {
        if (messages[i]?.role === 'user') {
          userIndex = i
          break
        }
      }
      if (userIndex < 0) return

      const userMsg = messages[userIndex]
      const baseHistory = messages.slice(0, userIndex + 1)
      const nextAssistantId = `msg_${Date.now() + 1}`
      const initialAssistantMessage: AgentChatMessage = {
        id: nextAssistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        createdAt: Date.now() + 1,
      }

      setMessages([...baseHistory, initialAssistantMessage])
      setIsProcessing(true)
      await executeAgentTurn(baseHistory, userMsg.content, nextAssistantId, resolveRepoTarget())
    },
    [isProcessing, messages, resolveRepoTarget, executeAgentTurn]
  )

  const value = useMemo(
    () => ({
      config,
      profiles,
      activeProfileId,
      saveProfile,
      deleteProfile,
      selectProfile,
      toggleProfileEnabled,
      redactionOptions,
      setRedactionOptions,
      dockMode,
      setDockMode,
      messages,
      isProcessing,
      sendMessage,
      retryMessage,
      clearMessages,
      activeResultSummary,
      activeRepo,
      setActiveRepo,
      activeBranch,
      setActiveBranch,
      modelFilter,
      setModelFilter,
    }),
    [
      config,
      profiles,
      activeProfileId,
      saveProfile,
      deleteProfile,
      selectProfile,
      toggleProfileEnabled,
      redactionOptions,
      dockMode,
      messages,
      isProcessing,
      sendMessage,
      retryMessage,
      clearMessages,
      activeResultSummary,
      activeRepo,
      activeBranch,
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
