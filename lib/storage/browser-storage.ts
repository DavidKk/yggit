import { APP_DATABASE_NAMES } from '@/lib/storage/databases'

export type StorageSource = { name: string; bytes?: number; error?: string }

function failure(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function databaseNames(): Promise<string[]> {
  if (!globalThis.indexedDB) return []
  if (typeof indexedDB.databases === 'function') {
    const existing = new Set((await indexedDB.databases()).map((db) => db.name))
    return APP_DATABASE_NAMES.filter((name) => existing.has(name))
  }
  return [...APP_DATABASE_NAMES]
}

function openDatabase(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name)
    let missing = false
    let blocked = false
    request.onupgradeneeded = () => {
      missing = true
      request.transaction?.abort()
    }
    request.onsuccess = () => {
      const db = request.result
      if (blocked) {
        db.close()
        return
      }
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => (missing ? resolve(null) : reject(request.error))
    request.onblocked = () => {
      blocked = true
      reject(new Error('IndexedDB blocked'))
    }
  })
}

// Estimate payload bytes only; engine/index overhead and external files are excluded.
function payloadBytes(value: unknown): number {
  const pending = [value]
  const seen = new WeakSet<object>()
  const encoder = new TextEncoder()
  let bytes = 0
  while (pending.length) {
    const item = pending.pop()
    if (typeof item === 'string') bytes += encoder.encode(item).byteLength
    else if (typeof item === 'number' || typeof item === 'bigint') bytes += 8
    else if (typeof item === 'boolean') bytes++
    else if (item && typeof item === 'object' && !seen.has(item)) {
      seen.add(item)
      if (item instanceof Blob) bytes += item.size
      else if (item instanceof ArrayBuffer || ArrayBuffer.isView(item)) bytes += item.byteLength
      else if (item instanceof Date) bytes += 8
      else if (typeof FileSystemHandle !== 'undefined' && item instanceof FileSystemHandle) pending.push(item.name, item.kind)
      else if (item instanceof Map) {
        for (const [key, entry] of item) pending.push(key, entry)
      } else if (item instanceof Set || Array.isArray(item)) {
        for (const entry of item) pending.push(entry)
      } else {
        for (const [key, entry] of Object.entries(item)) pending.push(key, entry)
      }
    }
  }
  return bytes
}

function estimateDatabaseBytes(db: IDBDatabase): Promise<number> {
  const stores = Array.from(db.objectStoreNames)
  if (!stores.length) return Promise.resolve(0)
  return new Promise((resolve, reject) => {
    let bytes = 0
    const transaction = db.transaction(stores, 'readonly')
    transaction.oncomplete = () => resolve(bytes)
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB size estimation failed'))
    for (const store of stores) {
      const request = transaction.objectStore(store).openCursor()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        try {
          bytes += payloadBytes(cursor.primaryKey) + payloadBytes(cursor.value)
          cursor.continue()
        } catch (error) {
          reject(error)
          transaction.abort()
        }
      }
    }
  })
}

export async function inspectBrowserStorage(): Promise<StorageSource[]> {
  const sources: StorageSource[] = []
  for (const name of await databaseNames()) {
    let db: IDBDatabase | null = null
    try {
      db = await openDatabase(name)
      if (db) sources.push({ name, bytes: await estimateDatabaseBytes(db) })
    } catch (error) {
      sources.push({ name, error: failure(error) })
    } finally {
      db?.close()
    }
  }
  return sources
}

export async function deleteBrowserDatabase(name: string): Promise<void> {
  if (!APP_DATABASE_NAMES.includes(name)) throw new Error('Unknown application database')
  if (!globalThis.indexedDB) return
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`IndexedDB blocked: ${name}`))
  })
}

export async function clearBrowserStorage(): Promise<void> {
  const failures: string[] = []
  for (const name of APP_DATABASE_NAMES) {
    try {
      await deleteBrowserDatabase(name)
    } catch (error) {
      failures.push(failure(error))
    }
  }
  if (failures.length) throw new Error(failures.join('\n'))
}
