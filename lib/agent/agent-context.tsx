'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { getDriverMode } from '@/lib/git/driver'
import { extractRepoSlugFromPathname } from '@/lib/git/route-mode'
import { createScopedLogger } from '@/lib/logger'
import { listMcpServers } from '@/lib/mcp/storage'
import { openEdgeSecret } from '@/lib/security/edge-vault'
import { buildSkillsSystemPrompt, matchSkillsForPrompt } from '@/lib/skills/matcher'
import { listSkills } from '@/lib/skills/storage'
import { type ThemePreference, writeStoredTheme } from '@/lib/theme'
import { workdeskEngine } from '@/lib/workdesk/engine'

import { type AgentContextValue, buildAgentSystemMessages, DEFAULT_REDACTION_OPTIONS, resolveFallbackUiRoute, useOptionalPathname, useOptionalRouter } from './agent-context-types'
import { parseFallbackToolCalls, stripToolCodeBlocks } from './fallback-tool-parser'
import { getLocalModelSpec } from './local-models'
import { isLocalRuntimeWarmedUp } from './local-warmup'
import { isModelAllowed } from './model-filter'
import { sendAgentCompletion } from './openapi-client'
import { createRedactionSession } from './redact/engine'
import { RedactionEngine } from './redact/engine'
import type { RedactionOptions, RedactionSession } from './redact/types'
import { useOptionalSpotlight } from './spotlight-context'
import { addStepToTask, completeTask, createTask, failTask } from './tasks/storage'
import { AGENT_GIT_TOOLS, buildMcpToolDefinitions, executeAgentTool } from './tools'
import { type AgentTraceToolExecution, recordAgentTrace } from './trace-logger'
import { type AgentChatMessage, type AgentDockMode } from './types'
import { useAgentProfiles } from './use-agent-profiles'
import { getWorkdeskContext } from './workdesk-context'
export { type AgentContextValue, DEFAULT_REDACTION_OPTIONS } from './agent-context-types'

export const AgentContext = createContext<AgentContextValue | null>(null)

const REDACTION_OPTIONS_STORAGE_KEY = 'yggit.agent.redaction-options.v1'

