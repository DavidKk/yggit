import type { WebMcpSupportReport } from './types'

export interface WebMcpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown
}

interface DocumentModelContext {
  registerTool: (definition: WebMcpToolDefinition, options?: { signal?: AbortSignal }) => Promise<unknown> | unknown
  getTools?: () => Promise<Array<{ name: string; description?: string }>>
}

/**
 * Accesses the browser's native WebMCP modelContext interface (Chrome 146+ proposal)
 */
export function getDocumentModelContext(): DocumentModelContext | null {
  if (typeof document === 'undefined') return null
  const fromDoc = (document as Document & { modelContext?: DocumentModelContext }).modelContext
  if (typeof fromDoc?.registerTool === 'function') return fromDoc

  const fromNav = typeof navigator !== 'undefined' ? (navigator as Navigator & { modelContext?: DocumentModelContext }).modelContext : undefined
  if (typeof fromNav?.registerTool === 'function') return fromNav

  return null
}

/**
 * Checks whether the current browser environment supports the W3C WebMCP API.
 */
export function getWebMcpSupportReport(): WebMcpSupportReport {
  if (typeof document === 'undefined') {
    return {
      supported: false,
      reason: 'no_document',
      hints: ['WebMCP can only run inside a browser document context.'],
    }
  }

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      supported: false,
      reason: 'no_secure_context',
      hints: ['WebMCP requires a secure HTTPS context or localhost.'],
    }
  }

  if (!getDocumentModelContext()) {
    return {
      supported: false,
      reason: 'api_missing',
      hints: [
        'Browser document.modelContext API is not available.',
        'Chrome 146+: Visit chrome://flags/#enable-webmcp-testing, set to Enabled, and restart.',
        'Alternatively, use standard HTTP MCP Server connections.',
      ],
    }
  }

  return {
    supported: true,
    reason: 'supported',
    hints: ['Native browser WebMCP is enabled and available for in-page agent tool registration.'],
  }
}
