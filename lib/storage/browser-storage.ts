export type StorageSource = { kind: 'local' | 'session' | 'idb' | 'cache'; name: string; store?: string; count?: number; error?: string }
export type StorageEntry = { key: string; value: string }
export const STORAGE_PAGE_SIZE = 30

function failure(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function previewStorageValue(value: unknown): string {
  const seen = new WeakSet<object>()
  return (
    JSON.stringify(
      value,
      (_key, item) => {
        if (typeof item === 'bigint') return String(item)
        if (item && typeof item === 'object') {
          if (seen.has(item)) return '[Circular]'
          seen.add(item)
          if (typeof FileSystemHandle !== 'undefined' && item instanceof FileSystemHandle) return { kind: item.kind, name: item.name }
          if (item instanceof Blob) return { type: item.type, size: item.size }
          if (item instanceof ArrayBuffer || ArrayBuffer.isView(item)) return { type: item.constructor.name, byteLength: item.byteLength }
        }
        return item
      },
      2
    ) ?? String(value)
  ).slice(0, 16000)
}

async function databaseNames(): Promise<string[]> {
  if (!globalThis.indexedDB) return []
  if (typeof indexedDB.databases === 'function') return (await indexedDB.databases()).flatMap((db) => (db.name ? [db.name] : []))
  return ['yggit_handles_store', 'yggit_conflicts_cache']
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

export async function inspectBrowserStorage(): Promise<StorageSource[]> {
  const sources: StorageSource[] = []
  for (const kind of ['local', 'session'] as const) {
    try {
      sources.push({ kind, name: kind === 'local' ? 'localStorage' : 'sessionStorage', count: (kind === 'local' ? localStorage : sessionStorage).length })
    } catch (error) {
      sources.push({ kind, name: kind, error: failure(error) })
    }
  }
  try {
    for (const name of await databaseNames()) {
      let db: IDBDatabase | null = null
      try {
        db = await openDatabase(name)
        if (!db) continue
        if (!db.objectStoreNames.length) sources.push({ kind: 'idb', name, count: 0 })
        for (const store of Array.from(db.objectStoreNames)) {
          try {
            const count = await new Promise<number>((resolve, reject) => {
              const request = db!.transaction(store, 'readonly').objectStore(store).count()
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            })
            sources.push({ kind: 'idb', name, store, count })
          } catch (error) {
            sources.push({ kind: 'idb', name, store, error: failure(error) })
          }
        }
      } catch (error) {
        sources.push({ kind: 'idb', name, error: failure(error) })
      } finally {
        db?.close()
      }
    }
  } catch (error) {
    sources.push({ kind: 'idb', name: 'IndexedDB', error: failure(error) })
  }
  if (globalThis.caches) {
    try {
      for (const name of await caches.keys()) sources.push({ kind: 'cache', name })
    } catch (error) {
      sources.push({ kind: 'cache', name: 'Cache Storage', error: failure(error) })
    }
  }
  return sources
}

export async function readStoragePage(source: StorageSource, offset: number): Promise<StorageEntry[]> {
  if (source.kind === 'local' || source.kind === 'session') {
    const storage = source.kind === 'local' ? localStorage : sessionStorage
    const rows: StorageEntry[] = []
    for (let i = offset; i < Math.min(storage.length, offset + STORAGE_PAGE_SIZE); i++) {
      const key = storage.key(i)
      if (key !== null) rows.push({ key, value: (storage.getItem(key) ?? '').slice(0, 16000) })
    }
    return rows
  }
  if (source.kind === 'cache') {
    const cache = await caches.open(source.name)
    const keys = await cache.keys()
    return keys.slice(offset, offset + STORAGE_PAGE_SIZE).map((request) => ({ key: request.url, value: request.method }))
  }
  if (!source.store) return []
  const db = await openDatabase(source.name)
  if (!db) return []
  try {
    return await new Promise<StorageEntry[]>((resolve, reject) => {
      const request = db.transaction(source.store!, 'readonly').objectStore(source.store!).openCursor()
      const rows: StorageEntry[] = []
      let skipped = offset === 0
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor || rows.length === STORAGE_PAGE_SIZE) {
          resolve(rows)
          return
        }
        if (!skipped) {
          skipped = true
          cursor.advance(offset)
          return
        }
        rows.push({ key: previewStorageValue(cursor.key), value: previewStorageValue(cursor.value) })
        cursor.continue()
      }
    })
  } finally {
    db.close()
  }
}

export async function clearBrowserStorage(): Promise<void> {
  // Discover databases before deleting anything so enumeration failures are recoverable.
  const names = await databaseNames()
  const failures: string[] = []
  for (const name of names) {
    try {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error(`IndexedDB blocked: ${name}`))
      })
    } catch (error) {
      failures.push(failure(error))
    }
  }
  for (const storage of [() => localStorage, () => sessionStorage]) {
    try {
      storage().clear()
    } catch (error) {
      failures.push(failure(error))
    }
  }
  if (globalThis.caches) {
    try {
      for (const name of await caches.keys()) if (!(await caches.delete(name))) failures.push(`Cache Storage: ${name}`)
    } catch (error) {
      failures.push(failure(error))
    }
  }
  if (failures.length) throw new Error(failures.join('\n'))
}
