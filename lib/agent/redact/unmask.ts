import type { RedactionSession } from './types'

/**
 * Replaces all placeholders in a string with their original sensitive values.
 */
export function unmaskText(text: string, session: RedactionSession): string {
  if (!text || session.placeholderToOriginal.size === 0) {
    return text
  }

  let result = text
  session.placeholderToOriginal.forEach((original, placeholder) => {
    result = result.replaceAll(placeholder, original)
  })
  return result
}

/**
 * Streaming unmasker that handles potential placeholder boundary splits across SSE chunks.
 * e.g. chunk 1 ends with "{{USER_" and chunk 2 starts with "EMAIL_1}}".
 */
export class StreamingUnmasker {
  private buffer = ''
  private session: RedactionSession

  constructor(session: RedactionSession) {
    this.session = session
  }

  /**
   * Processes an incoming SSE text chunk and returns safely unmasked text.
   */
  public feed(chunk: string): string {
    this.buffer += chunk
    const lastOpenBrace = this.buffer.lastIndexOf('{{')
    const lastCloseBrace = this.buffer.lastIndexOf('}}')

    // If there is an incomplete placeholder at the end of the buffer, hold it for the next chunk
    if (lastOpenBrace !== -1 && lastOpenBrace > lastCloseBrace) {
      const safePart = this.buffer.slice(0, lastOpenBrace)
      this.buffer = this.buffer.slice(lastOpenBrace)
      return unmaskText(safePart, this.session)
    }

    const output = this.buffer
    this.buffer = ''
    return unmaskText(output, this.session)
  }

  /**
   * Flushes any remaining characters in the buffer when the stream completes.
   */
  public flush(): string {
    const finalChunk = this.buffer
    this.buffer = ''
    return unmaskText(finalChunk, this.session)
  }
}

/**
 * Recursively unmasks tool call arguments before execution by the local Git engine.
 * Ensures local Git commands (e.g. `git log --grep`) search with the real strings.
 */
export function unmaskToolArguments(args: Record<string, unknown>, session: RedactionSession): Record<string, unknown> {
  if (!args || session.placeholderToOriginal.size === 0) {
    return args
  }

  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(args)) {
    if (typeof val === 'string') {
      result[key] = unmaskText(val, session)
    } else if (Array.isArray(val)) {
      result[key] = val.map((item) =>
        typeof item === 'string' ? unmaskText(item, session) : typeof item === 'object' && item !== null ? unmaskToolArguments(item as Record<string, unknown>, session) : item
      )
    } else if (typeof val === 'object' && val !== null) {
      result[key] = unmaskToolArguments(val as Record<string, unknown>, session)
    } else {
      result[key] = val
    }
  }
  return result
}
