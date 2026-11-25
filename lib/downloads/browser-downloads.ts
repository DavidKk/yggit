'use client'

import { useSyncExternalStore } from 'react'

export type BrowserDownloadStatus = 'running' | 'completed' | 'failed'
export type BrowserDownloadPhase = 'download' | 'prepare'

export interface BrowserDownloadItem {
  id: string
  kind: 'browser-ai' | 'browser-local'
  title: string
  subtitle: string
  status: BrowserDownloadStatus
  phase: BrowserDownloadPhase
  /** 0-100 during download; undefined during indeterminate prepare/unpacking phase */
  percent?: number
  detail?: string
  error?: string
  startedAt: number
}

const EMPTY: BrowserDownloadItem[] = []

let items: BrowserDownloadItem[] = EMPTY
const listeners = new Set<() => void>()
const openListeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function upsertBrowserDownload(item: BrowserDownloadItem): void {
  const index = items.findIndex((entry) => entry.id === item.id)
  if (index >= 0) {
    const next = [...items]
    next[index] = item
    items = next
  } else {
    items = [...items, item]
  }
  emit()
}

export function removeBrowserDownload(id: string): void {
  const next = items.filter((entry) => entry.id !== id)
  if (next.length !== items.length) {
    items = next
    emit()
  }
}

export function requestOpenDownloadCenter(): void {
  for (const listener of openListeners) listener()
}

export function onDownloadCenterOpenRequest(listener: () => void): () => void {
  openListeners.add(listener)
  return () => {
    openListeners.delete(listener)
  }
}

export function useBrowserDownloads(): BrowserDownloadItem[] {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY
  )
}
