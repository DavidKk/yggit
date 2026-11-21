import { recordTokenUsage } from './metrics/storage'
import type { TokenInvocationPurpose } from './metrics/types'
import { RedactionEngine } from './redact/engine'
import { StreamingUnmasker, unmaskText, unmaskToolArguments } from './redact/unmask'
import type { AgentChatMessage, AgentCompletionResponse, AgentToolCall, AgentToolDefinition, EphemeralAgentConfig } from './types'

export interface CompletionOptions {
  config: EphemeralAgentConfig
  messages: AgentChatMessage[]
  tools?: AgentToolDefinition[]
  redactionEngine?: RedactionEngine
  onDelta?: (delta: string) => void
  signal?: AbortSignal
  purpose?: TokenInvocationPurpose
  taskId?: string
}

/**
 * Ephemeral OpenAPI / LLM Client.
 * Adheres strictly to Zero-Storage: credentials are read directly from memory parameters.
 */
export async function testAgentConnection(config: EphemeralAgentConfig): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = performance.now()
  try {
    const endpoint = config.baseUrl ? `${config.baseUrl.replace(/\/$/, '')}/chat/completions` : 'https://ai-gateway.vercel.sh/v1/chat/completions'

    const res = await fetch('/api/git/agent/gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        apiKey: config.apiKey,
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 2,
        stream: false,
      }),
    })

    const latencyMs = Math.round(performance.now() - start)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      const errorMsg = data?.error?.message || data?.error || `HTTP ${res.status}`
      return { ok: false, latencyMs, error: errorMsg }
    }

    return { ok: true, latencyMs }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    const errorMsg = err instanceof Error ? err.message : 'Connection failed'
    return { ok: false, latencyMs, error: errorMsg }
  }
}

/**
 * Send completion request to AI Gateway with integrated context desensitization
 * and real-time streaming unmasking.
 */
export async function sendAgentCompletion(options: CompletionOptions): Promise<AgentCompletionResponse> {
  const { config, messages, tools, redactionEngine, onDelta, signal } = options
  const start = performance.now()

  // Mask outgoing messages if a redaction engine is provided
  const sanitizedMessages = messages.map((m) => {
    let content = m.content
    if (redactionEngine && content) {
      const { sanitizedText } = redactionEngine.mask(content)
      content = sanitizedText
    }
    return {
      role: m.role,
      content,
      name: m.name,
      tool_calls: m.tool_calls,
      tool_call_id: m.tool_call_id,
    }
  })

  const endpoint = config.baseUrl ? `${config.baseUrl.replace(/\/$/, '')}/chat/completions` : 'https://ai-gateway.vercel.sh/v1/chat/completions'

  const shouldStream = Boolean(config.stream && onDelta)

  const payload: Record<string, unknown> = {
    endpoint,
    apiKey: config.apiKey,
    model: config.model,
    messages: sanitizedMessages,
    temperature: config.temperature ?? 0.2,
    stream: shouldStream,
  }

  if (config.maxTokens) {
    payload.max_tokens = config.maxTokens
  }

  if (tools && tools.length > 0) {
    payload.tools = tools
    payload.tool_choice = 'auto'
  }

  const response = await fetch('/api/git/agent/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null)
    const msg = errorJson?.error?.message || errorJson?.error || `Gateway error (${response.status})`
    throw new Error(msg)
  }

  // Handle SSE streaming
  if (shouldStream && response.body) {
    return handleStreamingResponse({
      response,
      redactionEngine,
      onDelta,
      start,
      options,
    })
  }

  // Handle JSON response
  const json = await response.json()
  const choice = json.choices?.[0]
  let rawContent = choice?.message?.content || ''
  let toolCalls: AgentToolCall[] | undefined = choice?.message?.tool_calls

  // Unmask content and tool calls
  if (redactionEngine) {
    const session = redactionEngine.getSession()
    rawContent = unmaskText(rawContent, session)
    if (toolCalls && toolCalls.length > 0) {
      toolCalls = toolCalls.map((tc) => {
        try {
          const parsedArgs = JSON.parse(tc.function.arguments)
          const unmaskedArgs = unmaskToolArguments(parsedArgs, session)
          return {
            ...tc,
            function: {
              ...tc.function,
              arguments: JSON.stringify(unmaskedArgs),
            },
          }
        } catch {
          return tc
        }
      })
    }
  }

  const latencyMs = Math.round(performance.now() - start)
  const promptTokens = json.usage?.prompt_tokens ?? Math.max(1, Math.round(messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 4))
  const completionTokens = json.usage?.completion_tokens ?? Math.max(1, Math.round(rawContent.length / 4))
  const cachedTokens = json.usage?.prompt_tokens_details?.cached_tokens ?? 0
  const totalTokens = json.usage?.total_tokens ?? promptTokens + completionTokens

  void recordTokenUsage({
    model: config.model,
    purpose: options.purpose || 'chat',
    promptTokens,
    completionTokens,
    cachedTokens,
    totalTokens,
    latencyMs,
    status: 'success',
    taskId: options.taskId,
  })

  return {
    id: json.id || `resp_${Date.now()}`,
    content: rawContent,
    toolCalls,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
    latencyMs,
  }
}