export function AgentProvider({ children, currentRepo }: { children: React.ReactNode; currentRepo?: string }) {
  const router = useOptionalRouter()
  const pathname = useOptionalPathname()

  const { config, profiles, activeProfile, activeProfileId, modelFilter, setModelFilter, selectProfile, saveProfile, deleteProfile, toggleProfileEnabled } =
    useAgentProfiles(pathname)
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
    } else if (typeof window !== 'undefined') {
      const slugRepo = extractRepoSlugFromPathname(window.location.pathname)
      if (slugRepo) setActiveRepo(slugRepo)
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

      const traceLog = createScopedLogger('agent')
      let activeTaskId: string | undefined
      try {
        const task = await createTask({
          title: trimmed.slice(0, 50),
          prompt: trimmed,
          model: config.model,
          repo,
        })
        activeTaskId = task.id
        traceLog.info(`Started agent task: ${trimmed.slice(0, 50)}`)
      } catch {
        // Fallback
      }

      // 0. Match Custom Skills and discover enabled MCP tools
      const runStartedAt = Date.now()
      let matchedSkillNames: string[] = []
      let skillsPrompt = ''
      try {
        const skills = await listSkills()
        const matched = matchSkillsForPrompt(trimmed, skills)
        if (matched.length > 0) {
          matchedSkillNames = matched.map((s) => s.name)
          skillsPrompt = buildSkillsSystemPrompt(matched)
          if (activeTaskId) {
            await addStepToTask(activeTaskId, {
              type: 'skill_match',
              title: `Matched Skills: ${matched.map((s) => s.name).join(', ')}`,
              detail: matched.map((s) => s.description).join('; '),
            })
          }
          traceLog.info(`Matched ${matched.length} skills for prompt: ${matched.map((s) => s.name).join(', ')}`, undefined, 'skill')
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

      const buildSystemHistory = (history: AgentChatMessage[]) => buildAgentSystemMessages(history, skillsPrompt)

      const requestHistory = buildSystemHistory(updatedHistory)
      const traceBase = {
        traceId: traceLog.traceId,
        provider: config.provider,
        model: config.model,
        profileName: activeProfile?.name,
        repo: repo || undefined,
        userPrompt: trimmed,
        requestMessages: requestHistory.map((m) => ({ role: m.role, content: m.content })),
        toolNames: combinedTools.map((t) => t.function.name),
        matchedSkills: matchedSkillNames,
      }
      const toolExecutions: AgentTraceToolExecution[] = []
      let nativeToolCalls: Array<{ name: string; arguments: string }> = []
      let fallbackToolCalls: Array<{ name: string; arguments: string }> = []
      let rawTurnOneContent = ''

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
          messages: requestHistory,
          tools: combinedTools,
          redactionEngine: engine,
          purpose: 'chat',
          taskId: activeTaskId,
          onDelta: (chunk) => {
            accumulatedDelta += chunk
            const visibleContent = stripToolCodeBlocks(accumulatedDelta)
            setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: visibleContent, statusTool: undefined } : m)))
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

        // 2. If the LLM returned tool calls (native or fallback fenced block), execute them
        let effectiveToolCalls = res.toolCalls && res.toolCalls.length > 0 ? res.toolCalls : []
        let effectiveContent = res.content || ''
        rawTurnOneContent = effectiveContent
        nativeToolCalls = effectiveToolCalls.map((tc) => ({ name: tc.function.name, arguments: tc.function.arguments }))

        if (effectiveToolCalls.length === 0 && effectiveContent) {
          const allowedToolNames = new Set(combinedTools.map((t) => t.function.name))
          const fallback = parseFallbackToolCalls(effectiveContent, allowedToolNames)
          if (fallback.toolCalls.length > 0) {
            effectiveToolCalls = fallback.toolCalls
            effectiveContent = fallback.cleanedContent
            fallbackToolCalls = fallback.toolCalls.map((tc) => ({ name: tc.function.name, arguments: tc.function.arguments }))
            traceLog.info(`Parsed ${fallback.toolCalls.length} fallback tool call(s): ${fallback.toolCalls.map((c) => c.function.name).join(', ')}`)
          } else {
            effectiveContent = stripToolCodeBlocks(effectiveContent)
          }
        }

        if (effectiveToolCalls.length > 0) {
          const toolCalls = effectiveToolCalls
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: effectiveContent,
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

            const toolStartedAt = Date.now()
            const toolExec = await executeAgentTool(tc.function.name, parsedArgs, repo)
            const rawResultStr = typeof toolExec.result === 'string' ? toolExec.result : JSON.stringify(toolExec.result ?? '')
            toolExecutions.push({
              name: tc.function.name,
              args: parsedArgs,
              ok: toolExec.ok,
              outputPreview: rawResultStr.slice(0, 600),
              durationMs: Date.now() - toolStartedAt,
            })

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
              content: effectiveContent,
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
              const visibleContent = stripToolCodeBlocks(secondTurnDelta)
              setMessages((prev) => prev.map((m) => (m.id === secondTurnAssistantId ? { ...m, content: visibleContent } : m)))
            },
          })

          const cleanedFinalContent = stripToolCodeBlocks(finalRes.content)

          if (activeTaskId) {
            await addStepToTask(activeTaskId, {
              type: 'llm_turn',
              title: 'Agent Response Synthesized',
              detail: cleanedFinalContent.slice(0, 160),
              tokenUsage: finalRes.usage,
            })
            await completeTask(activeTaskId, { tokenUsage: finalRes.usage })
          }

          const totalDurationMs = Date.now() - runStartedAt
          const mergedUsage = finalRes.usage || res.usage
          setMessages((prev) =>
            prev.map((m) => (m.id === secondTurnAssistantId ? { ...m, content: cleanedFinalContent, isStreaming: false, durationMs: totalDurationMs, tokenUsage: mergedUsage } : m))
          )
          setActiveResultSummary(cleanedFinalContent.slice(0, 120))
          recordAgentTrace({
            ...traceBase,
            durationMs: totalDurationMs,
            status: 'success',
            nativeToolCalls,
            fallbackToolCalls,
            toolExecutions,
            rawTurnOneContent,
            rawFinalContent: finalRes.content,
            visibleContent: cleanedFinalContent,
            tokenUsage: mergedUsage,
          })
        } else {
          // No tools called, finalize message
          const cleanedContent = stripToolCodeBlocks(effectiveContent)
          const totalDurationMs = Date.now() - runStartedAt
          if (activeTaskId) {
            await completeTask(activeTaskId, { tokenUsage: res.usage })
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: cleanedContent, isStreaming: false, durationMs: totalDurationMs, tokenUsage: res.usage } : m))
          )
          setActiveResultSummary(cleanedContent.slice(0, 120))
          recordAgentTrace({
            ...traceBase,
            durationMs: totalDurationMs,
            status: 'success',
            nativeToolCalls,
            fallbackToolCalls,
            toolExecutions,
            rawTurnOneContent,
            visibleContent: cleanedContent,
            tokenUsage: res.usage,
          })

          const fallbackRoute = resolveFallbackUiRoute(trimmed, res.content || '')
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
        traceLog.error(`Agent task failed: ${errorMsg}`)
        recordAgentTrace({
          ...traceBase,
          durationMs: Date.now() - runStartedAt,
          status: 'error',
          nativeToolCalls,
          fallbackToolCalls,
          toolExecutions,
          rawTurnOneContent,
          visibleContent: '',
          error: errorMsg,
        })
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
    [config, activeProfileId, activeProfile?.name, redactionOptions, spotlightCtx, modelFilter, router]
  )

  const resolveRepoTarget = useCallback(
    (repoPath?: string) => {
      const wdCtx = getWorkdeskContext()
      let repo = repoPath || activeRepo || currentRepo || wdCtx?.repoIdentity || ''
      if (!repo && typeof window !== 'undefined') {
        repo = extractRepoSlugFromPathname(window.location.pathname)
      }
      return repo
    },
    [activeRepo, currentRepo]
  )

  const sendMessage = useCallback(
    async (userText: string, repoPath?: string, options?: { quotedMessage?: AgentChatMessage['quotedMessage']; llmPrompt?: string }) => {
      const trimmed = userText.trim()
      if (!trimmed || isProcessing) return

      const repo = resolveRepoTarget(repoPath)
      const userMsgId = `msg_${Date.now()}`
      const userMessage: AgentChatMessage = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
        ...(options?.quotedMessage ? { quotedMessage: options.quotedMessage } : {}),
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
      const promptForLlm = options?.llmPrompt?.trim() || trimmed
      await executeAgentTurn(updatedHistory, promptForLlm, assistantMsgId, repo)
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
