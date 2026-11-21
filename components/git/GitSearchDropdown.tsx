'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuSearch } from 'react-icons/lu'

import { GIT_FIND_ATTR, GIT_FIND_EVENT, useGitFindShortcutLabel } from '@/components/git/gitFind'
import { GitFindBox } from '@/components/git/GitFindBox'
import { Button } from '@/components/sk'
import { useFloatingPanel } from '@/components/sk/useFloatingPanel'
import { cn } from '@/lib/utils'

/** Portaled search panel marker — parent menus ignore clicks inside. */
export const GIT_SEARCH_DROPDOWN_ATTR = 'data-git-search-dropdown'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Accessible name for the trigger / field */
  label: string
  /** Functional description of the search capability shown in tooltip */
  description?: string
  className?: string
  onOpenChange?: (open: boolean) => void
  /**
   * When true (default), trigger stays ACTIVE while a filter query remains.
   * Project switcher passes false: ACTIVE only while the dropdown is open.
   */
  activeWhenQuery?: boolean
}

/**
 * Search icon → dropdown SearchInput (clearable).
 * Trigger ACTIVE while open; optionally also while a filter query is set.
 */
export function GitSearchDropdown({ value, onChange, placeholder, label, description, className, onOpenChange, activeWhenQuery = true }: Props) {
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  function setOpenState(next: boolean) {
    openRef.current = next
    setOpen(next)
    onOpenChangeRef.current?.(next)
  }

  const [mounted, setMounted] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const findShortcut = useGitFindShortcutLabel()
  const tooltip = description && description !== label ? `${description} (${findShortcut})` : `${label} (${findShortcut})`
  const active = open || (activeWhenQuery && value.trim().length > 0)
  const panelStyle = useFloatingPanel({
    open,
    anchorRef,
    panelRef,
    maxHeight: 72,
    widthMode: 'content',
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const scope = anchor.closest(`[${GIT_FIND_ATTR}]`)
    if (!scope) return
    function onFind() {
      setOpenState(true)
      window.requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true })
        inputRef.current?.select()
      })
    }
    scope.addEventListener(GIT_FIND_EVENT, onFind)
    return () => scope.removeEventListener(GIT_FIND_EVENT, onFind)
  }, [])

  useEffect(() => {
    if (!open) return
    const doFocus = () => {
      const el = inputRef.current
      if (el && document.activeElement !== el) {
        el.focus({ preventScroll: true })
        el.select()
      }
    }
    doFocus()
    const t1 = setTimeout(doFocus, 0)
    const t2 = setTimeout(doFocus, 50)
    const t3 = setTimeout(doFocus, 150)
    const frame = window.requestAnimationFrame(doFocus)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      window.cancelAnimationFrame(frame)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(event: MouseEvent) {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpenState(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpenState(false)
      anchorRef.current?.focus()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            id={listboxId}
            data-git-search-dropdown=""
            style={{ ...panelStyle, zIndex: 80 }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <GitFindBox
              inputRef={inputRef}
              value={value}
              placeholder={placeholder}
              ariaLabel={label}
              onChange={onChange}
              onClose={() => setOpenState(false)}
              size="medium"
              autoFocus
            />
          </div>,
          document.body
        )
      : null

  return (
    <>
      <Button
        ref={anchorRef}
        variant="plain"
        size="icon"
        className={cn(
          'mr-1 size-6 shrink-0 text-ink-soft hover:enabled:bg-[var(--overlay-08)]',
          active &&
            'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-accent hover:enabled:bg-[color-mix(in_oklab,var(--accent)_22%,transparent)] hover:enabled:text-accent',
          className
        )}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? listboxId : undefined}
        aria-pressed={active || undefined}
        tooltip={active ? undefined : tooltip}
        tooltipSuppressed={open || active}
        onMouseDown={(event) => {
          // Keep focus free for the search input when opening.
          if (!openRef.current) event.preventDefault()
        }}
        onClick={() => setOpenState(!openRef.current)}
      >
        <LuSearch className="size-3.5" aria-hidden />
      </Button>
      {panel}
    </>
  )
}
