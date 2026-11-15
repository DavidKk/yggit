'use client'

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import { sendAgentCompletion } from './openapi-client'
import { createRedactionSession } from './redact/engine'
import { RedactionEngine } from './redact/engine'
import type { RedactionOptions, RedactionSession } from './redact/types'
import { useOptionalSpotlight } from './spotlight-context'
import { AGENT_GIT_TOOLS, executeAgentTool } from './tools'
import type { AgentChatMessage, AgentDockMode, EphemeralAgentConfig } from './types'
import { DEFAULT_AGENT_CONFIG } from './types'

export interface AgentContextValue {
  config: EphemeralAgentConfig
  setConfig: React.Dispatch<React.SetStateAction<EphemeralAgentConfig>>
  redactionOptions: RedactionOptions
  setRedactionOptions: React.Dispatch<React.SetStateAction<RedactionOptions>>
  dockMode: AgentDockMode
  setDockMode: (mode: AgentDockMode) => void
  messages: AgentChatMessage[]
  isProcessing: boolean
  sendMessage: (content: string, repoPath?: string) => Promise<void>
  clearMessages: () => void
  activeResultSummary: string | null
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

export function AgentProvider({ children, currentRepo }: { children: React.ReactNode; currentRepo?: string }) {
  const [config, setConfig] = useState<EphemeralAgentConfig>(DEFAULT_AGENT_CONFIG)
  const [redactionOptions, setRedactionOptions] = useState<RedactionOptions>(DEFAULT_REDACTION_OPTIONS)
  const [dockMode, setDockMode] = useState<AgentDockMode>('collapsed')
  const [messages, setMessages] = useState<AgentChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeResultSummary, setActiveResultSummary] = useState<string | null>(null)

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

      const repo = repoPath || currentRepo || ''
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

      const engine = redactionOptions.enabled ? new RedactionEngine(redactionOptions, redactionSessionRef.current) : undefined

      try {
        let accumulatedDelta = ''

        // 1. Send first turn to LLM
        const res = await sendAgentCompletion({
          config,
          messages: updatedHistory,
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
            messages: turnTwoMessages,
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
    [config, redactionOptions, messages, isProcessing, currentRepo, spotlightCtx]
  )

  const value = useMemo(
    () => ({
      config,
      setConfig,
      redactionOptions,
      setRedactionOptions,
      dockMode,
      setDockMode,
      messages,
      isProcessing,
      sendMessage,
      clearMessages,
      activeResultSummary,
    }),
    [config, redactionOptions, dockMode, messages, isProcessing, sendMessage, clearMessages, activeResultSummary]
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
