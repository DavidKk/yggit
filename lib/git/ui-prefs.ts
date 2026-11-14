'use client'

import { type Dispatch, type SetStateAction, useCallback, useRef, useSyncExternalStore } from 'react'

const PREFIX = 'yggit.git.ui.v1:'
const listeners = new Map<string, Set<() => void>>()

/** Cached parsed snapshots so useSyncExternalStore getSnapshot stays referentially stable. */
const cache = new Map<string, { raw: string | null; value: unknown }>()

function readRawString(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

function readCached(key: string): unknown {
  const raw = readRawString(key)
  const hit = cache.get(key)
  if (hit && hit.raw === raw) return hit.value
  let value: unknown = undefined
  if (raw != null) {
    try {
      value = JSON.parse(raw) as unknown
    } catch {
      value = undefined
    }
  }
  cache.set(key, { raw, value })
  return value
}

function writeRaw(key: string, value: unknown) {
  try {
    if (typeof window === 'undefined') return
    if (value === undefined) {
      window.localStorage.removeItem(PREFIX + key)
      cache.set(key, { raw: null, value: undefined })
    } else {
      const raw = JSON.stringify(value)
      window.localStorage.setItem(PREFIX + key, raw)
      cache.set(key, { raw, value })
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function subscribeKey(key: string, onStoreChange: () => void) {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(onStoreChange)
  const onStorage = (event: StorageEvent) => {
    if (event.key === PREFIX + key || event.key === null) {
      cache.delete(key)
      onStoreChange()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    set!.delete(onStoreChange)
    window.removeEventListener('storage', onStorage)
  }
}

function emit(key: string) {
  const set = listeners.get(key)
  if (!set) return
  for (const listener of set) listener()
}

/** Sync read for one-shot restores (e.g. switching repo). */
export function readGitUiPref<T>(key: string, valid: (value: unknown) => value is T): T | undefined {
  const saved = readCached(key)
  return valid(saved) ? saved : undefined
}

export function writeGitUiPref(key: string, value: unknown) {
  writeRaw(key, value)
  emit(key)
}

/**
 * Client-ready flag: false on SSR / before hydrate, true on client.
 * Use to avoid painting localStorage-backed expand state as the default collapsed shell.
 */
export function useGitUiReady(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

/**
 * Persist UI prefs in localStorage. Client snapshot reads storage immediately;
 * server snapshot uses the fallback captured for the current key (stable reference).
 */
export function useGitUiPref<T>(key: string, initial: T, valid: (value: unknown) => value is T): [T, Dispatch<SetStateAction<T>>] {
  const validRef = useRef(valid)
  validRef.current = valid

  const fallbackRef = useRef({ key, value: initial })
  if (fallbackRef.current.key !== key) {
    fallbackRef.current = { key, value: initial }
  }

  const value = useSyncExternalStore(
    (onChange) => subscribeKey(key, onChange),
    () => {
      const saved = readCached(key)
      return validRef.current(saved) ? (saved as T) : fallbackRef.current.value
    },
    () => fallbackRef.current.value
  )

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      const saved = readCached(key)
      const prev = validRef.current(saved) ? (saved as T) : fallbackRef.current.value
      const next = typeof action === 'function' ? (action as (prev: T) => T)(prev) : action
      writeRaw(key, next)
      emit(key)
    },
    [key]
  )

  return [value, setValue]
}

export function repoPrefKey(repo: string, leaf: string): string {
  return `repo:${encodeURIComponent(repo)}:${leaf}`
}

export function isRecordBoolean(value: unknown): value is Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every((item) => typeof item === 'boolean')
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
