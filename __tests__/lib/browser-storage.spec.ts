/** @jest-environment jsdom */
import { clearBrowserStorage, inspectBrowserStorage, previewStorageValue, readStoragePage, STORAGE_PAGE_SIZE } from '@/lib/storage/browser-storage'

const originalIdb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches')
afterEach(() => {
  for (const [key, descriptor] of [
    ['indexedDB', originalIdb],
    ['caches', originalCaches],
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

it('paginates storage and limits previews, including binary and cyclic values', async () => {
  for (let index = 0; index < 65; index++) localStorage.setItem(`key-${index}`, `value-${index}`)
  const rows = await readStoragePage({ kind: 'local', name: 'localStorage' }, STORAGE_PAGE_SIZE)
  expect(rows).toHaveLength(30)
  expect(rows[0]).toEqual({ key: 'key-30', value: 'value-30' })
  const cycle: { self?: unknown; bytes: Uint8Array; number: bigint } = { bytes: new Uint8Array(3), number: BigInt(2) }
  cycle.self = cycle
  expect(previewStorageValue(cycle)).toContain('[Circular]')
  expect(previewStorageValue(cycle)).toContain('"byteLength": 3')
  expect(previewStorageValue('x'.repeat(20000))).toHaveLength(16000)
})

it('reads one IndexedDB page with cursor advancement and closes the connection', async () => {
  let index = 0
  const cursorRequest: Partial<IDBRequest> = {}
  const advance = jest.fn((offset: number) => {
    index += offset
    queueMicrotask(deliver)
  })
  const deliver = () => {
    Object.assign(cursorRequest, {
      result:
        index < 100
          ? {
              key: index,
              value: { index },
              advance,
              continue: () => {
                index++
                queueMicrotask(deliver)
              },
            }
          : null,
    })
    cursorRequest.onsuccess?.call(cursorRequest as IDBRequest, new Event('success'))
  }
  const close = jest.fn()
  const db = {
    close,
    transaction: () => ({
      objectStore: () => ({
        openCursor: () => {
          queueMicrotask(deliver)
          return cursorRequest
        },
      }),
    }),
  }
  installIdb({
    open: () => {
      const request: Partial<IDBOpenDBRequest> = { result: db as unknown as IDBDatabase }
      queueMicrotask(() => request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success')))
      return request
    },
  })
  const rows = await readStoragePage({ kind: 'idb', name: 'test', store: 'entries' }, 30)
  expect(advance).toHaveBeenCalledWith(30)
  expect(rows).toHaveLength(30)
  expect(rows[0].key).toBe('30')
  expect(rows[29].key).toBe('59')
  expect(close).toHaveBeenCalledTimes(1)
})

it('reports a blocked database and closes a delayed successful connection', async () => {
  const request: Partial<IDBOpenDBRequest> = {}
  const close = jest.fn()
  installIdb({
    databases: async () => [{ name: 'blocked' }],
    open: () => {
      queueMicrotask(() => request.onblocked?.call(request as IDBOpenDBRequest, new Event('blocked') as IDBVersionChangeEvent))
      return request
    },
  })
  const sources = await inspectBrowserStorage()
  expect(sources).toContainEqual({ kind: 'idb', name: 'blocked', error: 'IndexedDB blocked' })
  Object.assign(request, { result: { close } })
  request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success'))
  expect(close).toHaveBeenCalledTimes(1)
})

it('clears every discovered database, cache and web storage', async () => {
  localStorage.setItem('test', 'value')
  sessionStorage.setItem('test', 'value')
  const deleteDatabase = jest.fn(() => {
    const request: Partial<IDBOpenDBRequest> = {}
    queueMicrotask(() => request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success')))
    return request
  })
  const removeCache = jest.fn(async () => true)
  installIdb({ databases: async () => [{ name: 'one' }, { name: 'two' }], deleteDatabase })
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { keys: async () => ['cache-one', 'cache-two'], delete: removeCache } })
  await clearBrowserStorage()
  expect(deleteDatabase.mock.calls).toEqual([['one'], ['two']])
  expect(removeCache.mock.calls).toEqual([['cache-one'], ['cache-two']])
  expect(localStorage.length + sessionStorage.length).toBe(0)
})

it('continues cleanup and reports deletion errors instead of reporting success', async () => {
  localStorage.setItem('test', 'value')
  installIdb({
    databases: async () => [{ name: 'busy' }],
    deleteDatabase: () => {
      const request: Partial<IDBOpenDBRequest> = {}
      queueMicrotask(() => request.onblocked?.call(request as IDBOpenDBRequest, new Event('blocked') as IDBVersionChangeEvent))
      return request
    },
  })
  await expect(clearBrowserStorage()).rejects.toThrow('IndexedDB blocked: busy')
  expect(localStorage.length).toBe(0)
})
