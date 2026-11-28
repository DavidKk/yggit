import type { RouteDriverMode } from '@/lib/git/route-mode'
import { driverModeFromPathname } from '@/lib/git/route-mode'

const DAY_MS = 24 * 60 * 60 * 1000

export interface LogRetentionPolicy {
  mode: RouteDriverMode
  maxLogs: number
  logRetentionDays: number
  maxLogAgeMs: number
  maxTraces: number
  traceRetentionDays: number
  maxTraceAgeMs: number
}

const RETENTION_BY_MODE: Record<RouteDriverMode, LogRetentionPolicy> = {
  edge: {
    mode: 'edge',
    maxLogs: 500,
    logRetentionDays: 7,
    maxLogAgeMs: 7 * DAY_MS,
    maxTraces: 100,
    traceRetentionDays: 7,
    maxTraceAgeMs: 7 * DAY_MS,
  },
  local: {
    mode: 'local',
    maxLogs: 2000,
    logRetentionDays: 30,
    maxLogAgeMs: 30 * DAY_MS,
    maxTraces: 300,
    traceRetentionDays: 30,
    maxTraceAgeMs: 30 * DAY_MS,
  },
}

const ACTIVE_LOG_MODE_STORAGE_KEY = 'yggit.log-retention-mode'

/**
 * Resolve active driver mode from browser pathname (tracking non-`/dev` routes in sessionStorage
 * so navigating to `/dev/logs` preserves the active Edge or Local retention policy).
 */
export function getActiveLogMode(): RouteDriverMode {
  if (typeof window === 'undefined') return 'edge'
  const pathname = window.location?.pathname || ''
  if (pathname.startsWith('/dev')) {
    try {
      if (typeof document !== 'undefined' && document.referrer) {
        const refUrl = new URL(document.referrer, window.location.origin)
        if (refUrl.origin === window.location.origin && !refUrl.pathname.startsWith('/dev')) {
          return driverModeFromPathname(refUrl.pathname)
        }
      }
      const stored = window.sessionStorage.getItem(ACTIVE_LOG_MODE_STORAGE_KEY)
      if (stored === 'local' || stored === 'edge') return stored
    } catch {
      // Ignore storage or URL restrictions
    }
    return 'edge'
  }

  const resolved = driverModeFromPathname(pathname)
  try {
    window.sessionStorage.setItem(ACTIVE_LOG_MODE_STORAGE_KEY, resolved)
  } catch {
    // Ignore storage restrictions
  }
  return resolved
}

/** Return recommended retention caps (count + TTL) for Edge or Local mode. */
export function getLogRetentionPolicy(mode?: RouteDriverMode): LogRetentionPolicy {
  const activeMode = mode ?? getActiveLogMode()
  return RETENTION_BY_MODE[activeMode]
}

/**
 * Filter out expired entries, enforce newest-first order, and trim to `maxCount`.
 */
export function retainRecentEntries<T extends { timestamp: number }>(entries: readonly T[], maxCount: number, maxAgeMs: number, now = Date.now()): T[] {
  const cutoff = now - maxAgeMs
  const valid = entries.filter((entry) => typeof entry.timestamp === 'number' && entry.timestamp >= cutoff)
  valid.sort((a, b) => b.timestamp - a.timestamp)
  return valid.slice(0, Math.max(0, maxCount))
}

/**
 * Sweep expired or excess records from an IndexedDB log/trace store using its `timestamp` index.
 */
export async function pruneIndexedDbStore(
  db: IDBDatabase | null,
  storeName: 'service_logs' | 'agent_traces',
  maxCount: number,
  maxAgeMs: number,
  now = Date.now()
): Promise<number> {
  if (!db || !db.objectStoreNames.contains(storeName)) return 0
  const cutoff = now - maxAgeMs

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      if (!store.indexNames.contains('timestamp')) {
        resolve(0)
        return
      }
      const req = store.index('timestamp').openCursor(null, 'prev')
      let kept = 0
      let deleted = 0

      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) {
          resolve(deleted)
          return
        }
        const value = cursor.value as { timestamp?: number } | undefined
        const ts = typeof value?.timestamp === 'number' ? value.timestamp : 0
        if (ts < cutoff || kept >= maxCount) {
          cursor.delete()
          deleted += 1
        } else {
          kept += 1
        }
        cursor.continue()
      }
      req.onerror = () => resolve(deleted)
    } catch {
      resolve(0)
    }
  })
}
