/**
 * Type definitions for ephemeral agent interaction, providers, and settings.
 */

export type AgentProviderType =
  | 'chatgpt'
  | 'openai'
  | 'claude'
  | 'gemini'
  | 'deepseek'
  | 'ollama'
  | 'local-sdk'
  | 'claude-cli'
  | 'codex-cli'
  | 'antigravity-cli'
  | 'cursor-cli'
  | 'gemini-cli'
  | 'magpie'
  | 'byop'
  | 'vercel-free'

export type AgentCliAdapter = 'claude' | 'codex' | 'antigravity' | 'cursor' | 'gemini'

export interface EphemeralAgentConfig {
  provider: AgentProviderType
  model: string
  apiKey?: string
  hasApiKey?: boolean
  baseUrl?: string
  cliCommand?: string
  modelsEndpoint?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ModelPresetDefinition {
  name: string
  provider: AgentProviderType
  baseUrl: string
  modelsEndpoint?: string
  defaultModel: string
  models: Array<{ id: string; name: string }>
  requiresKey: boolean
  noZdrNotice: boolean
  description: string
  isLocal?: boolean
  isCli?: boolean
  cliAdapter?: AgentCliAdapter
}

export interface EndpointSuggestionPreset {
  id: string
  label: string
  baseUrl: string
  modelsEndpoint?: string
}

export const OPENAPI_ENDPOINT_SUGGESTIONS: EndpointSuggestionPreset[] = [
  {
    id: 'cpa',
    label: 'CPA (localhost:8317)',
    baseUrl: 'http://localhost:8317/v1',
  },
  {
    id: 'magpie',
    label: 'Magpie (127.0.0.1:3425)',
    baseUrl: 'http://127.0.0.1:3425/v1',
    modelsEndpoint: 'http://127.0.0.1:3425/v1/codex/models',
  },
  {
    id: 'ollama',
    label: 'Ollama (localhost:11434)',
    baseUrl: 'http://localhost:11434/v1',
  },
  {
    id: 'lm-studio',
    label: 'LM Studio (127.0.0.1:1234)',
    baseUrl: 'http://127.0.0.1:1234/v1',
  },
]

export const AGENT_PRESETS: Record<AgentProviderType, ModelPresetDefinition> = {
  chatgpt: {
    name: 'ChatGPT (OpenAPI)',
    provider: 'chatgpt',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'chatgpt-4o-latest',
    models: [
      { id: 'chatgpt-4o-latest', name: 'ChatGPT-4o-latest (ChatGPT 最新动态版本)' },
      { id: 'gpt-4o', name: 'GPT-4o (全能旗舰)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini (轻量极速)' },
      { id: 'o3-mini', name: 'o3-mini (深度推理与代码优化)' },
      { id: 'o1', name: 'o1 (复杂多步推理)' },
      { id: 'o1-mini', name: 'o1-mini (快速推理)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ],
    requiresKey: true,
    noZdrNotice: false,
    description: 'ChatGPT / OpenAI 官方标准 OpenAPI 接口。',
  },
  openai: {
    name: 'OpenAI (OpenAPI)',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini (轻量极速)' },
      { id: 'gpt-4o', name: 'GPT-4o (全能旗舰)' },
      { id: 'chatgpt-4o-latest', name: 'ChatGPT-4o-latest (最新动态对齐版本)' },
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
  'claude-cli': {
    name: 'Claude Code (Local CLI)',
    provider: 'claude-cli',
    baseUrl: 'claude',
    defaultModel: 'claude-sonnet-4-5',
    models: [
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-opus-4-1', name: 'Claude Opus 4.1' },
      { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5' },
    ],
    requiresKey: false,
    noZdrNotice: false,
    isLocal: true,
    isCli: true,
    cliAdapter: 'claude',
    description: '调用本机官方 Claude Code CLI（claude），优先复用本地订阅登录态。',
  },
  'codex-cli': {
    name: 'OpenAI Codex (Local CLI / SDK)',
    provider: 'codex-cli',
    baseUrl: 'codex',
    defaultModel: 'gpt-5-codex',
    models: [
      { id: 'gpt-5-codex', name: 'GPT-5 Codex' },
      { id: 'gpt-5', name: 'GPT-5' },
      { id: 'o3', name: 'o3' },
    ],
    requiresKey: false,
    noZdrNotice: false,
    isLocal: true,
    isCli: true,
    cliAdapter: 'codex',
    description: '调用本机官方 OpenAI Codex CLI（codex exec），支持 ~/.codex/auth.json 登录态。',
  },
  'antigravity-cli': {
    name: 'Antigravity CLI (反重力 CLI / agy)',
    provider: 'antigravity-cli',
    baseUrl: 'agy',
    defaultModel: 'gemini-2.5-pro',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
    ],
    requiresKey: false,
    noZdrNotice: false,
    isLocal: true,
    isCli: true,
    cliAdapter: 'antigravity',
    description: '调用本机官方 Antigravity CLI（agy），支持动态拉取 agy models 清单。',
  },
  'cursor-cli': {
    name: 'Cursor Agent (Local CLI)',
    provider: 'cursor-cli',
    baseUrl: 'agent',
    defaultModel: 'auto',
    models: [
      { id: 'auto', name: 'Auto (Cursor Default)' },
      { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet' },
      { id: 'gpt-5', name: 'GPT-5' },
    ],
    requiresKey: false,
    noZdrNotice: false,
    isLocal: true,
    isCli: true,
    cliAdapter: 'cursor',
    description: '调用本机 Cursor Agent CLI（agent / cursor-agent），复用 Cursor 登录态。',
  },
  'gemini-cli': {
    name: 'Gemini CLI (Local CLI)',
    provider: 'gemini-cli',
    baseUrl: 'gemini',
    defaultModel: 'gemini-2.5-pro',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    ],
    requiresKey: false,
    noZdrNotice: false,
    isLocal: true,
    isCli: true,
    cliAdapter: 'gemini',
    description: '调用本机官方 Gemini CLI（gemini），复用 Google 本地授权。',
  },
  magpie: {
    name: 'Magpie (企业/自建网关)',
    provider: 'magpie',
    baseUrl: 'http://127.0.0.1:3425/v1',
    modelsEndpoint: 'http://127.0.0.1:3425/v1/codex/models',
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
  isError?: boolean
  statusTool?: { name: string; branch?: string }
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
