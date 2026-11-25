'use client'

import { type RefObject, useEffect, useRef, useSyncExternalStore } from 'react'

export const GIT_FIND_ATTR = 'data-git-find'
export const GIT_FIND_EVENT = 'git-panel-find'

function isApplePlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent)
}

/** Display the conventional shortcut while accepting both modifiers on every platform. */
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

export function isGitFindChord(event: Pick<KeyboardEvent, 'altKey' | 'shiftKey' | 'key' | 'metaKey' | 'ctrlKey'>) {
  return !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f' && (event.metaKey || event.ctrlKey)
}

export function useGitFindPanel(rootRef: RefObject<HTMLElement | null>, inputRef: RefObject<HTMLInputElement | null>, onOpen: () => void) {
  const openRef = useRef(onOpen)
  openRef.current = onOpen
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let frame = 0
    const open = () => {
      openRef.current()
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true })
        inputRef.current?.select()
      })
    }
    const onKey = (event: KeyboardEvent) => {
      if (!isGitFindChord(event)) return
      event.preventDefault()
      event.stopPropagation()
      open()
    }
    root.addEventListener(GIT_FIND_EVENT, open)
    root.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      root.removeEventListener(GIT_FIND_EVENT, open)
      root.removeEventListener('keydown', onKey)
    }
  }, [rootRef, inputRef])
}

/**
 * OS find chord opens find on the focused panel marked with `data-git-find`
 * (instead of the browser page search).
 */
export function useGitFindShortcut(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!isGitFindChord(event)) return
      const root = rootRef.current
      if (!root) return

      const active = document.activeElement
      if (active instanceof HTMLInputElement && active.closest('[data-git-search-dropdown]')) {
        event.preventDefault()
        event.stopPropagation()
        active.select()
        return
      }

      const openProjectMenu = document.querySelector<HTMLElement>(`[${GIT_FIND_ATTR}="project-menu"]`)
      let scope = active instanceof Element ? active.closest(`[${GIT_FIND_ATTR}]`) : null
      if (!scope) {
        const hovered = Array.from(document.querySelectorAll(`[${GIT_FIND_ATTR}]:hover`))
        scope = hovered.at(-1) || null
      }

      // When the project switcher menu is open and focus/hover is on the switcher or menu, target the menu search directly
      if (openProjectMenu && (!scope || scope.getAttribute(GIT_FIND_ATTR) === 'project-switcher' || openProjectMenu.contains(scope))) {
        scope = openProjectMenu
      }

      if (!scope) return
      if (!root.contains(scope) && scope.getAttribute(GIT_FIND_ATTR) !== 'project-switcher' && scope.getAttribute(GIT_FIND_ATTR) !== 'project-menu') {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      scope.dispatchEvent(new CustomEvent(GIT_FIND_EVENT, { bubbles: false }))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [rootRef])
}
