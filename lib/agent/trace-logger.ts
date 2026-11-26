import { openLogsDb } from '@/lib/logger'

export interface AgentTraceToolExecution {
  name: string
  args: Record<string, unknown>
  ok: boolean
  outputPreview: string
  durationMs: number
}

export interface AgentRunTrace {
  id: string
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

const MAX_MEMORY_TRACES = 100
const memoryTraces: AgentRunTrace[] = []
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
  } catch {
    // Ignore storage errors
  }
}

/** Record an Agent execution trace in memory and IndexedDB. */
export function recordAgentTrace(input: Omit<AgentRunTrace, 'id' | 'timestamp'>): AgentRunTrace {
  const entry: AgentRunTrace = {
    ...input,
    id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  }

  memoryTraces.unshift(entry)
  if (memoryTraces.length > MAX_MEMORY_TRACES) {
    memoryTraces.pop()
  }

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

export async function loadPersistedAgentTraces(limit = 100): Promise<AgentRunTrace[]> {
  if (memoryTraces.length > 0) return [...memoryTraces]
  const db = await openLogsDb()
  if (!db || !db.objectStoreNames.contains('agent_traces')) return []

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('agent_traces', 'readonly')
      const store = tx.objectStore('agent_traces')
      const index = store.index('timestamp')
      const req = index.openCursor(null, 'prev')
      const results: AgentRunTrace[] = []

      req.onsuccess = () => {
        const cursor = req.result
        if (cursor && results.length < limit) {
          results.push(cursor.value as AgentRunTrace)
          cursor.continue()
        } else {
          for (const item of results) {
            if (!memoryTraces.some((t) => t.id === item.id)) {
              memoryTraces.push(item)
            }
          }
          resolve([...memoryTraces])
        }
      }
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

export async function clearAllAgentTraces(): Promise<void> {
  memoryTraces.length = 0
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
