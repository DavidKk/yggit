/**
 * IndexedDB Directory Handles Persistence & Repo Alias Store
 * Implements persistent Web File System Access API handles for zero-prompt restoration.
 * Manages Edge mode folders, project handles, and remote repositories client-side.
 */

import { projectId } from '@/lib/git/identity'
import { getTemporaryRepos } from '@/lib/git/temporary-store'
import type { GitProjectCatalog, GitProjectHost, GitProjectView } from '@/lib/git/types'

declare global {
  interface Window {
    showDirectoryPicker?: (options?: unknown) => Promise<FileSystemDirectoryHandle>
  }
  interface FileSystemHandle {
    queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
    requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  }
}

export interface StoredRepoRecord {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  group?: string
  order?: number
  updatedAt: number
}

export interface StoredAliasRecord {
  alias: string
  canonicalId: string
  updatedAt: number
}

export interface StoredFolderRecord {
  name: string
  order: number
  updatedAt: number
}

export interface StoredRemoteProjectRecord {
  id: string
  name: string
  url: string
  host: GitProjectHost
  group?: string
  token?: string
  order?: number
  updatedAt: number
}

export interface StoredMetaRecord {
  key: string
  value: unknown
}

const DB_NAME = 'yggit_handles_store'
const DB_VERSION = 2
const HANDLES_STORE = 'directory_handles'
const ALIASES_STORE = 'repo_aliases'
const FOLDERS_STORE = 'edge_folders'
const REMOTE_PROJECTS_STORE = 'edge_remote_projects'
const META_STORE = 'edge_meta'

export const DEFAULT_EDGE_FOLDERS = ['工作项目', '个人项目']

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
        if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
          db.createObjectStore(FOLDERS_STORE, { keyPath: 'name' })
        }
        if (!db.objectStoreNames.contains(REMOTE_PROJECTS_STORE)) {
          db.createObjectStore(REMOTE_PROJECTS_STORE, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    } catch (err) {
      reject(err)
    }
  })
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve([])
        return
      }
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const req = store.getAll()
      req.onsuccess = () => resolve((req.result || []) as T[])
      req.onerror = () => reject(req.error)
    } catch (err) {
      reject(err)
    }
  })
}

function deleteFromStore(db: IDBDatabase, storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve()
        return
      }
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    } catch (err) {
      reject(err)
    }
  })
}

function putInStore<T>(db: IDBDatabase, storeName: string, item: T): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve()
        return
      }
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.put(item)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    } catch (err) {
      reject(err)
    }
  })
}

async function getMetaValue<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(META_STORE)) {
        resolve(null)
        return
      }
      const tx = db.transaction(META_STORE, 'readonly')
      const store = tx.objectStore(META_STORE)
      const req = store.get(key)
      req.onsuccess = () => {
        const res = req.result as { key: string; value: T } | undefined
        resolve(res ? res.value : null)
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function setMetaValue<T>(db: IDBDatabase, key: string, value: T): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(META_STORE)) {
        resolve()
        return
      }
      const tx = db.transaction(META_STORE, 'readwrite')
      const store = tx.objectStore(META_STORE)
      const req = store.put({ key, value })
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function seedDefaultFolders(db: IDBDatabase): Promise<string[]> {
  try {
    await setMetaValue(db, 'folders_initialized', true)
    for (let i = 0; i < DEFAULT_EDGE_FOLDERS.length; i++) {
      const name = DEFAULT_EDGE_FOLDERS[i]
      await putInStore(db, FOLDERS_STORE, { name, order: i, updatedAt: Date.now() })
    }
    return [...DEFAULT_EDGE_FOLDERS]
  } catch {
    return [...DEFAULT_EDGE_FOLDERS]
  }
}

/**
 * Get all configured folders in Edge mode
 */
export async function getEdgeFolders(): Promise<string[]> {
  const db = await openHandlesDatabase()
  if (!db) return []

  const isInitialized = await getMetaValue<boolean>(db, 'folders_initialized')

  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
        resolve([])
        return
      }
      const tx = db.transaction(FOLDERS_STORE, 'readonly')
      const store = tx.objectStore(FOLDERS_STORE)
      const request = store.getAll()
      request.onsuccess = async () => {
        const records = (request.result || []) as StoredFolderRecord[]

        if (!isInitialized && records.length === 0) {
          const seeded = await seedDefaultFolders(db)
          resolve(seeded)
          return
        }

        records.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        resolve(records.map((r) => r.name))
      }
      request.onerror = () => reject(request.error)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Create a new folder in Edge mode
 */
