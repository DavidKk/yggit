'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { driverModeFromPathname, withDriverModePath } from '@/lib/git/route-mode'

import { EdgeGitDriver } from './edge-driver'
import { LocalGitDriver } from './local-driver'
import type { GitDriverMode, IGitDriver } from './types'

export * from './edge-driver'
export * from './local-driver'
export * from './types'

const DRIVER_MODE_EVENT = 'yggit:driver_mode_changed'

const localDriverSingleton = new LocalGitDriver()
const edgeDriverSingleton = new EdgeGitDriver()

// In-memory override used only in non-DOM/mocked-window test environments without `window.location`.
let nonBrowserDriverMode: GitDriverMode | null = null

export type DriverModeChangedDetail = {
  mode: GitDriverMode
  targetRepo?: string
  targetUrl?: string
}

function defaultDriverMode(): GitDriverMode {
  return 'edge'
}

/**
 * Resolve the active Git driver mode from the current URL pathname (`/local/...` -> `local`, else `edge`).
 */
export function getDriverMode(): GitDriverMode {
  if (typeof window !== 'undefined') {
    const pathname = window.location?.pathname
    if (typeof pathname === 'string' && pathname.length > 0) {
      return driverModeFromPathname(pathname)
    }
    if (nonBrowserDriverMode) return nonBrowserDriverMode
  }
  return defaultDriverMode()
}

/**
 * Notify listeners of a mode change. In browser runtime, callers navigate via `/local/...`
 * or Edge root URLs so the URL remains the single source of truth.
 */
export function setDriverMode(mode: GitDriverMode, extra?: { targetRepo?: string; targetUrl?: string }): void {
  if (typeof window === 'undefined') return
  if (!window.location?.pathname) {
    nonBrowserDriverMode = mode
  }
  try {
    window.dispatchEvent(new CustomEvent(DRIVER_MODE_EVENT, { detail: { mode, ...extra } }))
  } catch {
    // ignore
  }
}

/**
 * Retrieve the active IGitDriver instance for the specified or current mode.
 */
export function getGitDriver(mode?: GitDriverMode): IGitDriver {
  const activeMode = mode || getDriverMode()
  return activeMode === 'edge' ? edgeDriverSingleton : localDriverSingleton
}

/**
 * React hook to observe and toggle Git driver mode in UI.
 */
export function useGitDriver() {
  let pathname: string | null = null
  try {
    // Some Jest suites mock next/navigation without usePathname
    // eslint-disable-next-line react-hooks/rules-of-hooks
    pathname = typeof usePathname === 'function' ? usePathname() : null
  } catch {
    pathname = null
  }
  const routeMode: GitDriverMode | null = pathname ? driverModeFromPathname(pathname) : null
  const [mode, setModeState] = useState<GitDriverMode>(() => routeMode || getDriverMode())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setModeState(routeMode || getDriverMode())
  }, [routeMode])

  useEffect(() => {
    function syncFromUrlOrEvent(e?: Event) {
      const detail = (e as CustomEvent<GitDriverMode | DriverModeChangedDetail> | undefined)?.detail
      const nextMode = typeof detail === 'string' ? detail : detail?.mode
      if (nextMode === 'edge' || nextMode === 'local') {
        setModeState(nextMode)
        return
      }
      setModeState(getDriverMode())
    }
    window.addEventListener(DRIVER_MODE_EVENT, syncFromUrlOrEvent)
    window.addEventListener('popstate', syncFromUrlOrEvent)
    return () => {
      window.removeEventListener(DRIVER_MODE_EVENT, syncFromUrlOrEvent)
      window.removeEventListener('popstate', syncFromUrlOrEvent)
    }
  }, [])

  const setMode = useCallback((nextMode: GitDriverMode, extra?: { targetRepo?: string; targetUrl?: string }) => {
    setDriverMode(nextMode, extra)
    setModeState(nextMode)
  }, [])

  const activeMode = routeMode || mode
  const driver = useMemo(() => getGitDriver(activeMode), [activeMode])

  return {
    mode: activeMode,
    driver,
    setMode,
    isEdge: activeMode === 'edge',
    isLocal: activeMode === 'local',
    mounted,
  }
}

/**
 * Returns a helper that rewrites workspace hrefs to match the active URL mode (`/local/...` vs Edge).
 */
export function useModeHref(): (href: string) => string {
  const { mode } = useGitDriver()
  return useCallback((href: string) => withDriverModePath(href, mode), [mode])
}
