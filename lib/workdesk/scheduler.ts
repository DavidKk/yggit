'use client'

/**
 * Coordinates foreground Git work with low-priority background Workdesk scanning.
 * Background Workdesk tasks run sequentially only when the foreground is idle
 * and yield immediately whenever the user starts loading, diffing, or scrolling.
 */

export const FOREGROUND_IDLE_COOLDOWN_MS = 1500
const BUSY_POLL_MS = 350

let activeForegroundTasks = 0
let lastForegroundActivityAt = 0
const pauseListeners = new Set<() => void>()

function notifyPauseListeners(): void {
  for (const listener of pauseListeners) {
    try {
      listener()
    } catch {
      // Ignore listener errors
    }
  }
}

/** Record recent user/UI activity (e.g. scrolling) so background work waits briefly. */
export function markForegroundActivity(): void {
  lastForegroundActivityAt = Date.now()
  notifyPauseListeners()
}

/**
 * Mark an active foreground Git operation (repo load, diff, conflict batch, write).
 * Returns an idempotent `end()` callback to release the slot.
 */
export function beginForegroundWork(): () => void {
  activeForegroundTasks += 1
  lastForegroundActivityAt = Date.now()
  notifyPauseListeners()

  let ended = false
  return () => {
    if (ended) return
    ended = true
    activeForegroundTasks = Math.max(0, activeForegroundTasks - 1)
    lastForegroundActivityAt = Date.now()
  }
}

/** Wrap a foreground async operation so background Workdesk scans pause while it runs. */
export async function runWithForegroundPriority<T>(task: () => Promise<T>): Promise<T> {
  const end = beginForegroundWork()
  try {
    return await task()
  } finally {
    end()
  }
}

/** True while a foreground operation is active, within cooldown, or when tab is hidden. */
export function isForegroundBusy(cooldownMs: number = FOREGROUND_IDLE_COOLDOWN_MS): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return true
  }
  if (activeForegroundTasks > 0) return true
  if (lastForegroundActivityAt > 0 && Date.now() - lastForegroundActivityAt < cooldownMs) {
    return true
  }
  return false
}

export function subscribeForegroundPause(listener: () => void): () => void {
  pauseListeners.add(listener)
  return () => {
    pauseListeners.delete(listener)
  }
}

function waitMs(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false)
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer)
      resolve(false)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve(true)
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function waitBrowserIdle(signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false)
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    return new Promise((resolve) => {
      let handle = 0
      const onAbort = () => {
        if (handle) window.cancelIdleCallback(handle)
        resolve(false)
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      handle = window.requestIdleCallback(
        () => {
          signal?.removeEventListener('abort', onAbort)
          resolve(!signal?.aborted)
        },
        { timeout: 1000 }
      )
    })
  }
  return waitMs(60, signal)
}

/**
 * Wait until foreground operations settle and an idle browser window opens.
 * Returns `false` if aborted while waiting.
 */
export async function waitForIdleWindow(signal?: AbortSignal, cooldownMs: number = FOREGROUND_IDLE_COOLDOWN_MS): Promise<boolean> {
  while (!signal?.aborted) {
    if (isForegroundBusy(cooldownMs)) {
      const ok = await waitMs(BUSY_POLL_MS, signal)
      if (!ok) return false
      continue
    }

    const idleOk = await waitBrowserIdle(signal)
    if (!idleOk) return false
    if (!isForegroundBusy(cooldownMs)) {
      return true
    }
  }
  return false
}
