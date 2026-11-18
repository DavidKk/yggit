/**
 * Client-side Merge Conflict Cache and Storage.
 * Provides L1 in-memory caching and L2 IndexedDB persistent storage.
 * Seamlessly interfaces with local file cache via /api/git/conflicts in local mode.
 */

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

const DB_NAME = 'yggit_conflicts_cache'
const DB_VERSION = 1
const STORE_NAME = 'conflicts'

// L1 in-memory cache: key = `${repo}:${hash}`
const memoryCache = new Map<string, MergeConflictRecord>()

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

/**
 * Queries conflicts for a batch of commits.
 * First reads from L1/L2 caches. For uncached items, triggers the backend API which
 * checks local file cache and executes git merge-tree if needed, then caches into IndexedDB.
 */
export async function queryConflictsBatch(repo: string, commits: Array<{ hash: string; parents: string[] }>, signal?: AbortSignal): Promise<Record<string, MergeConflictRecord>> {
  if (!repo || !commits.length) return {}

  const hashes = commits.map((c) => c.hash)
  const cachedMap = await getCachedConflictsBatch(repo, hashes)

  const uncached = commits.filter(
    (c) =>
      c.parents.length >= 2 &&
      (!cachedMap[c.hash] || (cachedMap[c.hash].hasConflict && (!cachedMap[c.hash].conflictFileCounts || cachedMap[c.hash].unresolvedConflictFiles === undefined)))
  )
  if (uncached.length === 0) {
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
    }
  } catch {
    // Aborted or failed network fetch
  }

  return cachedMap
}

export async function fetchRemergeDiff(repo: string, hash: string): Promise<{ diff: string; files: string[]; record: MergeConflictRecord | null }> {
  const params = new URLSearchParams()
  if (repo) params.set('repo', repo)
  params.set('hash', hash)

  const res = await fetch(`/api/git/conflicts?${params.toString()}`)
  if (!res.ok) {
    throw new Error('无法读取冲突解决方案')
  }

  return (await res.json()) as { diff: string; files: string[]; record: MergeConflictRecord | null }
}
