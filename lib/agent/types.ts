/**
 * Type definitions for ephemeral agent interaction, providers, and settings.
 */

export type AgentProviderType = 'openai' | 'claude' | 'gemini' | 'deepseek' | 'ollama' | 'local-sdk' | 'magpie' | 'byop' | 'vercel-free'

export interface EphemeralAgentConfig {
  provider: AgentProviderType
  model: string
  apiKey?: string
  baseUrl?: string
  modelsEndpoint?: string
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
  description: string
  isLocal?: boolean
}

export const AGENT_PRESETS: Record<AgentProviderType, ModelPresetDefinition> = {
  openai: {
    name: 'OpenAI (OpenAPI)',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini (轻量极速)' },
      { id: 'gpt-4o', name: 'GPT-4o (全能旗舰)' },
      { id: 'o3-mini', name: 'o3-mini (深度推理与代码优化)' },
      { id: 'o1', name: 'o1 (复杂多步推理)' },
      { id: 'o1-mini', name: 'o1-mini (快速推理)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ],
    requiresKey: true,
    noZdrNotice: false,
    description: 'OpenAI 官方 OpenAPI 标准接口。',
  },
  claude: {
    name: 'Anthropic Claude (OpenAPI)',
    provider: 'claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet (最新混合思考)' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (代码前沿)' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (轻量高并发)' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (长文本深度理解)' },
    ],
    requiresKey: true,
    noZdrNotice: false,
    description: 'Anthropic 协议或兼容网关端点。',
  },
  gemini: {
    name: 'Google Gemini (OpenAPI)',
    provider: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (高速多模态)' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (超长上下文深度分析)' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (极轻低延迟)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    ],
    requiresKey: true,
    noZdrNotice: false,
    description: 'Google Gemini OpenAPI 兼容端点。',
  },
  deepseek: {
    name: 'DeepSeek (OpenAPI)',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3 (超强综合代码与日常对话)' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (深度思维链推理)' },
    ],
    requiresKey: true,
    noZdrNotice: false,
    description: 'DeepSeek 官方 OpenAI 兼容接口。',
  },
  ollama: {
    name: 'Ollama',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5-coder',
    models: [
      { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder' },
      { id: 'deepseek-r1', name: 'DeepSeek R1' },
      { id: 'llama3.2', name: 'Llama 3.2' },
      { id: 'mistral', name: 'Mistral' },
    ],
    requiresKey: false,
    noZdrNotice: false,
    isLocal: false,
    description: '运行开源模型，数据不出内网。',
  },
  'local-sdk': {
    name: 'Local SDK (本地直连 / LM Studio / vLLM)',
    provider: 'local-sdk',
    baseUrl: 'http://127.0.0.1:1234/v1',
    defaultModel: 'local-model',
    models: [
      { id: 'local-model', name: 'Default Local Model' },
      { id: 'qwen2.5-coder-7b-instruct', name: 'Qwen 2.5 Coder 7B' },
      { id: 'deepseek-r1-distill-qwen-7b', name: 'DeepSeek R1 Distill Qwen 7B' },
      { id: 'llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct' },
    ],
    requiresKey: false,
    noZdrNotice: false,
    isLocal: true,
    description: '本地端口（LM Studio、vLLM）零跳跃直连。',
  },
  magpie: {
    name: 'Magpie (企业/自建网关)',
    provider: 'magpie',
    baseUrl: 'https://magpie.example.com/v1',
    defaultModel: 'workbuddy/deepseek-v4-pro',
    models: [
      { id: 'codex/gpt-6.1-sol', name: 'codex/gpt-6.1-sol' },
      { id: 'workbuddy/deepseek-v4-pro', name: 'workbuddy/deepseek-v4-pro' },
      { id: 'workbuddy/deepseek-v4.1-flash', name: 'workbuddy/deepseek-v4.1-flash' },
      { id: 'workbuddy/hy4flash-free', name: 'workbuddy/hy4flash-free' },
      { id: 'workbuddy-ai/hy4flash-free', name: 'workbuddy-ai/hy4flash-free' },
    ],
    requiresKey: true,
    noZdrNotice: false,
    description: 'Magpie 企业网关，支持自定义模型列表接口与路由分组。',
  },
  byop: {
    name: 'Custom OpenAI-Compatible (自定义端点)',
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
    description: '自建中转网关或第三方兼容服务端点。',
  },
  'vercel-free': {
    name: 'Vercel AI Gateway (Free)',
    provider: 'vercel-free',
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
    defaultModel: 'reflection/beam-free',
    models: [{ id: 'reflection/beam-free', name: 'Reflection Beam 1.0 (Free, 1M Context)' }],
    requiresKey: false,
    noZdrNotice: true,
    description: '开箱即用免配置的免费测试服务。',
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
