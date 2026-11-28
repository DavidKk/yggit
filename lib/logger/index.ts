/**
 * Unified Service Diagnostics Logger
 * Records logs across Agent, MCP, Skill, Git, and System components.
 * Supports memory ring-buffer, IndexedDB persistence, live subscriptions,
 * and one-click GitHub/GitLab issue report generation.
 */

import { LOGS_DATABASE } from '@/lib/storage/databases'

import { getLogRetentionPolicy, pruneIndexedDbStore, retainRecentEntries } from './retention'
import { createTraceId, resolveTraceId } from './trace-context'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'
export type LogModule = 'agent' | 'mcp' | 'skill' | 'git' | 'system'

export interface ServiceLogEntry {
  id: string
  traceId: string
  timestamp: number
  level: LogLevel
  module: LogModule
  message: string
  details?: string
}

export interface ScopedLogger {
  traceId: string
  info: (message: string, details?: unknown, moduleOverride?: LogModule) => ServiceLogEntry
  warn: (message: string, details?: unknown, moduleOverride?: LogModule) => ServiceLogEntry
  error: (message: string, details?: unknown, moduleOverride?: LogModule) => ServiceLogEntry
  debug: (message: string, details?: unknown, moduleOverride?: LogModule) => ServiceLogEntry
  child: (moduleOverride: LogModule) => ScopedLogger
}

export { createTraceId, getActiveTraceId, resolveTraceId, runWithTrace } from './trace-context'

const PRUNE_WRITE_INTERVAL = 20
const memoryLogs: ServiceLogEntry[] = []
let hydratedLogsFromDb = false
let writesSinceLastPrune = 0
type LogListener = (logs: ServiceLogEntry[]) => void
const listeners = new Set<LogListener>()

function notifyListeners() {
  const snapshot = [...memoryLogs]
  for (const listener of listeners) {
    try {
      listener(snapshot)
    } catch {
      // Ignore listener error
    }
  }
}

