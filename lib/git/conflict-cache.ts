/**
 * Client-side Merge Conflict Cache and Storage.
 * Provides L1 in-memory caching and L2 IndexedDB persistent storage.
 * Seamlessly interfaces with local file cache via /api/git/conflicts in local mode.
 */

import { getDriverMode, getGitDriver } from '@/lib/git/driver'
import { logInfo } from '@/lib/logger'
import { CONFLICTS_DATABASE } from '@/lib/storage/databases'

export interface MergeConflictRecord {
  hash: string
  hasConflict: boolean
  conflictCount?: number
  conflictFiles?: string[]
  unresolvedConflictFiles?: string[] | null
  conflictFileCounts?: Record<string, number | null>
  parent1?: string
  parent2?: string
  status: 'clean' | 'conflicted' | 'unsupported' | 'error'
  analyzedAt: number
}

const DB_NAME = CONFLICTS_DATABASE
const DB_VERSION = 3
const STORE_NAME = 'conflicts'

// L1 in-memory cache: key = `${repo}:${hash}`
const memoryCache = new Map<string, MergeConflictRecord>()
type RemergeDiffResult = { diff: string; files: string[]; record: MergeConflictRecord | null }
const remergeCache = new Map<string, RemergeDiffResult>()
const inFlightRemerge = new Map<string, Promise<RemergeDiffResult>>()
const MAX_REMERGE_CACHE = 32

function cacheKey(repo: string, hash: string): string {
  return `${repo.trim().toLowerCase()}:${hash.trim().toLowerCase()}`
}

function isIDBSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined' && window.indexedDB !== null
}

