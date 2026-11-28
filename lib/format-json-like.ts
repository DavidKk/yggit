function formatPartialJson(input: string): string {
  let indent = 0
  let inString = false
  let escaped = false
  let out = ''

  const appendIndent = (level: number) => '  '.repeat(Math.max(0, level))

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]
    if (inString) {
      out += ch
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      out += ch
      continue
    }

    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      continue
    }

    if (ch === '{' || ch === '[') {
      const nextNonWs = input.slice(i + 1).match(/^\s*(.)/)?.[1]
      if ((ch === '{' && nextNonWs === '}') || (ch === '[' && nextNonWs === ']')) {
        out += ch === '{' ? '{}' : '[]'
        i += input.slice(i + 1).indexOf(nextNonWs!) + 1
      } else {
        indent += 1
        out += `${ch}\n${appendIndent(indent)}`
      }
      continue
    }

    if (ch === '}' || ch === ']') {
      indent = Math.max(0, indent - 1)
      out += `\n${appendIndent(indent)}${ch}`
      continue
    }

    if (ch === ',') {
      out += `,\n${appendIndent(indent)}`
      continue
    }

    if (ch === ':') {
      out += ': '
      continue
    }

    out += ch
  }

  return out
}

/**
 * Pretty-print complete or truncated JSON strings while returning plain strings unchanged.
 */
export function formatJsonLikeValue(value: unknown): { text: string; isEmpty: boolean } {
  if (value == null) return { text: '{}', isEmpty: true }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '{}') return { text: '{}', isEmpty: trimmed === '{}' || !trimmed }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        const formatted = JSON.stringify(parsed, null, 2)
        return { text: formatted, isEmpty: formatted === '{}' }
      } catch {
        return { text: formatPartialJson(trimmed), isEmpty: false }
      }
    }
    return { text: value, isEmpty: false }
  }

  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0) {
    return { text: '{}', isEmpty: true }
  }

  try {
    const formatted = JSON.stringify(value, null, 2)
    return { text: formatted, isEmpty: formatted === '{}' }
  } catch {
    return { text: String(value), isEmpty: false }
  }
}
