const traceStack: string[] = []

/**
 * Generate a compact, unique Trace ID matching the platform `tr_<id>` convention.
 */
export function createTraceId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return `tr_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
    }
  } catch {
    // Fallback below
  }
  const timePart = Date.now().toString(36).slice(-5)
  const randPart = Math.random().toString(36).slice(2, 9)
  return `tr_${timePart}${randPart}`
}

/** Return the active Trace ID from the current synchronous execution scope, if any. */
export function getActiveTraceId(): string | undefined {
  return traceStack.length > 0 ? traceStack[traceStack.length - 1] : undefined
}

/** Resolve explicit Trace ID, falling back to active scope or generating a fresh ID. */
export function resolveTraceId(explicitTraceId?: string | null): string {
  const trimmed = explicitTraceId?.trim()
  if (trimmed) return trimmed
  return getActiveTraceId() || createTraceId()
}

/** Execute a synchronous callback with `traceId` active for implicit log correlation. */
export function runWithTrace<T>(traceId: string, fn: () => T): T {
  traceStack.push(traceId)
  try {
    return fn()
  } finally {
    traceStack.pop()
  }
}