function openDB(): Promise<IDBDatabase | null> {
  if (!isIDBSupported()) return Promise.resolve(null)

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        } else if (event.oldVersion < DB_VERSION) {
          const tx = (event.target as IDBOpenDBRequest).transaction
          tx?.objectStore(STORE_NAME).clear()
        }
      }
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close()
        resolve(request.result)
      }
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function getConflictFromCache(repo: string, hash: string): Promise<MergeConflictRecord | null> {
  const key = cacheKey(repo, hash)
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!
  }

  const db = await openDB()
  if (!db) return null

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      tx.onabort = () => resolve(null)
      tx.onerror = () => resolve(null)
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => {
        const result = req.result as { key: string; record: MergeConflictRecord } | undefined
        if (result?.record) {
          memoryCache.set(key, result.record)
          resolve(result.record)
        } else {
          resolve(null)
        }
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function saveConflictToCache(repo: string, record: MergeConflictRecord): Promise<void> {
  const key = cacheKey(repo, record.hash)
  memoryCache.set(key, record)

  const db = await openDB()
  if (!db) return

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.onabort = () => resolve()
      tx.onerror = () => resolve()
      const store = tx.objectStore(STORE_NAME)
      const req = store.put({ key, record, updatedAt: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function getCachedConflictsBatch(repo: string, hashes: string[]): Promise<Record<string, MergeConflictRecord>> {
  const result: Record<string, MergeConflictRecord> = {}
  const missing: string[] = []

  for (const h of hashes) {
    const key = cacheKey(repo, h)
    if (memoryCache.has(key)) {
      result[h] = memoryCache.get(key)!
    } else {
      missing.push(h)
    }
  }

  if (missing.length === 0) return result

  const db = await openDB()
  if (!db) return result

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      tx.onabort = () => resolve()
      tx.onerror = () => resolve()
      const store = tx.objectStore(STORE_NAME)
      let completed = 0

      for (const h of missing) {
        const key = cacheKey(repo, h)
        const req = store.get(key)
        req.onsuccess = () => {
          const item = req.result as { key: string; record: MergeConflictRecord } | undefined
          if (item?.record) {
            memoryCache.set(key, item.record)
            result[h] = item.record
          }
          completed++
          if (completed >= missing.length) resolve()
        }
        req.onerror = () => {
          completed++
          if (completed >= missing.length) resolve()
        }
      }
    } catch {
      resolve()
    }
  })

  return result
}

function isEdgeDriverActive(): boolean {
  return getDriverMode() === 'edge'
}

/**
 * Queries conflicts for a batch of commits.
 * First reads from L1/L2 caches. In Edge mode, detects conflicts purely in-browser without calling server APIs.
 */
export async function queryConflictsBatch(repo: string, commits: Array<{ hash: string; parents: string[] }>, signal?: AbortSignal): Promise<Record<string, MergeConflictRecord>> {
  if (!repo || !commits.length) return {}

  const hashes = commits.map((c) => c.hash)
  const cachedMap = await getCachedConflictsBatch(repo, hashes)

  const uncached = commits.filter(
    (c) =>
      c.parents.length >= 2 &&
      (!cachedMap[c.hash] ||
        cachedMap[c.hash].status === 'error' ||
        (cachedMap[c.hash].hasConflict && (!cachedMap[c.hash].conflictFileCounts || cachedMap[c.hash].unresolvedConflictFiles === undefined)))
  )
  if (uncached.length === 0) {
    return cachedMap
  }

  if (isEdgeDriverActive()) {
    try {
      const edge = getGitDriver('edge')
      const fetched = (await edge.detectConflictsBatch?.(repo, uncached, signal)) ?? {}
      for (const [hash, record] of Object.entries(fetched)) {
        cachedMap[hash] = record
        if (record.status !== 'error') {
          void saveConflictToCache(repo, record)
        }
      }
      const conflictedCount = Object.values(fetched).filter((r) => r.hasConflict).length
      if (conflictedCount > 0) {
        logInfo('git', `Detected ${conflictedCount} conflicted merge commit(s) in ${repo}`, { mode: 'edge', checked: uncached.length })
      }
    } catch {
      // Ignore pure-browser detection errors
    }
    return cachedMap
  }

  try {
    const res = await fetch('/api/git/conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, commits: uncached }),
      signal,
    })

    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { conflicts?: Record<string, MergeConflictRecord> } | null
      const fetched = data?.conflicts || {}

      for (const [hash, record] of Object.entries(fetched)) {
        cachedMap[hash] = record
        void saveConflictToCache(repo, record)
      }
      const conflictedCount = Object.values(fetched).filter((r) => r.hasConflict).length
      if (conflictedCount > 0) {
        logInfo('git', `Detected ${conflictedCount} conflicted merge commit(s) in ${repo}`, { mode: 'local', checked: uncached.length })
      }
    }
  } catch {
    // Aborted or failed network fetch
  }

  return cachedMap
}

export async function fetchRemergeDiff(repo: string, hash: string): Promise<RemergeDiffResult> {
  const mode = getDriverMode()
  const key = `${mode}:${cacheKey(repo, hash)}`
  const cached = remergeCache.get(key)
  if (cached) {
    remergeCache.delete(key)
    remergeCache.set(key, cached)
    return cached
  }
  const existing = inFlightRemerge.get(key)
  if (existing) return existing

  const task = (async (): Promise<RemergeDiffResult> => {
    if (mode === 'edge') {
      try {
        const edge = getGitDriver('edge')
        return (await edge.readRemergeDiff?.(repo, hash)) ?? { diff: '', files: [], record: null }
      } catch {
        return { diff: '', files: [], record: null }
      }
    }

    const params = new URLSearchParams()
    if (repo) params.set('repo', repo)
    params.set('hash', hash)

    const res = await fetch(`/api/git/conflicts?${params.toString()}`)
    if (!res.ok) {
      throw new Error('无法读取冲突解决方案')
    }

    return (await res.json()) as RemergeDiffResult
  })()
    .then((result) => {
      if (result.diff || result.files.length > 0 || result.record) {
        if (remergeCache.size >= MAX_REMERGE_CACHE) {
          const oldest = remergeCache.keys().next().value
          if (oldest) remergeCache.delete(oldest)
        }
        remergeCache.set(key, result)
      }
      return result
    })
    .finally(() => {
      if (inFlightRemerge.get(key) === task) {
        inFlightRemerge.delete(key)
      }
    })

  inFlightRemerge.set(key, task)
  return task
}
