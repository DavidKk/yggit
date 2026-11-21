/** @jest-environment jsdom */
import { TextEncoder } from 'node:util'

import { clearBrowserStorage, deleteBrowserDatabase, inspectBrowserStorage } from '@/lib/storage/browser-storage'
import { APP_DATABASE_NAMES, CONFLICTS_DATABASE, HANDLES_DATABASE } from '@/lib/storage/databases'

const originalIdb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches')
const originalEncoder = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder')
beforeEach(() => Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder }))
afterEach(() => {
  for (const [key, descriptor] of [
    ['indexedDB', originalIdb],
    ['caches', originalCaches],
    ['TextEncoder', originalEncoder],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
  localStorage.clear()
  sessionStorage.clear()
})

function installIdb(value: unknown) {
  Object.defineProperty(globalThis, 'indexedDB', { value, configurable: true })
}

function deletionRequest(blocked = false) {
  const request: Partial<IDBOpenDBRequest> = {}
  queueMicrotask(() => {
    if (blocked) request.onblocked?.call(request as IDBOpenDBRequest, new Event('blocked') as IDBVersionChangeEvent)
    else request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success'))
  })
  return request
}

function database(stores: Record<string, { key: unknown; value: unknown }[]>, abort = false) {
  return {
    close: jest.fn(),
    objectStoreNames: Object.keys(stores),
    transaction: () => {
      let remaining = Object.keys(stores).length
      const tx: Partial<IDBTransaction> = {
        objectStore: (name: string) =>
          ({
            openCursor: () => {
              const request: Partial<IDBRequest> = {}
              let index = 0
              const deliver = () => {
                if (abort) {
                  tx.onabort?.call(tx as IDBTransaction, new Event('abort'))
                  return
                }
                const row = stores[name][index++]
                Object.assign(request, { result: row ? { primaryKey: row.key, value: row.value, continue: () => queueMicrotask(deliver) } : null })
                request.onsuccess?.call(request as IDBRequest, new Event('success'))
                if (!row && --remaining === 0) tx.oncomplete?.call(tx as IDBTransaction, new Event('complete'))
              }
              queueMicrotask(deliver)
              return request
            },
          }) as IDBObjectStore,
      }
      return tx
    },
  }
}

it('lists only registered databases once each and estimates payloads across stores', async () => {
  const cycle: { self?: unknown; bytes: Uint8Array } = { bytes: new Uint8Array(3) }
  cycle.self = cycle
  const db = database({
    first: [{ key: 1, value: '中' }],
    second: [
      { key: 'b', value: new Blob(['12345']) },
      { key: 'c', value: cycle },
    ],
  })
  const open = jest.fn(() => {
    const request: Partial<IDBOpenDBRequest> = { result: db as unknown as IDBDatabase }
    queueMicrotask(() => request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success')))
    return request
  })
  installIdb({ databases: async () => [{ name: 'foreign' }, { name: 'yggit_not_registered' }, { name: HANDLES_DATABASE }], open })
  // 8 + 3 for the first row; 1 + 5 for the second; 1 + 5 + 3 + 4 for the cyclic object.
  expect(await inspectBrowserStorage()).toEqual([{ name: HANDLES_DATABASE, bytes: 30 }])
  expect(open.mock.calls).toEqual([[HANDLES_DATABASE]])
  expect(db.close).toHaveBeenCalledTimes(1)
})

it('reports aborted size scans without hiding the database or leaking connections', async () => {
  const db = database({ entries: [] }, true)
  installIdb({
    databases: async () => [{ name: CONFLICTS_DATABASE }],
    open: () => {
      const request: Partial<IDBOpenDBRequest> = { result: db as unknown as IDBDatabase }
      queueMicrotask(() => request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success')))
      return request
    },
  })
  expect(await inspectBrowserStorage()).toEqual([{ name: CONFLICTS_DATABASE, error: 'IndexedDB size estimation failed' }])
  expect(db.close).toHaveBeenCalledTimes(1)
})

it('probes only registered names and aborts creation of absent databases without enumeration', async () => {
  const abort = jest.fn()
  const open = jest.fn(() => {
    const request: Partial<IDBOpenDBRequest> = { transaction: { abort } as unknown as IDBTransaction }
    queueMicrotask(() => {
      request.onupgradeneeded?.call(request as IDBOpenDBRequest, new Event('upgradeneeded') as IDBVersionChangeEvent)
      request.onerror?.call(request as IDBOpenDBRequest, new Event('error'))
    })
    return request
  })
  installIdb({ open })
  expect(await inspectBrowserStorage()).toEqual([])
  expect(open.mock.calls).toEqual(APP_DATABASE_NAMES.map((name) => [name]))
  expect(abort).toHaveBeenCalledTimes(APP_DATABASE_NAMES.length)
})

it('reports a blocked database and closes a delayed successful connection', async () => {
  const request: Partial<IDBOpenDBRequest> = {}
  const close = jest.fn()
  installIdb({
    databases: async () => [{ name: HANDLES_DATABASE }],
    open: () => {
      queueMicrotask(() => request.onblocked?.call(request as IDBOpenDBRequest, new Event('blocked') as IDBVersionChangeEvent))
      return request
    },
  })
  expect(await inspectBrowserStorage()).toEqual([{ name: HANDLES_DATABASE, error: 'IndexedDB blocked' }])
  Object.assign(request, { result: { close } })
  request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success'))
  expect(close).toHaveBeenCalledTimes(1)
})

it('deletes a single registered database and rejects foreign names', async () => {
  const deleteDatabase = jest.fn(() => deletionRequest())
  installIdb({ deleteDatabase })
  await deleteBrowserDatabase(CONFLICTS_DATABASE)
  await expect(deleteBrowserDatabase('foreign')).rejects.toThrow('Unknown application database')
  await expect(deleteBrowserDatabase('yggit_not_registered')).rejects.toThrow('Unknown application database')
  expect(deleteDatabase.mock.calls).toEqual([[CONFLICTS_DATABASE]])
})

it('clears only application databases while preserving other origin storage', async () => {
  localStorage.setItem('test', 'value')
  sessionStorage.setItem('test', 'value')
  const deleteDatabase = jest.fn(() => deletionRequest())
  const removeCache = jest.fn(async () => true)
  installIdb({ databases: async () => [{ name: 'foreign' }, ...APP_DATABASE_NAMES.map((name) => ({ name }))], deleteDatabase })
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { keys: async () => ['foreign-cache'], delete: removeCache } })
  await clearBrowserStorage()
  expect(deleteDatabase.mock.calls).toEqual(APP_DATABASE_NAMES.map((name) => [name]))
  expect(removeCache).not.toHaveBeenCalled()
  expect(localStorage.getItem('test')).toBe('value')
  expect(sessionStorage.getItem('test')).toBe('value')
})

it('continues cleanup after blocked deletions and reports the error', async () => {
  const deleteDatabase = jest.fn((name: string) => deletionRequest(name === HANDLES_DATABASE))
  installIdb({ deleteDatabase })
  await expect(clearBrowserStorage()).rejects.toThrow(`IndexedDB blocked: ${HANDLES_DATABASE}`)
  expect(deleteDatabase.mock.calls).toEqual(APP_DATABASE_NAMES.map((name) => [name]))
})
