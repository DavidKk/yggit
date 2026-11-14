'use client'

import { useSyncExternalStore } from 'react'

let holdExploreLoading = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getGitUiDebugHoldExploreLoading() {
  return holdExploreLoading
}

export function setGitUiDebugHoldExploreLoading(next: boolean) {
  if (holdExploreLoading === next) return
  holdExploreLoading = next
  emit()
}

export function useGitUiDebugHoldExploreLoading() {
  return useSyncExternalStore(subscribe, getGitUiDebugHoldExploreLoading, getGitUiDebugHoldExploreLoading)
}
