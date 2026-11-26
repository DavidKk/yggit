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

export type DriverModeChangedDetail = {
  mode: GitDriverMode
  targetRepo?: string
  targetUrl?: string
}

function defaultDriverMode(): GitDriverMode {
  return process.env.NEXT_PUBLIC_YGGIT_TARGET === 'cloud' ? 'edge' : 'local'
}

/**
 * Read the current driver preference from localStorage.
 * Defaults to 'local' when running on localhost / dev server, or 'edge' on cloud builds.
 */
export function getDriverMode(): GitDriverMode {
  const fallback = defaultDriverMode()
  const storage = typeof window !== 'undefined' ? window.localStorage : typeof localStorage !== 'undefined' ? localStorage : null
  if (!storage) return fallback
  try {
    const saved = storage.getItem(DRIVER_MODE_KEY)
    if (saved === 'edge' || saved === 'local') return saved
  } catch {
    // ignore
  }
  return fallback
}

/**
 * Set and persist the driver mode preference
 */
export function setDriverMode(mode: GitDriverMode, extra?: { targetRepo?: string; targetUrl?: string }): void {
  const storage = typeof window !== 'undefined' ? window.localStorage : typeof localStorage !== 'undefined' ? localStorage : null
  if (!storage) return
  try {
    storage.setItem(DRIVER_MODE_KEY, mode)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DRIVER_MODE_EVENT, { detail: { mode, ...extra } }))
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
  const [mode, setModeState] = useState<GitDriverMode>(defaultDriverMode)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setModeState(getDriverMode())

    function onModeChanged(e: Event) {
      const customEvent = e as CustomEvent<GitDriverMode | DriverModeChangedDetail>
      const detail = customEvent.detail
      const nextMode = typeof detail === 'string' ? detail : detail?.mode
      if (nextMode === 'edge' || nextMode === 'local') {
        setModeState(nextMode)
      }
    }
    window.addEventListener(DRIVER_MODE_EVENT, onModeChanged)
    return () => window.removeEventListener(DRIVER_MODE_EVENT, onModeChanged)
  }, [])

  const setMode = useCallback((nextMode: GitDriverMode, extra?: { targetRepo?: string; targetUrl?: string }) => {
    setDriverMode(nextMode, extra)
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
