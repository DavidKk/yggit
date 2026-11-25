import { logError, logInfo } from '@/lib/logger'

import type { McpPromptInfo, McpResourceInfo, McpServerConfig, McpToolInfo } from './types'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: string | number
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * Builds HTTP headers for an MCP request from the configured auth mode.
 */
export function buildMcpAuthHeaders(auth?: McpServerConfig['auth']): Record<string, string> {
  const result: Record<string, string> = {}
  if (!auth) return result

  if (auth.type === 'bearer' && auth.token) {
    result.Authorization = `Bearer ${auth.token}`
  } else if (auth.type === 'oauth' && auth.oauth?.accessToken) {
    const scheme = auth.oauth.tokenType || 'Bearer'
    result.Authorization = `${scheme} ${auth.oauth.accessToken}`
  }

  if (Array.isArray(auth.headers)) {
    for (const item of auth.headers) {
      const k = item.key.trim()
      if (k) {
        result[k] = item.value
      }
    }
  }

  return result
}

/**
 * Sends a standard JSON-RPC 2.0 request to an HTTP MCP Server.
 */
export async function sendMcpRequest<T = unknown>(
  url: string,
  method: string,
  params?: Record<string, unknown>,
  authHeaders?: Record<string, string>,
  timeoutMs = 15000
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...(authHeaders || {}),
  }

  const payload: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    method,
    params,
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`MCP HTTP ${res.status}: ${errText.slice(0, 300) || res.statusText}`)
    }

    const data = (await res.json()) as JsonRpcResponse<T>
    if (data.error) {
      throw new Error(`MCP Error [${data.error.code}]: ${data.error.message}`)
    }

    return data.result as T
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`MCP request timeout after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Tests connection to an MCP server, initializing protocol and discovering tools, resources, prompts.
 */
export async function testAndDiscoverMcpServer(config: McpServerConfig): Promise<{
  ok: boolean
  tools: McpToolInfo[]
  resources: McpResourceInfo[]
  prompts: McpPromptInfo[]
  error?: string
}> {
  const authHeaders = buildMcpAuthHeaders(config.auth)

  try {
    logInfo('mcp', `Connecting to MCP server "${config.name}" at ${config.url}`)

    // 1. Initialize MCP protocol session
    await sendMcpRequest(
      config.url,
      'initialize',
      {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        clientInfo: {
          name: 'Yggdrasil-Git-Agent',
          version: '1.0.0',
        },
      },
      authHeaders
    )

    // Send initialized notification if supported (fire and forget)
    sendMcpRequest(config.url, 'notifications/initialized', {}, authHeaders).catch(() => null)

    // 2. Discover Tools
    let tools: McpToolInfo[] = []
    try {
      const toolsResult = await sendMcpRequest<{ tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> }>(
        config.url,
        'tools/list',
        {},
        authHeaders
      )
      if (Array.isArray(toolsResult?.tools)) {
        tools = toolsResult.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          enabled: true,
          serverId: config.id,
        }))
      }
    } catch {
      // Server may not support tools
    }

    // 3. Discover Resources
    let resources: McpResourceInfo[] = []
    try {
      const resResult = await sendMcpRequest<{ resources?: McpResourceInfo[] }>(config.url, 'resources/list', {}, authHeaders)
      if (Array.isArray(resResult?.resources)) {
        resources = resResult.resources
      }
    } catch {
      // Server may not support resources
    }

    // 4. Discover Prompts
    let prompts: McpPromptInfo[] = []
    try {
      const promptResult = await sendMcpRequest<{ prompts?: McpPromptInfo[] }>(config.url, 'prompts/list', {}, authHeaders)
      if (Array.isArray(promptResult?.prompts)) {
        prompts = promptResult.prompts
      }
    } catch {
      // Server may not support prompts
    }

    logInfo('mcp', `Successfully connected to "${config.name}". Discovered ${tools.length} tools.`)
    return { ok: true, tools, resources, prompts }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logError('mcp', `Failed to connect to MCP server "${config.name}": ${error}`)
    return { ok: false, tools: [], resources: [], prompts: [], error }
  }
}

/**
 * Calls a specific tool on an MCP server.
 */
export async function callMcpTool(config: McpServerConfig, toolName: string, args: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const authHeaders = buildMcpAuthHeaders(config.auth)
  try {
    logInfo('mcp', `Calling MCP tool "${toolName}" on server "${config.name}"`, args)
    const res = await sendMcpRequest<{ content?: Array<{ type: string; text?: string }> }>(
      config.url,
      'tools/call',
      {
        name: toolName,
        arguments: args,
      },
      authHeaders
    )

    // Standard MCP tools/call returns content: [{ type: 'text', text: '...' }]
    let textResult: string | unknown = res
    if (Array.isArray(res?.content)) {
      textResult = res.content
        .map((c) => c.text || '')
        .filter(Boolean)
        .join('\n')
    }

    return { ok: true, result: textResult }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logError('mcp', `Error calling MCP tool "${toolName}": ${error}`)
    return { ok: false, error }
  }
}
