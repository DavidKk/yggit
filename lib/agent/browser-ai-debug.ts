'use client'

import { useSyncExternalStore } from 'react'

export type BrowserAiDebugOverride = 'real' | 'downloadable' | 'unavailable' | 'unsupported'

let debugOverride: BrowserAiDebugOverride = 'real'
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getBrowserAiDebugOverride(): BrowserAiDebugOverride {
  return debugOverride
}

export function setBrowserAiDebugOverride(next: BrowserAiDebugOverride): void {
  if (debugOverride === next) return
  debugOverride = next
  emit()
}

export function useBrowserAiDebugOverride(): BrowserAiDebugOverride {
  return useSyncExternalStore(subscribe, getBrowserAiDebugOverride, getBrowserAiDebugOverride)
}
