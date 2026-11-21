/**
 * Model Context Protocol (MCP) & WebMCP Standard Types
 * Conforms to https://modelcontextprotocol.io/
 */

export interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  enabled: boolean
  serverId: string
}

export interface McpResourceInfo {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface McpPromptInfo {
  name: string
  description?: string
  arguments?: Array<{ name: string; description?: string; required?: boolean }>
}

export interface McpServerConfig {
  id: string
  name: string
  url: string
  transport: 'streamable-http'
  auth: {
    type: 'none' | 'bearer'
    token?: string
  }
  enabled: boolean
  tools?: McpToolInfo[]
  resources?: McpResourceInfo[]
  prompts?: McpPromptInfo[]
  status?: 'connected' | 'error' | 'disconnected'
  lastError?: string
  lastCheckedAt?: number
  createdAt: number
  updatedAt: number
}

export interface WebMcpSupportReport {
  supported: boolean
  reason: 'supported' | 'no_secure_context' | 'api_missing' | 'no_document'
  hints: string[]
}
