'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

import type { SpotlightTarget } from '@/services/git/agent-impact'

export interface AgentCodeAnnotation {
  file: string
  startLine: number
  endLine?: number
  side?: 'old' | 'new' | 'both'
  commitHash?: string
  title?: string
  message: string
  severity?: 'info' | 'warn' | 'error' | 'agent'
  author?: string
}

export interface SpotlightContextValue {
  active: boolean
  targets: SpotlightTarget[]
  targetsMap: Map<string, SpotlightTarget>
  currentIndex: number
  currentTarget: SpotlightTarget | null
  focusedHash: string | null
  codeAnnotation: AgentCodeAnnotation | null
  setSpotlightTargets: (targets: SpotlightTarget[]) => void
  clearSpotlight: () => void
  nextTarget: () => void
  prevTarget: () => void
  focusTarget: (hash: string) => void
  setFocusedHash: (hash: string | null) => void
  setCodeAnnotation: (annotation: AgentCodeAnnotation | null) => void
  clearCodeAnnotation: () => void
  registerNavigateHandler: (handler: (hash: string) => void) => () => void
}

export const SpotlightContext = createContext<SpotlightContextValue | null>(null)

export function SpotlightProvider({ children, onNavigateCommit }: { children: React.ReactNode; onNavigateCommit?: (hash: string) => void }) {
  const [targets, setTargets] = useState<SpotlightTarget[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [focusedHash, setFocusedHash] = useState<string | null>(null)
  const [codeAnnotation, setCodeAnnotation] = useState<AgentCodeAnnotation | null>(null)
  const clearCodeAnnotation = useCallback(() => setCodeAnnotation(null), [])

  const navigateCallbackRef = React.useRef<((hash: string) => void) | undefined>(onNavigateCommit)
  React.useEffect(() => {
    if (onNavigateCommit) {
      navigateCallbackRef.current = onNavigateCommit
    }
  }, [onNavigateCommit])

  const registerNavigateHandler = useCallback((handler: (hash: string) => void) => {
    navigateCallbackRef.current = handler
    return () => {
      if (navigateCallbackRef.current === handler) {
        navigateCallbackRef.current = undefined
      }
    }
  }, [])

  const notifyNavigate = useCallback((hash: string) => {
    if (navigateCallbackRef.current) {
      navigateCallbackRef.current(hash)
    }
  }, [])

  const active = targets.length > 0

  const targetsMap = useMemo(() => {
    const map = new Map<string, SpotlightTarget>()
    for (const t of targets) {
      map.set(t.hash.toLowerCase(), t)
      if (t.shortHash) {
        map.set(t.shortHash.toLowerCase(), t)
      }
    }
    return map
  }, [targets])

  const currentTarget = useMemo(() => {
    if (targets.length === 0) return null
    return targets[currentIndex] || targets[0] || null
  }, [targets, currentIndex])

  const setSpotlightTargets = useCallback(
    (newTargets: SpotlightTarget[]) => {
      setTargets(newTargets)
      setCurrentIndex(0)
      if (newTargets.length > 0) {
        setFocusedHash(newTargets[0].hash)
        notifyNavigate(newTargets[0].hash)
      } else {
        setFocusedHash(null)
      }
    },
    [notifyNavigate]
  )

  const clearSpotlight = useCallback(() => {
    setTargets([])
    setCurrentIndex(0)
    setFocusedHash(null)
  }, [])

  const focusTarget = useCallback(
    (hash: string) => {
      const idx = targets.findIndex((t) => t.hash.toLowerCase() === hash.toLowerCase() || t.shortHash.toLowerCase() === hash.toLowerCase())
      if (idx >= 0) {
        setCurrentIndex(idx)
        setFocusedHash(targets[idx].hash)
        notifyNavigate(targets[idx].hash)
      } else {
        notifyNavigate(hash)
      }
    },
    [targets, notifyNavigate]
  )

  const nextTarget = useCallback(() => {
    if (targets.length === 0) return
    const nextIdx = (currentIndex + 1) % targets.length
    setCurrentIndex(nextIdx)
    const target = targets[nextIdx]
    setFocusedHash(target.hash)
    notifyNavigate(target.hash)
  }, [targets, currentIndex, notifyNavigate])

  const prevTarget = useCallback(() => {
    if (targets.length === 0) return
    const prevIdx = (currentIndex - 1 + targets.length) % targets.length
    setCurrentIndex(prevIdx)
    const target = targets[prevIdx]
    setFocusedHash(target.hash)
    notifyNavigate(target.hash)
  }, [targets, currentIndex, notifyNavigate])

  const value = useMemo(
    () => ({
      active,
      targets,
      targetsMap,
      currentIndex,
      currentTarget,
      focusedHash,
      codeAnnotation,
      setSpotlightTargets,
      clearSpotlight,
      nextTarget,
      prevTarget,
      focusTarget,
      setFocusedHash,
      setCodeAnnotation,
      clearCodeAnnotation,
      registerNavigateHandler,
    }),
    [
      active,
      targets,
      targetsMap,
      currentIndex,
      currentTarget,
      focusedHash,
      codeAnnotation,
      setSpotlightTargets,
      clearSpotlight,
      nextTarget,
      prevTarget,
      focusTarget,
      registerNavigateHandler,
      clearCodeAnnotation,
    ]
  )

  return <SpotlightContext.Provider value={value}>{children}</SpotlightContext.Provider>
}

export function useSpotlight(): SpotlightContextValue {
  const ctx = useContext(SpotlightContext)
  if (!ctx) {
    throw new Error('useSpotlight must be used within SpotlightProvider')
  }
  return ctx
}

export function useOptionalSpotlight(): SpotlightContextValue | null {
  return useContext(SpotlightContext)
}
