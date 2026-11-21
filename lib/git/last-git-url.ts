'use client'

const STORAGE_KEY = 'yggit.last-git-url'

/**
 * Persist the current Git workspace URL (including query string or slug path)
 * so settings pages can exit directly back to the active Git session.
 */
export function saveLastGitUrl(url: string | null | undefined): void {
  if (typeof window === 'undefined' || !url) return
  try {
    const trimmed = url.trim()
    if (!trimmed.startsWith('/git')) return
    window.sessionStorage.setItem(STORAGE_KEY, trimmed)
    window.localStorage.setItem(STORAGE_KEY, trimmed)
  } catch {
    // Ignore storage quota or disabled restrictions
  }
}

/**
 * Retrieve the last active Git workspace URL, falling back to /git.
 */
export function getLastGitUrl(): string {
  if (typeof window === 'undefined') return '/git'
  try {
    const session = window.sessionStorage.getItem(STORAGE_KEY)
    if (session && session.startsWith('/git')) return session

    const local = window.localStorage.getItem(STORAGE_KEY)
    if (local && local.startsWith('/git')) return local

    if (document.referrer) {
      const ref = new URL(document.referrer, window.location.origin)
      if (ref.origin === window.location.origin && ref.pathname.startsWith('/git')) {
        return ref.pathname + ref.search
      }
    }
  } catch {
    // Ignore storage errors
  }
  return '/git'
}
