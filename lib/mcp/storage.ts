import { MCP_DATABASE } from '@/lib/storage/databases'

import type { McpServerConfig } from './types'

let memoryMcpServers: McpServerConfig[] | null = null
type McpChangeListener = () => void
const listeners = new Set<McpChangeListener>()

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      // Ignore
    }
  }
}

function openMcpDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(MCP_DATABASE, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('servers')) {
          db.createObjectStore('servers', { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function listMcpServers(): Promise<McpServerConfig[]> {
  const db = await openMcpDb()
  if (!db) {
    return memoryMcpServers || []
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('servers', 'readonly')
      const store = tx.objectStore('servers')
      const req = store.getAll()
      req.onsuccess = () => {
        const servers = (req.result as McpServerConfig[]) || []
        memoryMcpServers = servers
        resolve(servers)
      }
      req.onerror = () => resolve(memoryMcpServers || [])
    } catch {
      resolve(memoryMcpServers || [])
    }
  })
}

export async function saveMcpServer(server: McpServerConfig): Promise<void> {
  const updated: McpServerConfig = {
    ...server,
    updatedAt: Date.now(),
  }

  const db = await openMcpDb()
  if (db) {
    try {
      const tx = db.transaction('servers', 'readwrite')
      tx.objectStore('servers').put(updated)
    } catch {
      // Fallback
    }
  }

  if (memoryMcpServers) {
    const idx = memoryMcpServers.findIndex((s) => s.id === updated.id)
    if (idx !== -1) {
      memoryMcpServers[idx] = updated
    } else {
      memoryMcpServers.push(updated)
    }
  } else {
    memoryMcpServers = [updated]
  }

  notifyListeners()
}

export async function deleteMcpServer(id: string): Promise<void> {
  const db = await openMcpDb()
  if (db) {
    try {
      const tx = db.transaction('servers', 'readwrite')
      tx.objectStore('servers').delete(id)
    } catch {
      // Fallback
    }
  }

  if (memoryMcpServers) {
    memoryMcpServers = memoryMcpServers.filter((s) => s.id !== id)
  }

  notifyListeners()
}

export async function toggleMcpServer(id: string, enabled: boolean): Promise<void> {
  const servers = await listMcpServers()
  const target = servers.find((s) => s.id === id)
  if (!target) return
  await saveMcpServer({ ...target, enabled })
}

export async function toggleMcpTool(serverId: string, toolName: string, enabled: boolean): Promise<void> {
  const servers = await listMcpServers()
  const target = servers.find((s) => s.id === serverId)
  if (!target || !target.tools) return

  const updatedTools = target.tools.map((t) => (t.name === toolName ? { ...t, enabled } : t))
  await saveMcpServer({ ...target, tools: updatedTools })
}

export function subscribeMcp(listener: McpChangeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
