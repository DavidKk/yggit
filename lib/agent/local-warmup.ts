const warmedKeys = new Set<string>()

/**
 * Tracks whether a local browser runtime (Chrome Built-in AI or Transformers.js WebGPU/WASM)
 * has already completed initial session/model loading in the current page session.
 */
export function isLocalRuntimeWarmedUp(key: string): boolean {
  return warmedKeys.has(key)
}

export function markLocalRuntimeWarmedUp(key: string): void {
  warmedKeys.add(key)
}

export function clearLocalRuntimeWarmup(prefix?: string): void {
  if (!prefix) {
    warmedKeys.clear()
    return
  }
  for (const key of Array.from(warmedKeys)) {
    if (key.startsWith(prefix)) {
      warmedKeys.delete(key)
    }
  }
}
