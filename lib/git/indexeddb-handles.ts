/**
 * IndexedDB Directory Handles Persistence & Repo Alias Store
 * Implements persistent Web File System Access API handles for zero-prompt restoration.
 * Manages Edge mode folders, project handles, and remote repositories client-side.
 */

import { normalizeRemote, projectId } from '@/lib/git/identity'
import { consolidateProjects, isPrivateRemote, remoteIdentity } from '@/lib/git/project-access'
import type { GitProjectCatalog, GitProjectHost, GitProjectView } from '@/lib/git/types'
import { HANDLES_DATABASE } from '@/lib/storage/databases'

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
  label?: string
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
  label?: string
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

const DB_NAME = HANDLES_DATABASE
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

      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close()
        resolve(request.result)
      }
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
export async function moveEdgeProject(id: string, group: string, beforeId?: string): Promise<void> {
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
  }

  // Check remote projects
  const remotes = await getAllFromStore<StoredRemoteProjectRecord>(db, REMOTE_PROJECTS_STORE)
  const remote = remotes.find((r) => r.id === id)
  if (remote) {
    remote.group = folder
    remote.updatedAt = Date.now()
    await putInStore(db, REMOTE_PROJECTS_STORE, remote)
  }

  // Persist project order in META_STORE
  const existingOrder = (await getMetaValue<string[]>(db, 'project_order')) || []
  const filteredOrder = existingOrder.filter((item) => item !== id)

  if (beforeId && beforeId !== id) {
    const beforeIndex = filteredOrder.indexOf(beforeId)
    if (beforeIndex >= 0) {
      filteredOrder.splice(beforeIndex, 0, id)
    } else {
      filteredOrder.push(id)
    }
  } else {
    filteredOrder.push(id)
  }

  await setMetaValue(db, 'project_order', filteredOrder)
}

export async function renameEdgeFolder(oldName: string, newName: string): Promise<void> {
  const db = await openHandlesDatabase()
  if (!db) return
  const from = oldName.trim().replace(/\s+/g, ' ')
  const to = newName.trim().replace(/\s+/g, ' ')
  if (!from || !to) throw new Error('文件夹名称不能为空')
  if (from === to) return

  const handles = await getAllFromStore<StoredRepoRecord>(db, HANDLES_STORE)
  for (const h of handles) {
    if (h.group === from) {
      h.group = to
      await putInStore(db, HANDLES_STORE, h)
    }
  }

  const remotes = await getAllFromStore<StoredRemoteProjectRecord>(db, REMOTE_PROJECTS_STORE)
  for (const r of remotes) {
    if (r.group === from) {
      r.group = to
      await putInStore(db, REMOTE_PROJECTS_STORE, r)
    }
  }

  await deleteFromStore(db, FOLDERS_STORE, from)
  await putInStore(db, FOLDERS_STORE, { name: to, updatedAt: Date.now() })
}

export async function clearEdgeFolder(name: string): Promise<void> {
  const db = await openHandlesDatabase()
  if (!db) return
  const folder = name.trim().replace(/\s+/g, ' ')
  const ungrouped = '未分类'
  const handles = await getAllFromStore<StoredRepoRecord>(db, HANDLES_STORE)
  for (const h of handles) {
    if (h.group === folder) {
      h.group = ungrouped
      await putInStore(db, HANDLES_STORE, h)
    }
  }
  const remotes = await getAllFromStore<StoredRemoteProjectRecord>(db, REMOTE_PROJECTS_STORE)
  for (const r of remotes) {
    if (r.group === folder) {
      r.group = ungrouped
      await putInStore(db, REMOTE_PROJECTS_STORE, r)
    }
  }
  const currentFolders = await getEdgeFolders()
  if (!currentFolders.includes(ungrouped)) {
    await createEdgeFolder(ungrouped)
  }
}

