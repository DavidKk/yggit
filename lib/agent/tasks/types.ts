export type AgentStepType = 'plan' | 'skill_match' | 'llm_turn' | 'tool_call' | 'artifact'
export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AgentTaskStep {
  id: string
  timestamp: number
  type: AgentStepType
  title: string
  detail?: string
  input?: unknown
  output?: unknown
  status?: 'running' | 'success' | 'error'
  durationMs?: number
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface AgentTask {
  id: string
  title: string
  prompt: string
  status: AgentTaskStatus
  repo?: string
  model: string
  createdAt: number
  completedAt?: number
  durationMs?: number
  steps: AgentTaskStep[]
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    cachedTokens?: number
    totalTokens: number
  }
  error?: string
}
