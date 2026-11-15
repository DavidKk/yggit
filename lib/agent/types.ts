/**
 * Type definitions for ephemeral agent interaction, providers, and settings.
 */

export type AgentProviderType = 'vercel-free' | 'byop' | 'ollama'

export interface EphemeralAgentConfig {
  provider: AgentProviderType
  model: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ModelPresetDefinition {
  name: string
  provider: AgentProviderType
  baseUrl: string
  defaultModel: string
  models: Array<{ id: string; name: string }>
  requiresKey: boolean
  noZdrNotice: boolean
}

export const AGENT_PRESETS: Record<AgentProviderType, ModelPresetDefinition> = {
  'vercel-free': {
    name: 'Vercel AI Gateway (Free)',
    provider: 'vercel-free',
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
    defaultModel: 'reflection/beam-free',
    models: [{ id: 'reflection/beam-free', name: 'Reflection Beam 1.0 (Free, 1M Context)' }],
    requiresKey: false,
    noZdrNotice: true,
  },
  byop: {
    name: 'Custom OpenAI-Compatible (BYOP)',
    provider: 'byop',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    ],
    requiresKey: true,
    noZdrNotice: false,
  },
  ollama: {
    name: 'Ollama (Local)',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2' },
      { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder' },
      { id: 'deepseek-r1', name: 'DeepSeek R1' },
    ],
    requiresKey: false,
    noZdrNotice: false,
  },
}

export const DEFAULT_AGENT_CONFIG: EphemeralAgentConfig = {
  provider: 'vercel-free',
  model: 'reflection/beam-free',
  baseUrl: 'https://ai-gateway.vercel.sh/v1',
  temperature: 0.2,
  stream: true,
}

export interface AgentToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface AgentChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  tool_calls?: AgentToolCall[]
  tool_call_id?: string
  createdAt?: number
  isStreaming?: boolean
}

export interface AgentToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export interface AgentCompletionResponse {
  id: string
  content: string
  toolCalls?: AgentToolCall[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  latencyMs?: number
}

export type AgentDockMode = 'collapsed' | 'quick-card' | 'dock-right' | 'dock-bottom' | 'modal'
