'use client'

import { type RefObject, useEffect, useSyncExternalStore } from 'react'

export const GIT_FIND_ATTR = 'data-git-find'
export const GIT_FIND_EVENT = 'git-panel-find'

function isApplePlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent)
}

/** macOS → ⌘F；Windows / Linux → Ctrl+F */
export function gitFindShortcutLabel(apple = isApplePlatform()) {
  return apple ? '⌘F' : 'Ctrl+F'
}

export function useGitFindShortcutLabel() {
  return useSyncExternalStore(
    () => () => {},
    () => gitFindShortcutLabel(isApplePlatform()),
    () => 'Ctrl+F'
  )
}

function isFindChord(event: KeyboardEvent) {
  if (event.altKey || event.shiftKey) return false
  if (event.key.toLowerCase() !== 'f') return false
  // Match OS find shortcut: ⌘F on Apple, Ctrl+F elsewhere.
  if (isApplePlatform()) return event.metaKey && !event.ctrlKey
  return event.ctrlKey && !event.metaKey
}

/**
 * OS find chord opens find on the focused panel marked with `data-git-find`
 * (instead of the browser page search).
 */
export function useGitFindShortcut(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!isFindChord(event)) return
      const root = rootRef.current
      if (!root) return
      const active = document.activeElement
      const scope =
        (active instanceof Element ? active.closest(`[${GIT_FIND_ATTR}]`) : null) || (event.target instanceof Element ? event.target.closest(`[${GIT_FIND_ATTR}]`) : null)
      if (!scope || !root.contains(scope)) return
      event.preventDefault()
      event.stopPropagation()
      scope.dispatchEvent(new CustomEvent(GIT_FIND_EVENT, { bubbles: false }))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [rootRef])
}
