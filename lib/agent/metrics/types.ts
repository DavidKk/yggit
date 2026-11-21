export type TokenInvocationPurpose = 'chat' | 'diagnostic' | 'git_action' | 'task'

export interface TokenUsageRecord {
  id: string
  timestamp: number
  model: string
  provider?: string
  purpose: TokenInvocationPurpose
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  totalTokens: number
  latencyMs?: number
  status: 'success' | 'error'
  taskId?: string
}

export interface ModelTokenStat {
  model: string
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  totalTokens: number
  requestCount: number
}

export interface PurposeTokenStat {
  purpose: TokenInvocationPurpose
  promptTokens: number
  completionTokens: number
  totalTokens: number
  requestCount: number
}

export interface TokenMetricsSummary {
  totalPromptTokens: number
  totalCompletionTokens: number
  totalCachedTokens: number
  totalTokens: number
  cacheHitRate: number // percentage e.g. 0-100
  totalRequests: number
  averageLatencyMs: number
  byModel: ModelTokenStat[]
  byPurpose: PurposeTokenStat[]
  records: TokenUsageRecord[]
}
