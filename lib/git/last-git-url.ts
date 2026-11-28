'use client'

import { driverModeFromPathname, type RouteDriverMode, stripLocalPrefix, withDriverModePath } from '@/lib/git/route-mode'

const STORAGE_KEY_PREFIX = 'yggit.last-git-url.'

function currentMode(explicitMode?: RouteDriverMode): RouteDriverMode {
  if (explicitMode) return explicitMode
  if (typeof window === 'undefined') return 'edge'
  return driverModeFromPathname(window.location?.pathname)
}

/**
 * Persist the current Git workspace URL per driver mode so settings pages can return
 * directly back to the active Edge or Local Git session.
 */
export function saveLastGitUrl(url: string | null | undefined): void {
  if (typeof window === 'undefined' || !url) return
  try {
    const trimmed = url.trim()
    if (!stripLocalPrefix(trimmed).startsWith('/git')) return
    const mode = driverModeFromPathname(trimmed)
    const key = `${STORAGE_KEY_PREFIX}${mode}`
    window.sessionStorage.setItem(key, trimmed)
    window.localStorage.setItem(key, trimmed)
  } catch {
    // Ignore storage quota or disabled restrictions
  }
}

/**
 * Retrieve the last active Git workspace URL for the current (or specified) mode.
 */
export function getLastGitUrl(explicitMode?: RouteDriverMode): string {
  const mode = currentMode(explicitMode)
  const fallback = withDriverModePath('/git', mode)
  if (typeof window === 'undefined') return fallback
  try {
    const key = `${STORAGE_KEY_PREFIX}${mode}`
    const session = window.sessionStorage.getItem(key)
    if (session && stripLocalPrefix(session).startsWith('/git')) {
      return withDriverModePath(session, mode)
    }

    const local = window.localStorage.getItem(key)
    if (local && stripLocalPrefix(local).startsWith('/git')) {
      return withDriverModePath(local, mode)
    }

    if (document.referrer) {
      const ref = new URL(document.referrer, window.location.origin)
      if (ref.origin === window.location.origin && stripLocalPrefix(ref.pathname).startsWith('/git')) {
        return withDriverModePath(ref.pathname + ref.search, mode)
      }
    }
  } catch {
    // Ignore storage errors
  }
  return fallback
}
