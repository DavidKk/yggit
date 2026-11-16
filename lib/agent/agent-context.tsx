'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { DEFAULT_MODEL_FILTER, isModelAllowed, MODEL_FILTER_STORAGE_KEY, type ModelFilterOptions } from './model-filter'
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

const AgentContext = createContext<AgentContextValue | null>(null)

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
  content: `You are Git Agent, an expert Git diagnostic and analysis assistant embedded in Yggdrasil.
You have direct access to Git tools for repository analysis:
- get_unmerged_branches: Check which branches have not yet been merged into a base branch (e.g. "master" or "main"). Returns unmerged branch names, count, commits ahead, and latest commit info. ALWAYS call this tool when users ask questions like "还有多少个分支还没合并到 MASTER", "哪些分支未合并", etc.
- check_branch_containment: Check if a specific branch is merged into a target branch or contains unwanted commits.
- get_branches: List all branches in the repository with counts.
- get_repo_summary: Overview of the repository status, current branch, and total commits.
- get_today_merges: View merge commits created today or in a recent time frame.
- find_commits: Search commits by keyword or author.
- get_commit_details: Detailed diff/stats of a specific commit.
- spotlight_commits: Focus or highlight specific commits on the visual Git graph.
Always answer concisely and accurately in the language used by the user (Chinese if asked in Chinese).`,
  createdAt: 0,
}

function withSystemPrompt(history: AgentChatMessage[]): AgentChatMessage[] {
  if (history.some((m) => m.role === 'system')) return history
  return [AGENT_SYSTEM_PROMPT, ...history]
}

export function AgentProvider({ children, currentRepo }: { children: React.ReactNode; currentRepo?: string }) {
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
  const [modelFilter, setModelFilter] = useState<ModelFilterOptions>(DEFAULT_MODEL_FILTER)
  const [modelFilterLoaded, setModelFilterLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODEL_FILTER_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && Array.isArray(parsed.whitelist) && Array.isArray(parsed.blacklist)) {
          setModelFilter(parsed)
        }
      }
    } catch {
      // Keep in-memory defaults when browser storage is unavailable.
    }
    setModelFilterLoaded(true)
  }, [])

  useEffect(() => {
    if (!modelFilterLoaded) return
    try {
      localStorage.setItem(MODEL_FILTER_STORAGE_KEY, JSON.stringify(modelFilter))
    } catch {
      // Storage optional
    }
  }, [modelFilter, modelFilterLoaded])
  const [redactionOptions, setRedactionOptions] = useState<RedactionOptions>(DEFAULT_REDACTION_OPTIONS)
  const [dockMode, setDockMode] = useState<AgentDockMode>('collapsed')
  const [messages, setMessages] = useState<AgentChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeResultSummary, setActiveResultSummary] = useState<string | null>(null)
  const [activeRepo, setActiveRepo] = useState<string>(currentRepo || '')

  useEffect(() => {
    if (currentRepo) setActiveRepo(currentRepo)
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

      const repo = repoPath || activeRepo || currentRepo || ''
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
                    content: res.content || 'Executing Git analysis tools...',
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
    [config, redactionOptions, messages, isProcessing, activeRepo, currentRepo, spotlightCtx, modelFilter]
  )

  const value = useMemo(
    () => ({
      config,
      profiles,
      activeProfileId,
      saveProfile,
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
    [config, profiles, activeProfileId, saveProfile, redactionOptions, dockMode, messages, isProcessing, sendMessage, clearMessages, activeResultSummary, activeRepo, modelFilter]
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
