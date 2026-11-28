const STANDALONE_HOME_RE = /^(?:\/Users\/[^/]+|\/home\/[^/]+|[A-Za-z]:[\\/]Users[\\/][^\\/]+)(?=$|[\\/])/
const EMBEDDED_HOME_RE = /(?:\/Users\/[^/\s"'`<>()]+|\/home\/[^/\s"'`<>()]+|[A-Za-z]:\\Users\\[^\\\s"'`<>()]+|[A-Za-z]:\/Users\/[^/\s"'`<>()]+)(?=$|[\\/\s"'`<>(),;:])/g

/**
 * Replace OS user home directory prefixes (`/Users/<name>`, `/home/<name>`, `C:\Users\<name>`)
 * with `~` so usernames are never exposed in rendered paths across macOS, Linux, and Windows.
 */
export function maskUserHomePath(rawPath: string): string {
  if (!rawPath) return ''
  return rawPath.replace(STANDALONE_HOME_RE, '~')
}

/**
 * Redact embedded OS user home directory prefixes inside log messages, JSON payloads, or stack traces.
 */
export function maskUserHomeInText(text: string): string {
  if (!text) return ''
  return text.replace(EMBEDDED_HOME_RE, '~')
}