export async function setEdgeProjectLabel(id: string, label: string): Promise<void> {
  const db = await openHandlesDatabase()
  if (!db) return
  const handles = await getAllFromStore<StoredRepoRecord>(db, HANDLES_STORE)
  const handle = handles.find((h) => h.id === id)
  if (handle) {
    handle.label = label.trim() || undefined
    handle.updatedAt = Date.now()
    await putInStore(db, HANDLES_STORE, handle)
    return
  }
  const remotes = await getAllFromStore<StoredRemoteProjectRecord>(db, REMOTE_PROJECTS_STORE)
  const remote = remotes.find((r) => r.id === id)
  if (remote) {
    remote.label = label.trim() || undefined
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
  const folders = await getEdgeFolders()
  if (folders.length === 0) {
    await createEdgeFolder('未分类')
    record.group = '未分类'
  } else if (!record.group || !folders.includes(record.group)) {
    record.group = folders[0] || '未分类'
  }
  await putInStore(db, REMOTE_PROJECTS_STORE, record)
}

/** Commit a fully enumerated import and its folder assignments atomically. */
export async function importEdgeRemoteProjects(records: StoredRemoteProjectRecord[], group: string, localIds: string[]): Promise<void> {
  const db = await openHandlesDatabase()
  if (!db) throw new Error('REMOTE_GROUP_STORAGE_UNAVAILABLE')
  const folder = group.trim().replace(/\s+/g, ' ')
  if (!folder || /[/\\]/.test(folder)) throw new Error('REMOTE_GROUP_INVALID_FOLDER')
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([FOLDERS_STORE, REMOTE_PROJECTS_STORE, HANDLES_STORE, META_STORE], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error || new Error('REMOTE_GROUP_STORAGE_FAILED'))
    tx.onerror = () => reject(tx.error || new Error('REMOTE_GROUP_STORAGE_FAILED'))
    const folders = tx.objectStore(FOLDERS_STORE)
    const request = folders.getAll()
    request.onsuccess = () => {
      if (!(request.result as StoredFolderRecord[]).some((item) => item.name === folder)) {
        folders.put({ name: folder, order: request.result.length, updatedAt: Date.now() })
      }
    }
    tx.objectStore(META_STORE).put({ key: 'folders_initialized', value: true })
    for (const record of records) tx.objectStore(REMOTE_PROJECTS_STORE).put({ ...record, group: folder })
    const handles = tx.objectStore(HANDLES_STORE)
    for (const id of localIds) {
      const request = handles.get(id)
      request.onsuccess = () => {
        if (request.result) handles.put({ ...request.result, group: folder, updatedAt: Date.now() })
      }
    }
  })
}

/**
 * Build the full GitProjectCatalog from IndexedDB Edge storage
 */
