'use client'

import { useRef } from 'react'

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
  const moved = useRef(false)
  const rafRef = useRef<number | null>(null)
  const pendingDeltaRef = useRef(0)

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
        moved.current = false
        origin.current = event.clientX
        pendingDeltaRef.current = 0
        event.currentTarget.setPointerCapture(event.pointerId)
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
      }}
      onPointerMove={(event) => {
        if (!dragging.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
        const delta = event.clientX - origin.current
        if (!delta) return
        origin.current = event.clientX
        moved.current = true
        pendingDeltaRef.current += delta
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null
            const d = pendingDeltaRef.current
            pendingDeltaRef.current = 0
            if (d) onResize(d)
          })
        }
      }}
      onPointerUp={(event) => {
        if (!dragging.current) return
        dragging.current = false
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        if (pendingDeltaRef.current) {
          onResize(pendingDeltaRef.current)
          pendingDeltaRef.current = 0
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (moved.current) onResizeEnd?.()
      }}
      onPointerCancel={(event) => {
        if (!dragging.current) return
        dragging.current = false
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        pendingDeltaRef.current = 0
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        if (moved.current) onResizeEnd?.()
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
