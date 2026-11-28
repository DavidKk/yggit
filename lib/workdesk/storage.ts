/**
 * Dual-Mode Persistence & Dismissal Manager for Yggit Workdesk.
 * Local: data/git-workdesk/workdesk-store.json (via /api/git/workdesk)
 * Edge: IndexedDB (yggit_workdesk_store)
 */

import { getDriverMode } from '@/lib/git/driver'
import type { WorkdeskStoreData } from '@/lib/workdesk/types'

const INDEXEDDB_NAME = 'yggit_workdesk_store'
const STORE_NAME = 'snapshots'
const KEY_NAME = 'latest'
const LOCAL_STORAGE_FALLBACK_KEY = 'yggit.workdesk.store.v1'

// --- In-Memory Dismissal Tracker (Session-only with 10s undo window) ---

interface DismissedCardRecord {
  cardId: string
  dismissedAt: number
}

const dismissedCards = new Map<string, DismissedCardRecord>()

/**
 * Mark a card as dismissed in the current session.
 */
export function dismissCard(cardId: string): void {
  dismissedCards.set(cardId, {
    cardId,
    dismissedAt: Date.now(),
  })
}

/**
 * Undo dismissal if requested within the active session window.
 */
export function undoDismissCard(cardId: string): boolean {
  if (dismissedCards.has(cardId)) {
    dismissedCards.delete(cardId)
    return true
  }
  return false
}

/**
 * Check if a card is currently dismissed in memory.
 */
export function isCardDismissed(cardId: string): boolean {
  return dismissedCards.has(cardId)
}

/**
 * Get all currently dismissed card IDs.
 */
export function getDismissedCardIds(): Set<string> {
  return new Set(dismissedCards.keys())
}

/**
 * Clear all in-memory dismissals.
 */
export function clearDismissedCards(): void {
  dismissedCards.clear()
}

// --- IndexedDB Helper (Edge Mode) ---

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const request = window.indexedDB.open(INDEXEDDB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openIndexedDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => resolve((req.result as T) || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openIndexedDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // ignore
  }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openIndexedDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    })
  } catch {
    // ignore
  }
}

// --- Unified Workdesk Storage API ---

/**
 * Save snapshot of Findings, Cards, and Items.
 */
export async function saveWorkdeskStore(data: WorkdeskStoreData): Promise<void> {
  const mode = getDriverMode()

  if (mode === 'local' && typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/git/workdesk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) return
    } catch {
      // Fallback to IndexedDB / localStorage on API failure
    }
  }

  // Edge mode or API fallback
  try {
    await idbSet(KEY_NAME, data)
  } catch {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(data))
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Load the latest Workdesk snapshot.
 */
export async function loadWorkdeskStore(repo?: string): Promise<WorkdeskStoreData | null> {
  const mode = getDriverMode()

  if (mode === 'local' && typeof window !== 'undefined') {
    try {
      const endpoint = repo ? `/api/git/workdesk?repo=${encodeURIComponent(repo)}` : '/api/git/workdesk'
      const res = await fetch(endpoint)
      if (res.ok) {
        const json = await res.json()
        const store = json?.data || json
        if (store && typeof store === 'object' && Array.isArray(store.cards)) {
          return store as WorkdeskStoreData
        }
      }
    } catch {
      // Fallback
    }
  }

  // Edge mode or fallback
  const idbData = await idbGet<WorkdeskStoreData>(KEY_NAME)
  if (idbData && Array.isArray(idbData.cards)) {
    return idbData
  }

  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY)
      if (raw) {
        return JSON.parse(raw) as WorkdeskStoreData
      }
    }
  } catch {
    // ignore
  }

  return null
}

/**
 * Clear Workdesk store.
 */
export async function clearWorkdeskStore(): Promise<void> {
  const mode = getDriverMode()
  if (mode === 'local' && typeof window !== 'undefined') {
    try {
      await fetch('/api/git/workdesk', { method: 'DELETE' })
    } catch {
      // ignore
    }
  }
  await idbClear()
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY)
    }
  } catch {
    // ignore
  }
}
