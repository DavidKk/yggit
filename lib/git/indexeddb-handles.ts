/**
 * IndexedDB Directory Handles Persistence & Repo Alias Store
 * Implements persistent Web File System Access API handles for zero-prompt restoration.
 */

export interface StoredRepoRecord {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  updatedAt: number
}

export interface StoredAliasRecord {
  alias: string
  canonicalId: string
  updatedAt: number
}

const DB_NAME = 'yggit_handles_store'
const DB_VERSION = 1
const HANDLES_STORE = 'directory_handles'
const ALIASES_STORE = 'repo_aliases'

/**
 * Check if the current browser environment supports the Web File System Access API
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

/**
 * Check if IndexedDB is available in the current environment
 */
export function isIndexedDBSupported(): boolean {
  const idb = typeof window !== 'undefined' ? window.indexedDB : typeof indexedDB !== 'undefined' ? indexedDB : undefined
  return typeof idb !== 'undefined' && idb !== null
}

/**
 * Open or upgrade the IndexedDB database
 */
export function openHandlesDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDBSupported()) return Promise.resolve(null)
  const idb = typeof window !== 'undefined' && window.indexedDB ? window.indexedDB : indexedDB

  return new Promise((resolve, reject) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(HANDLES_STORE)) {
          db.createObjectStore(HANDLES_STORE, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(ALIASES_STORE)) {
          db.createObjectStore(ALIASES_STORE, { keyPath: 'alias' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Save or update a directory handle in IndexedDB
 */
export async function saveDirectoryHandle(
  repoId: string,
  handle: FileSystemDirectoryHandle,
  name?: string
): Promise<void> {
  const db = await openHandlesDatabase()
  if (!db) return

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(HANDLES_STORE, 'readwrite')
      const store = tx.objectStore(HANDLES_STORE)
      const record: StoredRepoRecord = {
        id: repoId,
        name: name || handle.name || repoId,
        handle,
        updatedAt: Date.now(),
      }
      const request = store.put(record)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Retrieve a directory handle by repository ID, resolving aliases if necessary
 */
export async function getDirectoryHandle(repoId: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandlesDatabase()
  if (!db) return null

  // Check if repoId is an alias
  const canonicalId = (await resolveRepoAlias(repoId)) || repoId

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(HANDLES_STORE, 'readonly')
      const store = tx.objectStore(HANDLES_STORE)
      const request = store.get(canonicalId)
      request.onsuccess = () => {
        const record = request.result as StoredRepoRecord | undefined
        resolve(record?.handle || null)
      }
      request.onerror = () => reject(request.error)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * List all saved directory handles metadata (without loading full handles)
 */
export async function listDirectoryHandles(): Promise<Array<{ id: string; name: string; updatedAt: number }>> {
  const db = await openHandlesDatabase()
  if (!db) return []

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(HANDLES_STORE, 'readonly')
      const store = tx.objectStore(HANDLES_STORE)
      const request = store.getAll()
      request.onsuccess = () => {
        const records = (request.result || []) as StoredRepoRecord[]
        resolve(
          records.map((r) => ({
            id: r.id,
            name: r.name,
            updatedAt: r.updatedAt,
          }))
        )
      }
      request.onerror = () => reject(request.error)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Remove a stored directory handle
 */
export async function removeDirectoryHandle(repoId: string): Promise<void> {
  const db = await openHandlesDatabase()
  if (!db) return

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(HANDLES_STORE, 'readwrite')
      const store = tx.objectStore(HANDLES_STORE)
      const request = store.delete(repoId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Save an alias mapping (e.g. self-hosted GitLab URL or old path -> canonical ID)
 */
export async function saveRepoAlias(alias: string, canonicalId: string): Promise<void> {
  const db = await openHandlesDatabase()
  if (!db) return

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(ALIASES_STORE, 'readwrite')
      const store = tx.objectStore(ALIASES_STORE)
      const record: StoredAliasRecord = {
        alias,
        canonicalId,
        updatedAt: Date.now(),
      }
      const request = store.put(record)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Resolve an alias to its canonical repository ID
 */
export async function resolveRepoAlias(alias: string): Promise<string | null> {
  const db = await openHandlesDatabase()
  if (!db) return null

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(ALIASES_STORE, 'readonly')
      const store = tx.objectStore(ALIASES_STORE)
      const request = store.get(alias)
      request.onsuccess = () => {
        const record = request.result as StoredAliasRecord | undefined
        resolve(record?.canonicalId || null)
      }
      request.onerror = () => reject(request.error)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Verify whether permission is currently granted for the handle
 */
export async function verifyHandlePermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'read'
): Promise<boolean> {
  if (typeof handle.queryPermission !== 'function') return true
  try {
    const status = await handle.queryPermission({ mode })
    return status === 'granted'
  } catch {
    return false
  }
}

/**
 * Request user permission for a handle if not already granted
 */
export async function requestHandlePermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'read'
): Promise<boolean> {
  if (typeof handle.requestPermission !== 'function') return true
  try {
    const status = await handle.requestPermission({ mode })
    return status === 'granted'
  } catch {
    return false
  }
}
