import { openLogsDb, resolveTraceId } from '@/lib/logger'
import { getLogRetentionPolicy, pruneIndexedDbStore, retainRecentEntries } from '@/lib/logger/retention'
import { normalizeLegacyTraceId } from '@/lib/logger/trace-context'

export interface AgentTraceToolExecution {
  name: string
  args: Record<string, unknown>
  ok: boolean
  outputPreview: string
  durationMs: number
}

export interface AgentRunTrace {
  id: string
  traceId: string
  timestamp: number
  durationMs: number
  status: 'success' | 'error'
  provider: string
  model: string
  profileName?: string
  repo?: string
  userPrompt: string
  requestMessages: Array<{ role: string; content: string }>
  toolNames: string[]
  matchedSkills: string[]
  nativeToolCalls: Array<{ name: string; arguments: string }>
  fallbackToolCalls: Array<{ name: string; arguments: string }>
  toolExecutions: AgentTraceToolExecution[]
  rawTurnOneContent: string
  rawFinalContent?: string
  visibleContent: string
  error?: string
  tokenUsage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

const PRUNE_WRITE_INTERVAL = 10
const memoryTraces: AgentRunTrace[] = []
let hydratedTracesFromDb = false
let traceWritesSincePrune = 0
type TraceListener = (traces: AgentRunTrace[]) => void
const listeners = new Set<TraceListener>()

function notifyListeners() {
  const snapshot = [...memoryTraces]
  for (const listener of listeners) {
    try {
      listener(snapshot)
    } catch {
      // Ignore listener errors
    }
  }
}

async function persistTrace(entry: AgentRunTrace): Promise<void> {
  const db = await openLogsDb()
  if (!db || !db.objectStoreNames.contains('agent_traces')) return
  try {
    const tx = db.transaction('agent_traces', 'readwrite')
    tx.objectStore('agent_traces').put(entry)
    traceWritesSincePrune += 1
    if (traceWritesSincePrune >= PRUNE_WRITE_INTERVAL) {
      traceWritesSincePrune = 0
      const policy = getLogRetentionPolicy()
      void pruneIndexedDbStore(db, 'agent_traces', policy.maxTraces, policy.maxTraceAgeMs)
    }
  } catch {
    // Ignore storage errors
  }
}

export type RecordAgentTraceInput = Omit<AgentRunTrace, 'id' | 'timestamp' | 'traceId'> & {
  traceId?: string
}

/** Record an Agent execution trace in memory and IndexedDB. */
export function recordAgentTrace(input: RecordAgentTraceInput): AgentRunTrace {
  const entry: AgentRunTrace = {
    ...input,
    id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    traceId: resolveTraceId(input.traceId),
    timestamp: Date.now(),
  }

  const policy = getLogRetentionPolicy()
  const retained = retainRecentEntries([entry, ...memoryTraces], policy.maxTraces, policy.maxTraceAgeMs)
  memoryTraces.splice(0, memoryTraces.length, ...retained)

  void persistTrace(entry)
  notifyListeners()
  return entry
}

export function getMemoryAgentTraces(): AgentRunTrace[] {
  return [...memoryTraces]
}

export function subscribeAgentTraces(listener: TraceListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function loadPersistedAgentTraces(limit?: number, force = false): Promise<AgentRunTrace[]> {
  const policy = getLogRetentionPolicy()
  const effectiveLimit = Math.min(limit ?? policy.maxTraces, policy.maxTraces)

  if (hydratedTracesFromDb && !force) {
    const trimmed = retainRecentEntries(memoryTraces, policy.maxTraces, policy.maxTraceAgeMs)
    memoryTraces.splice(0, memoryTraces.length, ...trimmed)
    return memoryTraces.slice(0, effectiveLimit)
  }

  const db = await openLogsDb()
  if (!db || !db.objectStoreNames.contains('agent_traces')) {
    const trimmed = retainRecentEntries(memoryTraces, policy.maxTraces, policy.maxTraceAgeMs)
    memoryTraces.splice(0, memoryTraces.length, ...trimmed)
    return memoryTraces.slice(0, effectiveLimit)
  }

  const now = Date.now()
  const cutoff = now - policy.maxTraceAgeMs

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('agent_traces', 'readonly')
      const store = tx.objectStore('agent_traces')
      const index = store.index('timestamp')
      const req = index.openCursor(null, 'prev')
      const results: AgentRunTrace[] = []

      req.onsuccess = () => {
        const cursor = req.result
        if (cursor && results.length < effectiveLimit) {
          const raw = cursor.value as AgentRunTrace
          const item: AgentRunTrace = {
            ...raw,
            traceId: normalizeLegacyTraceId(raw.traceId, raw.id),
          }
          if (item.timestamp >= cutoff) {
            results.push(item)
            cursor.continue()
            return
          }
        }

        const deduped = new Map<string, AgentRunTrace>()
        for (const item of memoryTraces) deduped.set(item.id, item)
        for (const item of results) deduped.set(item.id, item)
        const merged = retainRecentEntries([...deduped.values()], policy.maxTraces, policy.maxTraceAgeMs, now)
        memoryTraces.splice(0, memoryTraces.length, ...merged)
        hydratedTracesFromDb = true

        void pruneIndexedDbStore(db, 'agent_traces', policy.maxTraces, policy.maxTraceAgeMs, now)
        resolve(memoryTraces.slice(0, effectiveLimit))
      }
      req.onerror = () => resolve(retainRecentEntries(memoryTraces, effectiveLimit, policy.maxTraceAgeMs, now))
    } catch {
      resolve(retainRecentEntries(memoryTraces, effectiveLimit, policy.maxTraceAgeMs, now))
    }
  })
}

export async function clearAllAgentTraces(): Promise<void> {
  memoryTraces.length = 0
  hydratedTracesFromDb = true
  notifyListeners()
  const db = await openLogsDb()
  if (!db || !db.objectStoreNames.contains('agent_traces')) return
  try {
    const tx = db.transaction('agent_traces', 'readwrite')
    tx.objectStore('agent_traces').clear()
  } catch {
    // Ignore storage errors
  }
}
