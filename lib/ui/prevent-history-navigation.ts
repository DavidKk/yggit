'use client'

import { useEffect } from 'react'

/**
 * Prevents horizontal trackpad gestures (two-finger swipe left/right on macOS)
 * from triggering browser history back/forward navigation when reaching boundaries
 * or hovering over non-horizontally-scrollable surfaces.
 */
export function usePreventHistoryNavigation() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleWheel = (e: WheelEvent) => {
      // Only handle predominantly horizontal gestures
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return

      // Find if any element in the target chain can absorb horizontal scroll
      const path = (e.composedPath ? e.composedPath() : []) as HTMLElement[]
      let canScroll = false

      for (const el of path) {
        if (!el || el === document.documentElement || el === document.body) break
        if (!(el instanceof HTMLElement)) continue

        const style = window.getComputedStyle(el)
        const overflowX = style.overflowX
        if (overflowX === 'auto' || overflowX === 'scroll') {
          const maxScroll = el.scrollWidth - el.clientWidth
          if (maxScroll > 1) {
            // Check if scrolling left and element can still scroll left
            if (e.deltaX < 0 && el.scrollLeft > 1) {
              canScroll = true
              break
            }
            // Check if scrolling right and element can still scroll right
            if (e.deltaX > 0 && el.scrollLeft < maxScroll - 1) {
              canScroll = true
              break
            }
          }
        }
      }

      // If no container can scroll further horizontally in this direction, prevent default history navigation
      if (!canScroll) {
        e.preventDefault()
      }
    }

    // Must be non-passive to allow preventDefault()
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      window.removeEventListener('wheel', handleWheel)
    }
  }, [])
}