export async function createEdgeFolder(name: string): Promise<string[]> {
  const db = await openHandlesDatabase()
  if (!db) return []

  const folderName = name.trim().replace(/\s+/g, ' ')
  if (!folderName) throw new Error('填写文件夹名称')
  if (folderName.includes('/') || folderName.includes('\\')) {
    throw new Error('文件夹名称不能包含路径分隔符')
  }

  const currentFolders = await getEdgeFolders()
  if (currentFolders.includes(folderName)) {
    throw new Error('文件夹已存在')
  }

  await putInStore(db, FOLDERS_STORE, {
    name: folderName,
    order: currentFolders.length,
    updatedAt: Date.now(),
  })
  await setMetaValue(db, 'folders_initialized', true)

  return [...currentFolders, folderName]
}

/**
 * Delete a folder in Edge mode, along with any repositories inside it
 */
export async function deleteEdgeFolder(name: string): Promise<{ folders: string[]; removedCount: number }> {
  const db = await openHandlesDatabase()
  if (!db) return { folders: [], removedCount: 0 }

  const folderName = name.trim().replace(/\s+/g, ' ')
  if (!folderName) throw new Error('选择文件夹')

  // 1. Delete folder record
  await deleteFromStore(db, FOLDERS_STORE, folderName)

  let removedCount = 0

  // 2. Delete handles in this folder
  try {
    const handles = await getAllFromStore<StoredRepoRecord>(db, HANDLES_STORE)
    const toDelete = handles.filter((h) => h.group === folderName)
    for (const h of toDelete) {
      await deleteFromStore(db, HANDLES_STORE, h.id)
      removedCount++
    }
  } catch {
    // Ignore
  }

  // 3. Delete remote projects in this folder
  try {
    const remotes = await getAllFromStore<StoredRemoteProjectRecord>(db, REMOTE_PROJECTS_STORE)
    const toDeleteRemotes = remotes.filter((r) => r.group === folderName)
    for (const r of toDeleteRemotes) {
      await deleteFromStore(db, REMOTE_PROJECTS_STORE, r.id)
      removedCount++
    }
  } catch {
    // Ignore
  }

  const remainingFolders = await getEdgeFolders()
  return { folders: remainingFolders, removedCount }
}

/**
 * Move a project to a new group/folder in Edge mode
 */
export async function moveEdgeProject(id: string, group: string, _beforeId?: string): Promise<void> {
  const db = await openHandlesDatabase()
  if (!db) return

  const folder = group.trim().replace(/\s+/g, ' ')
  if (!folder) throw new Error('选择文件夹')

  const currentFolders = await getEdgeFolders()
  if (!currentFolders.includes(folder)) {
    await createEdgeFolder(folder)
  }

  // Check directory handles
  const handles = await getAllFromStore<StoredRepoRecord>(db, HANDLES_STORE)
  const handle = handles.find((h) => h.id === id)
  if (handle) {
    handle.group = folder
    handle.updatedAt = Date.now()
    await putInStore(db, HANDLES_STORE, handle)
    return
  }

  // Check remote projects
  const remotes = await getAllFromStore<StoredRemoteProjectRecord>(db, REMOTE_PROJECTS_STORE)
  const remote = remotes.find((r) => r.id === id)
  if (remote) {
    remote.group = folder
    remote.updatedAt = Date.now()
    await putInStore(db, REMOTE_PROJECTS_STORE, remote)
  }
}

/**
 * Remove a project from Edge mode storage
 */
export async function removeEdgeProject(id: string): Promise<void> {
  const db = await openHandlesDatabase()
  if (!db) return

  await deleteFromStore(db, HANDLES_STORE, id)
  await deleteFromStore(db, REMOTE_PROJECTS_STORE, id)
}

/**
 * Retrieve all Edge remote projects
 */
export async function getEdgeRemoteProjects(): Promise<StoredRemoteProjectRecord[]> {
  const db = await openHandlesDatabase()
  if (!db) return []
  const records = await getAllFromStore<StoredRemoteProjectRecord>(db, REMOTE_PROJECTS_STORE)
  records.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return records
}

/**
 * Save an Edge remote project record
 */
export async function saveEdgeRemoteProject(record: StoredRemoteProjectRecord): Promise<void> {
  const db = await openHandlesDatabase()
  if (!db) return
  await putInStore(db, REMOTE_PROJECTS_STORE, record)
}

/**
 * Build the full GitProjectCatalog from IndexedDB Edge storage
 */
