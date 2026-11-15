'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { EdgeGitDriver } from './edge-driver'
import { LocalGitDriver } from './local-driver'
import type { GitDriverMode, IGitDriver } from './types'

export * from './edge-driver'
export * from './local-driver'
export * from './types'

const DRIVER_MODE_KEY = 'yggit.driver_mode'
const DRIVER_MODE_EVENT = 'yggit:driver_mode_changed'

const localDriverSingleton = new LocalGitDriver()
const edgeDriverSingleton = new EdgeGitDriver()

/**
 * Read the current driver preference from localStorage.
 * Defaults to 'local' when running on localhost / dev server, or 'edge' when in browser without Node API.
 */
export function getDriverMode(): GitDriverMode {
  const storage = typeof window !== 'undefined' ? window.localStorage : typeof localStorage !== 'undefined' ? localStorage : null
  if (!storage) return 'local'
  try {
    const saved = storage.getItem(DRIVER_MODE_KEY)
    if (saved === 'edge' || saved === 'local') return saved
  } catch {
    // ignore
  }
  return 'local'
}

/**
 * Set and persist the driver mode preference
 */
export function setDriverMode(mode: GitDriverMode): void {
  const storage = typeof window !== 'undefined' ? window.localStorage : typeof localStorage !== 'undefined' ? localStorage : null
  if (!storage) return
  try {
    storage.setItem(DRIVER_MODE_KEY, mode)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DRIVER_MODE_EVENT, { detail: mode }))
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieve the active IGitDriver instance for the specified or current mode
 */
export function getGitDriver(mode?: GitDriverMode): IGitDriver {
  const activeMode = mode || getDriverMode()
  return activeMode === 'edge' ? edgeDriverSingleton : localDriverSingleton
}

/**
 * React hook to observe and toggle Git driver mode in UI
 */
export function useGitDriver() {
  const [mode, setModeState] = useState<GitDriverMode>('local')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setModeState(getDriverMode())

    function onModeChanged(e: Event) {
      const customEvent = e as CustomEvent<GitDriverMode>
      if (customEvent.detail === 'edge' || customEvent.detail === 'local') {
        setModeState(customEvent.detail)
      }
    }
    window.addEventListener(DRIVER_MODE_EVENT, onModeChanged)
    return () => window.removeEventListener(DRIVER_MODE_EVENT, onModeChanged)
  }, [])

  const setMode = useCallback((nextMode: GitDriverMode) => {
    setDriverMode(nextMode)
    setModeState(nextMode)
  }, [])

  const driver = useMemo(() => getGitDriver(mode), [mode])

  return {
    mode,
    driver,
    setMode,
    isEdge: mode === 'edge',
    isLocal: mode === 'local',
    mounted,
  }
}