export async function getEdgeCatalog(): Promise<GitProjectCatalog> {
  const folders = await getEdgeFolders()
  const records = await listStoredDirectoryHandles()
  const handles: StoredRepoRecord[] = []
  for (const record of records) {
    if (!(await findMatchingHandle(handles, record.handle))) handles.push(record)
  }
  const remoteRecords = await getEdgeRemoteProjects()
  const seenRemotes = new Set<string>()
  const remotes = remoteRecords.filter((record) => {
    const key = remoteIdentity(record.url) || record.id
    if (seenRemotes.has(key)) return false
    seenRemotes.add(key)
    return true
  })

  const defaultFolder = folders[0] || ''

  const handleProjects: GitProjectView[] = await Promise.all(
    handles.map(async (h) => {
      const authorized = await verifyHandlePermission(h.handle)
      let remote = null
      let remotesList: Array<{ name: string; url: string; isPrivate: boolean }> = []
      if (authorized) {
        try {
          const { readGitRemotesFromHandle } = await import('./driver/edge-git-config')
          const gitRemotes = await readGitRemotesFromHandle(h.handle)
          remotesList = gitRemotes.map((r) => ({
            name: r.remote,
            url: r.url,
            isPrivate: isPrivateRemote(r.url),
          }))
          remote = normalizeRemote((gitRemotes.find((item) => item.remote === 'origin') || gitRemotes[0])?.url || '')
        } catch {
          // An unavailable directory must remain visible so permission can be restored.
        }
      }
      return {
        id: h.id,
        name: h.name,
        label: h.label,
        group: h.group && folders.includes(h.group) ? h.group : defaultFolder,
        host: remote?.kind || 'local',
        localPath: h.id,
        httpsUrl: remote?.httpsUrl || '',
        local: true,
        remote: Boolean(remote) || remotesList.length > 0,
        authorized,
        remotes: remotesList.length > 0 ? remotesList : undefined,
      }
    })
  )

  const remoteProjects: GitProjectView[] = remotes.map((r) => ({
    id: r.id,
    name: r.name,
    label: r.label,
    group: r.group && folders.includes(r.group) ? r.group : defaultFolder,
    host: r.host,
    localPath: '',
    httpsUrl: r.url,
    local: false,
    remote: true,
    authorized: Boolean(r.token),
    remotes: [{ name: 'origin', url: r.url, isPrivate: isPrivateRemote(r.url, Boolean(r.token)) }],
  }))

  const allProjects = consolidateProjects([...handleProjects, ...remoteProjects])

  const db = await openHandlesDatabase()
  let orderMap: Map<string, number> | null = null
  if (db) {
    const orderList = await getMetaValue<string[]>(db, 'project_order')
    if (orderList) {
      orderMap = new Map(orderList.map((id, index) => [id, index]))
    }
  }

  if (folders.length > 0) {
    const folderRank = new Map(folders.map((name, index) => [name, index]))
    allProjects.sort((a, b) => {
      const groupDiff = (folderRank.get(a.group) ?? 999) - (folderRank.get(b.group) ?? 999)
      if (groupDiff !== 0) return groupDiff
      const aOrder = orderMap?.get(a.id) ?? 9999
      const bOrder = orderMap?.get(b.id) ?? 9999
      return aOrder - bOrder
    })
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
  let targetGroup = group
  if (folders.length === 0) {
    targetGroup = '未分类'
    await createEdgeFolder('未分类')
  } else if (!targetGroup || !folders.includes(targetGroup)) {
    targetGroup = folders[0] || '未分类'
  }

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
          group: targetGroup || existing?.group || '未分类',
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
          const rawRemoteKey = remoteIdentity(raw)
          const match = records.find((r) => {
            if (r.id.toLowerCase() === raw.toLowerCase()) return true
            if (r.name.toLowerCase() === raw.toLowerCase()) return true
            if (`l_${projectId(r.name)}`.toLowerCase() === raw.toLowerCase()) return true
            if (`l_${projectId(r.id)}`.toLowerCase() === raw.toLowerCase()) return true
            if (rawRemoteKey && r.id && remoteIdentity(r.id) === rawRemoteKey) return true
            if (r.name.toLowerCase() === basename.toLowerCase()) return true
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

/** Compare directory entries rather than folder names; permissions may have expired. */
async function findMatchingHandle(records: StoredRepoRecord[], handle: FileSystemDirectoryHandle): Promise<StoredRepoRecord | undefined> {
  for (const record of records) {
    try {
      if (record.handle === handle || (typeof handle.isSameEntry === 'function' && (await handle.isSameEntry(record.handle)))) return record
    } catch {
      // Keep sources separate if the browser cannot establish identity.
    }
  }
  return undefined
}

async function listStoredDirectoryHandles(): Promise<StoredRepoRecord[]> {
  const db = await openHandlesDatabase()
  return db ? getAllFromStore<StoredRepoRecord>(db, HANDLES_STORE) : []
}

/** Reuse the stored identity for a folder; allow different folders with the same name. */
export async function findDirectoryHandleId(handle: FileSystemDirectoryHandle): Promise<string | undefined> {
  return (await findMatchingHandle(await listStoredDirectoryHandles(), handle))?.id
}

/** List saved directory metadata without exposing browser handles to consumers. */
export async function listDirectoryHandles(): Promise<Array<{ id: string; name: string; group?: string; order?: number; updatedAt: number }>> {
  return (await listStoredDirectoryHandles()).map(({ id, name, group, order, updatedAt }) => ({ id, name, group, order, updatedAt }))
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
