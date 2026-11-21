/**
 * Token Metrics Storage & Aggregation
 * Persists token consumption data into IndexedDB (Edge mode & local storage),
 * computing prompt, completion, cached token totals, breakdown by model and purpose,
 * and cache hit rates. Inspired by ticket-janitor token observability.
 */

import { METRICS_DATABASE } from '@/lib/storage/databases'

import type { ModelTokenStat, PurposeTokenStat, TokenMetricsSummary, TokenUsageRecord } from './types'

const memoryRecords: TokenUsageRecord[] = []
type MetricsListener = () => void
const listeners = new Set<MetricsListener>()

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      // Ignore listener error
    }
  }
}

function openMetricsDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(METRICS_DATABASE, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('token_records')) {
          const store = db.createObjectStore('token_records', { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp')
          store.createIndex('model', 'model')
          store.createIndex('purpose', 'purpose')
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function recordTokenUsage(data: Omit<TokenUsageRecord, 'id' | 'timestamp'> & { timestamp?: number }): Promise<TokenUsageRecord> {
  const entry: TokenUsageRecord = {
    ...data,
    id: `tok_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: data.timestamp || Date.now(),
    cachedTokens: data.cachedTokens || 0,
    totalTokens: data.totalTokens || data.promptTokens + data.completionTokens,
  }

  memoryRecords.unshift(entry)
  if (memoryRecords.length > 500) memoryRecords.pop()

  const db = await openMetricsDb()
  if (db) {
    try {
      const tx = db.transaction('token_records', 'readwrite')
      tx.objectStore('token_records').put(entry)
    } catch {
      // Fallback
    }
  }

  notifyListeners()
  return entry
}

export async function getTokenRecords(limit = 200): Promise<TokenUsageRecord[]> {
  const db = await openMetricsDb()
  if (!db) return [...memoryRecords].slice(0, limit)

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('token_records', 'readonly')
      const store = tx.objectStore('token_records')
      const index = store.index('timestamp')
      const req = index.openCursor(null, 'prev')
      const list: TokenUsageRecord[] = []

      req.onsuccess = () => {
        const cursor = req.result
        if (cursor && list.length < limit) {
          list.push(cursor.value)
          cursor.continue()
        } else {
          // Sync with memory
          for (const item of list) {
            if (!memoryRecords.some((r) => r.id === item.id)) {
              memoryRecords.push(item)
            }
          }
          resolve(list)
        }
      }
      req.onerror = () => resolve([...memoryRecords].slice(0, limit))
    } catch {
      resolve([...memoryRecords].slice(0, limit))
    }
  })
}

export async function getTokenMetricsSummary(days = 30): Promise<TokenMetricsSummary> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const records = await getTokenRecords(500)
  const filtered = records.filter((r) => r.timestamp >= cutoff)

  let totalPrompt = 0
  let totalCompletion = 0
  let totalCached = 0
  let totalTokens = 0
  let totalLatency = 0
  let latencyCount = 0

  const modelMap = new Map<string, ModelTokenStat>()
  const purposeMap = new Map<string, PurposeTokenStat>()

  for (const r of filtered) {
    totalPrompt += r.promptTokens
    totalCompletion += r.completionTokens
    totalCached += r.cachedTokens
    totalTokens += r.totalTokens

    if (r.latencyMs) {
      totalLatency += r.latencyMs
      latencyCount++
    }

    // Model breakdown
    const m = modelMap.get(r.model) || {
      model: r.model,
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
      requestCount: 0,
    }
    m.promptTokens += r.promptTokens
    m.completionTokens += r.completionTokens
    m.cachedTokens += r.cachedTokens
    m.totalTokens += r.totalTokens
    m.requestCount += 1
    modelMap.set(r.model, m)

    // Purpose breakdown
    const p = purposeMap.get(r.purpose) || {
      purpose: r.purpose,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      requestCount: 0,
    }
    p.promptTokens += r.promptTokens
    p.completionTokens += r.completionTokens
    p.totalTokens += r.totalTokens
    p.requestCount += 1
    purposeMap.set(r.purpose, p)
  }

  const denominator = totalPrompt + totalCached
  const cacheHitRate = denominator > 0 ? Math.round((totalCached / denominator) * 1000) / 10 : 0
  const averageLatencyMs = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0

  return {
    totalPromptTokens: totalPrompt,
    totalCompletionTokens: totalCompletion,
    totalCachedTokens: totalCached,
    totalTokens,
    cacheHitRate,
    totalRequests: filtered.length,
    averageLatencyMs,
    byModel: [...modelMap.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    byPurpose: [...purposeMap.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    records: filtered,
  }
}

export async function clearAllTokenMetrics(): Promise<void> {
  memoryRecords.length = 0
  const db = await openMetricsDb()
  if (db) {
    try {
      const tx = db.transaction('token_records', 'readwrite')
      tx.objectStore('token_records').clear()
    } catch {
      // Ignore
    }
  }
  notifyListeners()
}

export function subscribeTokenMetrics(listener: MetricsListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
