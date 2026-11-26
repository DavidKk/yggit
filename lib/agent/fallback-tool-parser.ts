import type { AgentToolCall } from './types'

/**
 * Extracts structured tool calls from fenced text blocks (e.g. `tool_code`, `tool_call`, `json`)
 * emitted by models/providers that do not support native OpenAI `tool_calls` (such as Browser AI or local LLMs).
 */
export function parseFallbackToolCalls(content: string, allowedToolNames: Set<string>): { toolCalls: AgentToolCall[]; cleanedContent: string } {
  if (!content || allowedToolNames.size === 0) {
    return { toolCalls: [], cleanedContent: content }
  }

  const toolCalls: AgentToolCall[] = []
  const fenceRegex = /```(?:tool_code|tool_call|function_call|tool|json)?\s*\n([\s\S]*?)```/gi

  const cleaned = content
    .replace(fenceRegex, (fullMatch, body: string) => {
      const trimmedBody = body.trim()
      if (!trimmedBody) return fullMatch

      const parsedFromBlock = parseToolBlockBody(trimmedBody, allowedToolNames, toolCalls.length)
      if (parsedFromBlock.length > 0) {
        toolCalls.push(...parsedFromBlock)
        return ''
      }
      return fullMatch
    })
    .trim()

  return { toolCalls, cleanedContent: stripToolCodeBlocks(cleaned) }
}

/**
 * Strips any remaining `tool_code` / `tool_call` / `function_call` fenced blocks
 * (including incomplete trailing blocks during streaming) so raw tool syntax is never shown to the user.
 */
export function stripToolCodeBlocks(content: string): string {
  if (!content) return content
  return content
    .replace(/```\s*(?:tool_code|tool_call|function_call)\b[\s\S]*?```/gi, '')
    .replace(/```\s*(?:tool_code|tool_call|function_call)\b[\s\S]*$/i, '')
    .trim()
}

function parseToolBlockBody(body: string, allowedToolNames: Set<string>, startIndex: number): AgentToolCall[] {
  const results: AgentToolCall[] = []

  // 1. Try JSON object or array: {"name": "...", "arguments": {...}} or {"tool": "...", "args": {...}}
  if (body.startsWith('{') || body.startsWith('[')) {
    try {
      const parsed = JSON.parse(body) as unknown
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        const name = typeof obj.name === 'string' ? obj.name : typeof obj.tool === 'string' ? obj.tool : ''
        if (!name || !allowedToolNames.has(name)) continue
        const rawArgs = obj.arguments ?? obj.args ?? obj.params ?? {}
        const argsStr = typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs)
        results.push({
          id: `fallback_tc_${Date.now()}_${startIndex + results.length}`,
          type: 'function',
          function: { name, arguments: argsStr },
        })
      }
      if (results.length > 0) return results
    } catch {
      // Fall through to line-by-line parsing
    }
  }

  // 2. Try line-by-line function call or bare tool name: e.g. `get_branches` or `get_branches()` or `find_commits(query="fix")`
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  for (const line of lines) {
    // Match `tool_name` or `tool_name(...)` or `print(tool_name(...))`
    const unwrapped = line.replace(/^print\((.*)\)$/, '$1').trim()
    const match = unwrapped.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\(([\s\S]*)\))?;?$/)
    if (!match) continue

    const name = match[1]
    if (!allowedToolNames.has(name)) continue

    const rawArgs = (match[2] || '').trim()
    const argsObj = parseKeywordOrJsonArgs(rawArgs)
    results.push({
      id: `fallback_tc_${Date.now()}_${startIndex + results.length}`,
      type: 'function',
      function: {
        name,
        arguments: JSON.stringify(argsObj),
      },
    })
  }

  return results
}

function parseKeywordOrJsonArgs(rawArgs: string): Record<string, unknown> {
  if (!rawArgs) return {}
  if (rawArgs.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawArgs) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Fall through to keyword arg parsing
    }
  }

  const result: Record<string, unknown> = {}
  const kwRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(true|false|\d+(?:\.\d+)?))/g
  let match: RegExpExecArray | null
  while ((match = kwRegex.exec(rawArgs)) !== null) {
    const key = match[1]
    if (match[2] !== undefined) result[key] = match[2]
    else if (match[3] !== undefined) result[key] = match[3]
    else if (match[4] === 'true') result[key] = true
    else if (match[4] === 'false') result[key] = false
    else if (match[4] !== undefined) result[key] = Number(match[4])
  }
  return result
}