export async function getEdgeCatalog(): Promise<GitProjectCatalog> {
  const folders = await getEdgeFolders()
  const handles = await listDirectoryHandles()
  const remotes = await getEdgeRemoteProjects()
  const tempRepos = getTemporaryRepos()

  const defaultFolder = folders[0] || ''

  const handleProjects: GitProjectView[] = handles.map((h) => ({
    id: h.id,
    name: h.name,
    group: h.group && folders.includes(h.group) ? h.group : defaultFolder,
    host: 'local',
    localPath: h.name,
    httpsUrl: '',
    local: true,
    remote: false,
    authorized: true,
  }))

  const remoteProjects: GitProjectView[] = remotes.map((r) => ({
    id: r.id,
    name: r.name,
    group: r.group && folders.includes(r.group) ? r.group : defaultFolder,
    host: r.host,
    localPath: '',
    httpsUrl: r.url,
    local: false,
    remote: true,
    authorized: Boolean(r.token) || r.host === 'github',
  }))

  const existingIds = new Set([...handleProjects.map((p) => p.id), ...remoteProjects.map((p) => p.id)])

  const tempProjects: GitProjectView[] = tempRepos
    .filter((r) => !existingIds.has(r.fingerprint) && !existingIds.has(r.remoteUrl))
    .map((r) => ({
      id: r.fingerprint,
      name: r.name,
      group: defaultFolder,
      host: (r.provider === 'gitlab' ? 'gitlab' : 'github') as GitProjectHost,
      localPath: '',
      httpsUrl: r.remoteUrl,
      local: false,
      remote: true,
      authorized: true,
    }))

  const allProjects = [...handleProjects, ...remoteProjects, ...tempProjects]

  if (folders.length > 0) {
    const folderRank = new Map(folders.map((name, index) => [name, index]))
    allProjects.sort((a, b) => (folderRank.get(a.group) ?? 999) - (folderRank.get(b.group) ?? 999))
  }

  return {
    projects: allProjects,
    folders,
  }
}

/**
 * Save or update a directory handle in IndexedDB
 */
export async function saveDirectoryHandle(repoId: string, handle: FileSystemDirectoryHandle, name?: string, group?: string): Promise<void> {
  const db = await openHandlesDatabase()
  if (!db) return

  const folders = await getEdgeFolders()
  const defaultGroup = folders[0] || '工作项目'

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(HANDLES_STORE, 'readwrite')
      const store = tx.objectStore(HANDLES_STORE)
      const getReq = store.get(repoId)
      getReq.onsuccess = () => {
        const existing = getReq.result as StoredRepoRecord | undefined
        const record: StoredRepoRecord = {
          id: repoId,
          name: name || handle.name || repoId,
          handle,
          group: group || existing?.group || defaultGroup,
          order: existing?.order ?? 0,
          updatedAt: Date.now(),
        }
        const putReq = store.put(record)
        putReq.onsuccess = () => resolve()
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
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
        if (record?.handle) {
          resolve(record.handle)
          return
        }

        // Fallback: search all records by name, folderName, or projectId
        const allReq = store.getAll()
        allReq.onsuccess = () => {
          const records = (allReq.result || []) as StoredRepoRecord[]
          const raw = repoId.trim()
          const basename = raw.split(/[/\\]/).filter(Boolean).pop() || raw
          const match = records.find((r) => {
            if (r.id.toLowerCase() === raw.toLowerCase()) return true
            if (r.name.toLowerCase() === raw.toLowerCase()) return true
            if (r.name.toLowerCase() === basename.toLowerCase()) return true
            if (`l_${projectId(r.name)}`.toLowerCase() === raw.toLowerCase()) return true
            if (`l_${projectId(r.id)}`.toLowerCase() === raw.toLowerCase()) return true
            return false
          })
          resolve(match?.handle || null)
        }
        allReq.onerror = () => resolve(null)
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
export async function listDirectoryHandles(): Promise<Array<{ id: string; name: string; group?: string; order?: number; updatedAt: number }>> {
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
            group: r.group,
            order: r.order,
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
export async function verifyHandlePermission(handle: FileSystemDirectoryHandle, mode: 'read' | 'readwrite' = 'read'): Promise<boolean> {
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
export async function requestHandlePermission(handle: FileSystemDirectoryHandle, mode: 'read' | 'readwrite' = 'read'): Promise<boolean> {
  if (typeof handle.requestPermission !== 'function') return true
  try {
    const status = await handle.requestPermission({ mode })
    return status === 'granted'
  } catch {
    return false
  }
}
