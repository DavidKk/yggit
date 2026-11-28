'use client'

import { useSyncExternalStore } from 'react'

let holdExploreLoading = false
let previewGapStrip = false
let holdGapLoading = false
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

export function getGitUiDebugPreviewGapStrip() {
  return previewGapStrip
}

export function setGitUiDebugPreviewGapStrip(next: boolean) {
  if (previewGapStrip === next) return
  previewGapStrip = next
  emit()
}

export function useGitUiDebugPreviewGapStrip() {
  return useSyncExternalStore(subscribe, getGitUiDebugPreviewGapStrip, getGitUiDebugPreviewGapStrip)
}

export function getGitUiDebugHoldGapLoading() {
  return holdGapLoading
}

export function setGitUiDebugHoldGapLoading(next: boolean) {
  if (holdGapLoading === next) return
  holdGapLoading = next
  emit()
}

export function useGitUiDebugHoldGapLoading() {
  return useSyncExternalStore(subscribe, getGitUiDebugHoldGapLoading, getGitUiDebugHoldGapLoading)
}
