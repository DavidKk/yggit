/**
 * Unified Service Diagnostics Logger
 * Records logs across Agent, MCP, Skill, Git, and System components.
 * Supports memory ring-buffer, IndexedDB persistence, live subscriptions,
 * and one-click GitHub/GitLab issue report generation.
 */

import { LOGS_DATABASE } from '@/lib/storage/databases'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'
export type LogModule = 'agent' | 'mcp' | 'skill' | 'git' | 'system'

export interface ServiceLogEntry {
  id: string
  timestamp: number
  level: LogLevel
  module: LogModule
  message: string
  details?: string
}

const MAX_MEMORY_LOGS = 500
const memoryLogs: ServiceLogEntry[] = []
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
function openLogsDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(LOGS_DATABASE, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('service_logs')) {
          const store = db.createObjectStore('service_logs', { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp')
          store.createIndex('level', 'level')
          store.createIndex('module', 'module')
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Asynchronously persist entry to IndexedDB */
async function persistLogEntry(entry: ServiceLogEntry): Promise<void> {
  const db = await openLogsDb()
  if (!db) return
  try {
    const tx = db.transaction('service_logs', 'readwrite')
    tx.objectStore('service_logs').put(entry)
  } catch {
    // Fail silently on storage error
  }
}

/** Append a log entry */
export function recordLog(level: LogLevel, module: LogModule, message: string, details?: unknown): ServiceLogEntry {
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
    timestamp: Date.now(),
    level,
    module,
    message,
    details: detailsStr,
  }

  memoryLogs.unshift(entry)
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs.pop()
  }

  void persistLogEntry(entry)
  notifyListeners()
  return entry
}

export const logInfo = (module: LogModule, message: string, details?: unknown) => recordLog('info', module, message, details)
export const logWarn = (module: LogModule, message: string, details?: unknown) => recordLog('warn', module, message, details)
export const logError = (module: LogModule, message: string, details?: unknown) => recordLog('error', module, message, details)
export const logDebug = (module: LogModule, message: string, details?: unknown) => recordLog('debug', module, message, details)

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

/** Load past logs from IndexedDB if memory logs are empty */
export async function loadPersistedLogs(limit = 100): Promise<ServiceLogEntry[]> {
  if (memoryLogs.length > 0) return [...memoryLogs]
  const db = await openLogsDb()
  if (!db) return []
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('service_logs', 'readonly')
      const store = tx.objectStore('service_logs')
      const index = store.index('timestamp')
      const req = index.openCursor(null, 'prev')
      const results: ServiceLogEntry[] = []

      req.onsuccess = () => {
        const cursor = req.result
        if (cursor && results.length < limit) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          for (const item of results) {
            if (!memoryLogs.some((l) => l.id === item.id)) {
              memoryLogs.push(item)
            }
          }
          resolve([...memoryLogs])
        }
      }
      req.onerror = () => resolve([])
    } catch {
      resolve([])
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
              `\`[${new Date(e.timestamp).toISOString()}] [${e.level.toUpperCase()}] [${e.module}]\` ${e.message}${e.details ? `\n\`\`\`\n${e.details.slice(0, 500)}\n\`\`\`` : ''}`
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