/** Open or create logs IndexedDB store */
export function openLogsDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(LOGS_DATABASE, 3)
      req.onupgradeneeded = () => {
        const db = req.result
        const tx = req.transaction
        if (!db.objectStoreNames.contains('service_logs')) {
          const store = db.createObjectStore('service_logs', { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp')
          store.createIndex('level', 'level')
          store.createIndex('module', 'module')
          store.createIndex('traceId', 'traceId')
        } else if (tx) {
          const store = tx.objectStore('service_logs')
          if (!store.indexNames.contains('traceId')) store.createIndex('traceId', 'traceId')
        }
        if (!db.objectStoreNames.contains('agent_traces')) {
          const traceStore = db.createObjectStore('agent_traces', { keyPath: 'id' })
          traceStore.createIndex('timestamp', 'timestamp')
          traceStore.createIndex('traceId', 'traceId')
        } else if (tx) {
          const traceStore = tx.objectStore('agent_traces')
          if (!traceStore.indexNames.contains('traceId')) traceStore.createIndex('traceId', 'traceId')
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Asynchronously persist entry to IndexedDB and periodically prune expired/excess records */
async function persistLogEntry(entry: ServiceLogEntry): Promise<void> {
  const db = await openLogsDb()
  if (!db) return
  try {
    const tx = db.transaction('service_logs', 'readwrite')
    tx.objectStore('service_logs').put(entry)
    writesSinceLastPrune += 1
    if (writesSinceLastPrune >= PRUNE_WRITE_INTERVAL) {
      writesSinceLastPrune = 0
      const policy = getLogRetentionPolicy()
      void pruneIndexedDbStore(db, 'service_logs', policy.maxLogs, policy.maxLogAgeMs)
    }
  } catch {
    // Fail silently on storage error
  }
}

/** Append a log entry */
export function recordLog(level: LogLevel, module: LogModule, message: string, details?: unknown, traceId?: string): ServiceLogEntry {
  let detailsStr: string | undefined
  if (details !== undefined) {
    if (typeof details === 'string') {
      detailsStr = details
    } else if (details instanceof Error) {
      detailsStr = `${details.name}: ${details.message}\n${details.stack || ''}`
    } else {
      try {
        detailsStr = JSON.stringify(details, null, 2)
      } catch {
        detailsStr = String(details)
      }
    }
  }

  const entry: ServiceLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    traceId: resolveTraceId(traceId),
    timestamp: Date.now(),
    level,
    module,
    message,
    details: detailsStr,
  }

  const policy = getLogRetentionPolicy()
  const retained = retainRecentEntries([entry, ...memoryLogs], policy.maxLogs, policy.maxLogAgeMs)
  memoryLogs.splice(0, memoryLogs.length, ...retained)

  void persistLogEntry(entry)
  notifyListeners()
  return entry
}

export const logInfo = (module: LogModule, message: string, details?: unknown, traceId?: string) => recordLog('info', module, message, details, traceId)
export const logWarn = (module: LogModule, message: string, details?: unknown, traceId?: string) => recordLog('warn', module, message, details, traceId)
export const logError = (module: LogModule, message: string, details?: unknown, traceId?: string) => recordLog('error', module, message, details, traceId)
export const logDebug = (module: LogModule, message: string, details?: unknown, traceId?: string) => recordLog('debug', module, message, details, traceId)

/**
 * Create a scoped logger bound to a single Trace ID so multi-step async flows correlate cleanly.
 */
export function createScopedLogger(defaultModule: LogModule, explicitTraceId?: string): ScopedLogger {
  const traceId = explicitTraceId?.trim() || createTraceId()
  return {
    traceId,
    info: (message, details, moduleOverride) => recordLog('info', moduleOverride ?? defaultModule, message, details, traceId),
    warn: (message, details, moduleOverride) => recordLog('warn', moduleOverride ?? defaultModule, message, details, traceId),
    error: (message, details, moduleOverride) => recordLog('error', moduleOverride ?? defaultModule, message, details, traceId),
    debug: (message, details, moduleOverride) => recordLog('debug', moduleOverride ?? defaultModule, message, details, traceId),
    child: (moduleOverride) => createScopedLogger(moduleOverride, traceId),
  }
}

export function getMemoryLogs(): ServiceLogEntry[] {
  return [...memoryLogs]
}

export function subscribeLogs(listener: LogListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Clear all logs in memory and IndexedDB */
export async function clearAllLogs(): Promise<void> {
  memoryLogs.length = 0
  hydratedLogsFromDb = true
  notifyListeners()
  const db = await openLogsDb()
  if (!db) return
  try {
    const tx = db.transaction('service_logs', 'readwrite')
    tx.objectStore('service_logs').clear()
  } catch {
    // Fail silently
  }
}

/** Load retained logs from IndexedDB, pruning expired/excess entries according to mode retention policy. */
export async function loadPersistedLogs(limit?: number, force = false): Promise<ServiceLogEntry[]> {
  const policy = getLogRetentionPolicy()
  const effectiveLimit = Math.min(limit ?? policy.maxLogs, policy.maxLogs)

  if (hydratedLogsFromDb && !force) {
    const trimmed = retainRecentEntries(memoryLogs, policy.maxLogs, policy.maxLogAgeMs)
    memoryLogs.splice(0, memoryLogs.length, ...trimmed)
    return memoryLogs.slice(0, effectiveLimit)
  }

  const db = await openLogsDb()
  if (!db) {
    const trimmed = retainRecentEntries(memoryLogs, policy.maxLogs, policy.maxLogAgeMs)
    memoryLogs.splice(0, memoryLogs.length, ...trimmed)
    return memoryLogs.slice(0, effectiveLimit)
  }

  const now = Date.now()
  const cutoff = now - policy.maxLogAgeMs

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('service_logs', 'readonly')
      const store = tx.objectStore('service_logs')
      const index = store.index('timestamp')
      const req = index.openCursor(null, 'prev')
      const results: ServiceLogEntry[] = []

      req.onsuccess = () => {
        const cursor = req.result
        if (cursor && results.length < effectiveLimit) {
          const item = cursor.value as ServiceLogEntry
          if (item.timestamp >= cutoff) {
            results.push(item)
            cursor.continue()
            return
          }
        }

        const deduped = new Map<string, ServiceLogEntry>()
        for (const item of memoryLogs) deduped.set(item.id, item)
        for (const item of results) deduped.set(item.id, item)
        const merged = retainRecentEntries([...deduped.values()], policy.maxLogs, policy.maxLogAgeMs, now)
        memoryLogs.splice(0, memoryLogs.length, ...merged)
        hydratedLogsFromDb = true

        void pruneIndexedDbStore(db, 'service_logs', policy.maxLogs, policy.maxLogAgeMs, now)
        resolve(memoryLogs.slice(0, effectiveLimit))
      }
      req.onerror = () => resolve(retainRecentEntries(memoryLogs, effectiveLimit, policy.maxLogAgeMs, now))
    } catch {
      resolve(retainRecentEntries(memoryLogs, effectiveLimit, policy.maxLogAgeMs, now))
    }
  })
}

/**
 * Generate a clean, sanitized markdown template suitable for reporting an Issue on GitHub/GitLab.
 */
export function generateIssueReportMarkdown(entries: ServiceLogEntry[]): string {
  const envInfo = [
    `- App: Yggdrasil Git Client`,
    `- User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}`,
    `- Date: ${new Date().toISOString()}`,
    `- Platform: ${typeof navigator !== 'undefined' ? navigator.platform : 'Unknown'}`,
  ].join('\n')

  const errorOrWarnLogs = entries.filter((e) => e.level === 'error' || e.level === 'warn').slice(0, 20)

  const logSection =
    errorOrWarnLogs.length > 0
      ? errorOrWarnLogs
          .map(
            (e) =>
              `\`[${new Date(e.timestamp).toISOString()}] [${e.level.toUpperCase()}] [${e.module}] [${e.traceId || '-'}]\` ${e.message}${e.details ? `\n\`\`\`\n${e.details.slice(0, 500)}\n\`\`\`` : ''}`
          )
          .join('\n\n')
      : 'No error or warning events recorded.'

  return `### 🐛 Problem Description
<!-- Please describe what happened, expected behavior, and reproduction steps -->

### 🖥️ Environment Info
${envInfo}

### 📋 Diagnostic Logs
<details>
<summary>Click to view service diagnostics logs</summary>

${logSection}

</details>
`
}
