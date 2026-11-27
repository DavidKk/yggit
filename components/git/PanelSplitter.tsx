'use client'

import { useCallback, useEffect, useRef } from 'react'

type Props = {
  label: string
  value: number
  min: number
  max: number
  onResize: (delta: number) => void
  onResizeEnd?: () => void
  onAutoFit?: () => void
  /** Structural L|C|R dividers keep a line; column handles inside a panel stay invisible until hover. */
  line?: boolean
  className?: string
}

export function PanelSplitter({ label, value, min, max, onResize, onResizeEnd, onAutoFit, line = true, className }: Props) {
  const origin = useRef(0)
  const dragging = useRef(false)
  const activePointerId = useRef<number | null>(null)
  const moved = useRef(false)
  const rafRef = useRef<number | null>(null)
  const pendingDeltaRef = useRef(0)
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize
  const onResizeEndRef = useRef(onResizeEnd)
  onResizeEndRef.current = onResizeEnd
  const cleanupRef = useRef<(() => void) | null>(null)

  const stopDrag = useCallback((shouldCommit: boolean) => {
    if (!dragging.current) return
    dragging.current = false
    activePointerId.current = null
    cleanupRef.current?.()
    cleanupRef.current = null
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (shouldCommit && pendingDeltaRef.current) {
      onResizeRef.current(pendingDeltaRef.current)
    }
    pendingDeltaRef.current = 0
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (moved.current) onResizeEndRef.current?.()
  }, [])

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      className={`group/split relative z-40 h-full w-0 shrink-0 cursor-col-resize touch-none outline-none ${className ?? ''}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        dragging.current = true
        activePointerId.current = event.pointerId
        moved.current = false
        origin.current = event.clientX
        pendingDeltaRef.current = 0
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Synthetic pointer events may not support capture
        }
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'

        const targetEl = event.currentTarget
        const onWindowMove = (moveEvent: PointerEvent) => {
          if (!dragging.current) return
          if (activePointerId.current !== null && moveEvent.pointerId !== activePointerId.current) return
          const delta = moveEvent.clientX - origin.current
          if (!delta) return
          origin.current = moveEvent.clientX
          moved.current = true
          pendingDeltaRef.current += delta
          if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(() => {
              rafRef.current = null
              const d = pendingDeltaRef.current
              pendingDeltaRef.current = 0
              if (d) onResizeRef.current(d)
            })
          }
        }
        const onWindowUp = (upEvent: PointerEvent) => {
          if (activePointerId.current !== null && upEvent.pointerId !== activePointerId.current) return
          try {
            if (targetEl.hasPointerCapture(upEvent.pointerId)) {
              targetEl.releasePointerCapture(upEvent.pointerId)
            }
          } catch {
            // Ignore capture release errors
          }
          stopDrag(true)
        }
        const onWindowCancel = (cancelEvent: PointerEvent) => {
          if (activePointerId.current !== null && cancelEvent.pointerId !== activePointerId.current) return
          stopDrag(false)
        }

        window.addEventListener('pointermove', onWindowMove)
        window.addEventListener('pointerup', onWindowUp)
        window.addEventListener('pointercancel', onWindowCancel)
        cleanupRef.current = () => {
          window.removeEventListener('pointermove', onWindowMove)
          window.removeEventListener('pointerup', onWindowUp)
          window.removeEventListener('pointercancel', onWindowCancel)
        }
      }}
      onDoubleClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onAutoFit?.()
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 32 : 8
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          onResize(-step)
          onResizeEnd?.()
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          onResize(step)
          onResizeEnd?.()
        }
      }}
    >
      <span className="absolute inset-y-0 -left-1.5 w-3 bg-transparent hover:bg-accent/30 group-focus-visible/split:bg-accent/40" />
      {line ? <span className="pointer-events-none absolute inset-y-0 left-0 w-px bg-line" /> : null}
    </div>
  )
}