async function handleStreamingResponse(params: {
  response: Response
  redactionEngine?: RedactionEngine
  onDelta?: (delta: string) => void
  start: number
  options: CompletionOptions
}): Promise<AgentCompletionResponse> {
  const { response, redactionEngine, onDelta, start, options } = params
  const { config, messages } = options
  const session = redactionEngine ? redactionEngine.getSession() : undefined
  const unmasker = session ? new StreamingUnmasker(session) : undefined

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulatedContent = ''
  let responseId = `stream_${Date.now()}`
  let streamUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | undefined
  const toolCallsByIndex: Record<number, { id: string; name: string; arguments: string }> = {}

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const dataStr = trimmed.slice(5).trim()
        if (dataStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(dataStr)
          if (parsed.id) responseId = parsed.id
          if (parsed.usage) streamUsage = parsed.usage

          const delta = parsed.choices?.[0]?.delta
          if (!delta) continue

          if (delta.content) {
            const rawChunk = delta.content
            accumulatedContent += rawChunk

            if (onDelta) {
              if (unmasker) {
                const unmaskedChunk = unmasker.feed(rawChunk)
                if (unmaskedChunk) onDelta(unmaskedChunk)
              } else {
                onDelta(rawChunk)
              }
            }
          }

          if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!toolCallsByIndex[idx]) {
                toolCallsByIndex[idx] = {
                  id: tc.id || '',
                  name: tc.function?.name || '',
                  arguments: '',
                }
              }
              if (tc.id) toolCallsByIndex[idx].id = tc.id
              if (tc.function?.name) toolCallsByIndex[idx].name = tc.function.name
              if (tc.function?.arguments) {
                toolCallsByIndex[idx].arguments += tc.function.arguments
              }
            }
          }
        } catch {
          // Ignore JSON parse error in individual SSE message
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // Flush remaining buffer in unmasker
  if (unmasker && onDelta) {
    const trailing = unmasker.flush()
    if (trailing) onDelta(trailing)
  }

  // Final unmask of entire content to guarantee completeness
  if (session) {
    accumulatedContent = unmaskText(accumulatedContent, session)
  }

  // Format tool calls
  let toolCalls: AgentToolCall[] | undefined
  const accumulatedIndices = Object.keys(toolCallsByIndex)
  if (accumulatedIndices.length > 0) {
    toolCalls = accumulatedIndices.map((idxKey) => {
      const raw = toolCallsByIndex[Number(idxKey)]
      let finalArgs = raw.arguments
      if (session) {
        try {
          const parsed = JSON.parse(raw.arguments)
          const unmasked = unmaskToolArguments(parsed, session)
          finalArgs = JSON.stringify(unmasked)
        } catch {
          // keep as is if malformed
        }
      }
      return {
        id: raw.id || `call_${idxKey}`,
        type: 'function',
        function: {
          name: raw.name,
          arguments: finalArgs,
        },
      }
    })
  }

  const latencyMs = Math.round(performance.now() - start)
  const promptTokens = streamUsage?.prompt_tokens ?? Math.max(1, Math.round(messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 4))
  const completionTokens = streamUsage?.completion_tokens ?? Math.max(1, Math.round(accumulatedContent.length / 4))
  const cachedTokens = streamUsage?.prompt_tokens_details?.cached_tokens ?? 0
  const totalTokens = streamUsage?.total_tokens ?? promptTokens + completionTokens

  void recordTokenUsage({
    model: config.model,
    purpose: options.purpose || 'chat',
    promptTokens,
    completionTokens,
    cachedTokens,
    totalTokens,
    latencyMs,
    status: 'success',
    taskId: options.taskId,
  })

  return {
    id: responseId,
    content: accumulatedContent,
    toolCalls,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
    latencyMs,
  }
}
