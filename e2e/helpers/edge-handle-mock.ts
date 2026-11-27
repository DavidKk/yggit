import fs from 'node:fs'
import path from 'node:path'

export interface SerializedTreeNode {
  kind: 'file' | 'directory'
  name: string
  contentBase64?: string
  children?: SerializedTreeNode[]
}

export function serializeDirectoryToTree(dirPath: string, name = path.basename(dirPath)): SerializedTreeNode {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const children: SerializedTreeNode[] = []
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      children.push(serializeDirectoryToTree(fullPath, entry.name))
    } else if (entry.isFile()) {
      children.push({
        kind: 'file',
        name: entry.name,
        contentBase64: fs.readFileSync(fullPath).toString('base64'),
      })
    }
  }
  return { kind: 'directory', name, children }
}

/**
 * Browser-side init script that mounts a virtual FileSystemDirectoryHandle into IndexedDB
 * (`yggit_handles_store` / `directory_handles`) for Edge mode E2E tests.
 */
export function edgeHandleInitScript(params: { handleId: string; tree: SerializedTreeNode }) {
  const { handleId, tree } = params

  function decodeBase64(b64: string): Uint8Array {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }

  function makeFileHandle(node: SerializedTreeNode): FileSystemFileHandle {
    let bytes = decodeBase64(node.contentBase64 || '')
    const handle = {
      kind: 'file' as const,
      name: node.name,
      isSameEntry: async (other: FileSystemHandle) => other === handle,
      queryPermission: async () => 'granted' as PermissionState,
      requestPermission: async () => 'granted' as PermissionState,
      getFile: async () => new File([bytes.slice().buffer], node.name, { lastModified: Date.now() }),
      createWritable: async () => {
        const chunks: Uint8Array[] = []
        return {
          write: async (data: unknown) => {
            if (data instanceof Uint8Array) chunks.push(data)
            else if (data instanceof ArrayBuffer) chunks.push(new Uint8Array(data))
            else if (typeof data === 'string') chunks.push(new TextEncoder().encode(data))
            else if (data && typeof data === 'object' && 'data' in data) {
              const inner = (data as { data: unknown }).data
              if (inner instanceof Uint8Array) chunks.push(inner)
              else if (typeof inner === 'string') chunks.push(new TextEncoder().encode(inner))
            }
          },
          close: async () => {
            const total = chunks.reduce((acc, c) => acc + c.byteLength, 0)
            const merged = new Uint8Array(total)
            let offset = 0
            for (const c of chunks) {
              merged.set(c, offset)
              offset += c.byteLength
            }
            bytes = merged
          },
        } as unknown as FileSystemWritableFileStream
      },
    }
    return handle as unknown as FileSystemFileHandle
  }

  function makeDirHandle(node: SerializedTreeNode): FileSystemDirectoryHandle {
    const map = new Map<string, FileSystemDirectoryHandle | FileSystemFileHandle>()
    for (const child of node.children || []) {
      map.set(child.name, child.kind === 'directory' ? makeDirHandle(child) : makeFileHandle(child))
    }

    const handle = {
      kind: 'directory' as const,
      name: node.name,
      isSameEntry: async (other: FileSystemHandle) => other === handle,
      queryPermission: async () => 'granted' as PermissionState,
      requestPermission: async () => 'granted' as PermissionState,
      getDirectoryHandle: async (name: string, options?: { create?: boolean }) => {
        const existing = map.get(name)
        if (existing && existing.kind === 'directory') return existing
        if (existing) throw new DOMException('Not a directory', 'TypeMismatchError')
        if (options?.create) {
          const created = makeDirHandle({ kind: 'directory', name, children: [] })
          map.set(name, created)
          return created
        }
        throw new DOMException(`Directory not found: ${name}`, 'NotFoundError')
      },
      getFileHandle: async (name: string, options?: { create?: boolean }) => {
        const existing = map.get(name)
        if (existing && existing.kind === 'file') return existing
        if (existing) throw new DOMException('Not a file', 'TypeMismatchError')
        if (options?.create) {
          const created = makeFileHandle({ kind: 'file', name, contentBase64: '' })
          map.set(name, created)
          return created
        }
        throw new DOMException(`File not found: ${name}`, 'NotFoundError')
      },
      removeEntry: async (name: string) => {
        map.delete(name)
      },
      entries: async function* () {
        for (const [k, v] of map.entries()) yield [k, v] as [string, FileSystemHandle]
      },
      keys: async function* () {
        for (const k of map.keys()) yield k
      },
      values: async function* () {
        for (const v of map.values()) yield v
      },
      [Symbol.asyncIterator]: async function* () {
        for (const [k, v] of map.entries()) yield [k, v] as [string, FileSystemHandle]
      },
    }
    return handle as unknown as FileSystemDirectoryHandle
  }

  const rootHandle = makeDirHandle(tree)
  const record = {
    id: handleId,
    name: tree.name,
    handle: rootHandle,
    addedAt: Date.now(),
  }

  const memHandles = new Map<IDBValidKey, unknown>([[handleId, record]])

  ;(window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker = async () => rootHandle

  const makeFakeReq = (store: IDBObjectStore, result: unknown): IDBRequest => {
    const fakeReq: Record<string, unknown> = {
      result,
      error: null,
      readyState: 'done',
      source: store,
      transaction: store.transaction,
      onsuccess: null,
      onerror: null,
      addEventListener: (type: string, fn: (ev: Event) => void) => {
        if (type === 'success') queueMicrotask(() => fn(new Event('success')))
      },
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }
    queueMicrotask(() => {
      if (typeof fakeReq.onsuccess === 'function') {
        ;(fakeReq.onsuccess as (ev: Event) => void).call(fakeReq, new Event('success'))
      }
    })
    return fakeReq as unknown as IDBRequest
  }

  const origPut = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
    if (this.name === 'directory_handles') {
      const k = key ?? (value as { id?: IDBValidKey })?.id ?? handleId
      memHandles.set(k, value)
      return makeFakeReq(this, k)
    }
    return origPut.call(this, value, key)
  }

  const origGet = IDBObjectStore.prototype.get
  IDBObjectStore.prototype.get = function (key: IDBValidKey | IDBKeyRange) {
    if (this.name === 'directory_handles') {
      const hit = memHandles.get(key as IDBValidKey) ?? (key === tree.name ? record : undefined)
      if (hit) return makeFakeReq(this, hit)
    }
    return origGet.call(this, key)
  }

  const origGetAll = IDBObjectStore.prototype.getAll
  IDBObjectStore.prototype.getAll = function (...args: Parameters<IDBObjectStore['getAll']>) {
    if (this.name === 'directory_handles') {
      return makeFakeReq(this, Array.from(memHandles.values()))
    }
    return origGetAll.apply(this, args)
  }
}
