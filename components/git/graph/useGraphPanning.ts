'use client'

import { type MutableRefObject, type RefObject, useEffect } from 'react'

export function useGraphPanning({
  frameRef,
  graphScrollRef,
  branchRef,
  graphRef,
  contentWidth,
  syncGraphEdge,
}: {
  frameRef: RefObject<HTMLDivElement | null>
  graphScrollRef: RefObject<HTMLDivElement | null>
  branchRef: MutableRefObject<number>
  graphRef: MutableRefObject<number>
  contentWidth: number
  syncGraphEdge: () => void
}) {
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const handleWheel = (e: WheelEvent) => {
      const hasHorizontalDelta = Math.abs(e.deltaX) > 0
      const isShiftWheel = e.shiftKey && Math.abs(e.deltaY) > 0
      const isAltWheel = e.altKey && Math.abs(e.deltaY) > 0

      // Let standard vertical scroll pass through immediately without any DOM layout queries
      if (!hasHorizontalDelta && !isShiftWheel && !isAltWheel) {
        return
      }

      const pan = graphScrollRef.current || frame.querySelector<HTMLElement>('[data-git-graph-pan]')
      if (!pan) return
      const maxScroll = Math.max(0, pan.scrollWidth - pan.clientWidth)
      if (maxScroll <= 0) return

      const rect = frame.getBoundingClientRect()
      const isOverGraph = e.clientX >= rect.left + branchRef.current && e.clientX <= rect.left + branchRef.current + graphRef.current
      if (!isOverGraph) return

      // Ignore accidental trackpad horizontal jitter while scrolling vertically through commits
      if (hasHorizontalDelta && !isShiftWheel && !isAltWheel && Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) {
        return
      }

      const delta = hasHorizontalDelta ? e.deltaX : e.deltaY
      const prev = pan.scrollLeft
      const nextScrollLeft = Math.max(0, Math.min(maxScroll, pan.scrollLeft + delta))
      if (nextScrollLeft !== prev) {
        e.preventDefault()
        for (const el of frame.querySelectorAll<HTMLElement>('[data-git-graph-pan]')) {
          el.scrollLeft = nextScrollLeft
        }
        syncGraphEdge()
      }
    }

    let dragStartX = 0
    let dragStartScroll = 0
    let isDragging = false
    let pointerCaptured = false
    let cleanupDrag: (() => void) | undefined
    let cleanupClick: (() => void) | undefined

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return
      const pan = graphScrollRef.current || frame.querySelector<HTMLElement>('[data-git-graph-pan]')
      if (!pan) return
      const maxScroll = Math.max(0, pan.scrollWidth - pan.clientWidth)
      if (maxScroll <= 0) return

      const rect = frame.getBoundingClientRect()
      const isOverGraph = e.clientX >= rect.left + branchRef.current && e.clientX <= rect.left + branchRef.current + graphRef.current
      if (!isOverGraph) return

      const target = e.target as HTMLElement | null
      if (target?.closest('button') || target?.closest('[role="button"]') || target?.closest('a') || target?.closest('[data-split-handle]')) {
        return
      }

      cleanupDrag?.()
      cleanupClick?.()
      dragStartX = e.clientX
      dragStartScroll = pan.scrollLeft
      isDragging = false
      pointerCaptured = true

      const handlePointerMove = (moveEvt: PointerEvent) => {
        if (!pointerCaptured) return
        const dx = moveEvt.clientX - dragStartX
        if (!isDragging && Math.abs(dx) > 3) {
          isDragging = true
          frame.style.userSelect = 'none'
          frame.style.cursor = 'grabbing'
        }
        if (isDragging) {
          const nextScrollLeft = Math.max(0, Math.min(maxScroll, dragStartScroll - dx))
          for (const el of frame.querySelectorAll<HTMLElement>('[data-git-graph-pan]')) {
            el.scrollLeft = nextScrollLeft
          }
          syncGraphEdge()
        }
      }

      const handlePointerUp = (upEvt: PointerEvent) => {
        const suppressClick = isDragging && upEvt.type === 'pointerup'
        cleanupDrag?.()
        if (suppressClick) {
          upEvt.stopPropagation()
          const captureClick = (clickEvt: MouseEvent) => {
            clickEvt.stopPropagation()
            clickEvt.preventDefault()
            cleanupClick?.()
          }
          const timer = window.setTimeout(() => cleanupClick?.(), 0)
          cleanupClick = () => {
            window.clearTimeout(timer)
            window.removeEventListener('click', captureClick, true)
            cleanupClick = undefined
          }
          window.addEventListener('click', captureClick, true)
        }
      }

      cleanupDrag = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        window.removeEventListener('pointercancel', handlePointerUp)
        frame.style.userSelect = ''
        frame.style.cursor = ''
        pointerCaptured = false
        isDragging = false
        cleanupDrag = undefined
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerUp)
    }

    frame.addEventListener('wheel', handleWheel, { passive: false })
    frame.addEventListener('pointerdown', handlePointerDown)

    return () => {
      frame.removeEventListener('wheel', handleWheel)
      frame.removeEventListener('pointerdown', handlePointerDown)
      cleanupDrag?.()
      cleanupClick?.()
    }
  }, [branchRef, contentWidth, frameRef, graphRef, graphScrollRef, syncGraphEdge])
}
