'use client'

import React, { Fragment, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuCheck, LuChevronRight } from 'react-icons/lu'

import type { FloatingMenuItem } from '@/lib/git/branch-context-menu'
import { cn } from '@/lib/utils'

export type { FloatingMenuItem }

export type FloatingAnchor = { x: number; y: number; width?: number }

export interface FloatingMenuProps {
  anchor: FloatingAnchor
  ariaLabel: string
  color: string
  onClose: () => void
  children?: ReactNode
  items?: FloatingMenuItem[]
  variant?: 'context' | 'overlay'
  ignoreRef?: RefObject<HTMLElement | null>
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

/**
 * Universal Floating Context Menu / Dropdown overlay.
 * Supports:
 * - Direct coordinate positioning with boundary clamps
 * - Multi-level grouped items with separator lines
 * - Cascading submenus with automatic left/right overflow flip
 * - Secondary confirmation for dangerous operations
 */
export function FloatingMenu({ anchor, ariaLabel, color, onClose, children, items, variant = 'context', ignoreRef, onMouseEnter, onMouseLeave }: FloatingMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isOverlay = variant === 'overlay'

  // Calculate initial position directly to avoid (0,0) flash
  const initialPos = useMemo(() => {
    if (typeof window === 'undefined') return anchor
    const estimatedW = isOverlay ? Math.max(192, anchor.width || 0) : 236
    const estimatedH = 260
    const left = isOverlay
      ? Math.max(8, Math.min(anchor.x, window.scrollX + window.innerWidth - estimatedW - 8))
      : Math.max(8, Math.min(anchor.x, window.innerWidth - estimatedW - 8))
    const top = isOverlay
      ? Math.max(8, Math.min(anchor.y, window.scrollY + window.innerHeight - estimatedH - 8))
      : Math.max(8, Math.min(anchor.y, window.innerHeight - estimatedH - 8))
    return { x: left, y: top }
  }, [anchor, isOverlay])

  const [position, setPosition] = useState(initialPos)
  const [activeSubmenu, setActiveSubmenu] = useState<{
    key: string
    items: FloatingMenuItem[]
    anchorRect: DOMRect
  } | null>(null)

  const submenuTimerRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const node = menuRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const left = isOverlay
      ? Math.max(8, Math.min(anchor.x, window.scrollX + window.innerWidth - rect.width - 8))
      : Math.max(8, Math.min(anchor.x, window.innerWidth - rect.width - 8))
    const top = isOverlay
      ? Math.max(8, Math.min(anchor.y, window.scrollY + window.innerHeight - rect.height - 8))
      : Math.max(8, Math.min(anchor.y, window.innerHeight - rect.height - 8))
    setPosition({ x: left, y: top })
  }, [anchor, isOverlay])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return
      if (menuRef.current?.contains(event.target)) return
      if (event.target.closest('[data-git-floating-submenu]')) return
      if (ignoreRef?.current?.contains(event.target)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const handleScroll = (event: Event) => {
      if (event.target instanceof Element && (menuRef.current?.contains(event.target) || event.target.closest('[data-git-floating-submenu]'))) return
      onClose()
    }
    const handleWheel = (event: WheelEvent) => {
      if (event.target instanceof Element && (menuRef.current?.contains(event.target) || event.target.closest('[data-git-floating-submenu]'))) return
      if (Math.hypot(event.deltaX, event.deltaY) > 3) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    window.addEventListener('wheel', handleWheel, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('wheel', handleWheel, true)
      if (submenuTimerRef.current !== null) window.clearTimeout(submenuTimerRef.current)
    }
  }, [ignoreRef, onClose])

  const openSubmenuFor = useCallback((item: FloatingMenuItem, target: HTMLElement) => {
    if (submenuTimerRef.current !== null) {
      window.clearTimeout(submenuTimerRef.current)
      submenuTimerRef.current = null
    }
    const rect = target.getBoundingClientRect()
    setActiveSubmenu({
      key: item.key,
      items: item.children || [],
      anchorRect: rect,
    })
  }, [])

  const closeSubmenuWithDelay = useCallback((delayMs = 180) => {
    if (submenuTimerRef.current !== null) {
      window.clearTimeout(submenuTimerRef.current)
    }
    submenuTimerRef.current = window.setTimeout(() => {
      setActiveSubmenu(null)
      submenuTimerRef.current = null
    }, delayMs)
  }, [])

  const cancelCloseSubmenu = useCallback(() => {
    if (submenuTimerRef.current !== null) {
      window.clearTimeout(submenuTimerRef.current)
      submenuTimerRef.current = null
    }
  }, [])

  return createPortal(
    <>
      <div
        ref={menuRef}
        role={variant === 'context' ? 'menu' : 'list'}
        aria-label={ariaLabel}
        data-git-floating-menu=""
        className={cn(
          variant === 'overlay'
            ? 'absolute z-[100] min-w-48 max-w-[min(24rem,calc(100vw-16px))] max-h-[min(240px,calc(100vh-16px))] overflow-y-auto rounded-lg bg-panel p-0 shadow-lg outline-none'
            : 'fixed z-[100] w-[236px] min-w-[220px] max-w-[min(260px,calc(100vw-16px))] max-h-[min(480px,calc(100vh-16px))] overflow-y-auto overflow-x-visible rounded-xl border border-line/80 bg-panel/95 p-1.5 shadow-2xl backdrop-blur-md outline-none animate-in fade-in zoom-in-95 duration-100'
        )}
        style={{
          left: position.x,
          top: position.y,
          minWidth: variant === 'overlay' ? anchor.width : undefined,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {items
          ? items.map((item, index) => {
              const prevItem = index > 0 ? items[index - 1] : undefined
              const showDivider = Boolean(item.dividerBefore || (prevItem && prevItem.group && item.group && prevItem.group !== item.group))
              return (
                <Fragment key={item.key}>
                  {showDivider ? <div className="my-1 border-t border-line/60" role="separator" /> : null}
                  <FloatingMenuItemRow
                    item={item}
                    color={color}
                    onClose={onClose}
                    isSubmenuActive={activeSubmenu?.key === item.key}
                    onHoverItem={(hoveredItem, el) => {
                      if (hoveredItem.children && hoveredItem.children.length > 0) {
                        openSubmenuFor(hoveredItem, el)
                      } else {
                        closeSubmenuWithDelay(120)
                      }
                    }}
                    onLeaveItem={() => {
                      closeSubmenuWithDelay(180)
                    }}
                    onClickItem={(clickedItem, el) => {
                      openSubmenuFor(clickedItem, el)
                    }}
                  />
                </Fragment>
              )
            })
          : children}
      </div>

      {/* Cascading Submenu Flyout */}
      {activeSubmenu && (
        <FloatingSubmenu
          anchorRect={activeSubmenu.anchorRect}
          items={activeSubmenu.items}
          color={color}
          onClose={onClose}
          onMouseEnter={cancelCloseSubmenu}
          onMouseLeave={() => closeSubmenuWithDelay(180)}
        />
      )}
    </>,
    document.body
  )
}

function FloatingMenuItemRow({
  item,
  onClose,
  color: _color,
  isSubmenuActive = false,
  onHoverItem,
  onLeaveItem,
  onClickItem,
}: {
  item: FloatingMenuItem
  onClose: () => void
  color?: string
  isSubmenuActive?: boolean
  onHoverItem?: (item: FloatingMenuItem, el: HTMLElement) => void
  onLeaveItem?: () => void
  onClickItem?: (item: FloatingMenuItem, el: HTMLElement) => void
}) {
  const rowRef = useRef<HTMLButtonElement | null>(null)
  const [confirming, setConfirming] = useState(false)
  const hasChildren = Boolean(item.children && item.children.length > 0)

  const handlePointerEnter = () => {
    if (rowRef.current) {
      onHoverItem?.(item, rowRef.current)
    }
  }

  const handlePointerLeave = () => {
    setConfirming(false)
    onLeaveItem?.()
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren && rowRef.current) {
      onClickItem?.(item, rowRef.current)
      return
    }

    if (item.danger && item.needsConfirm && !confirming) {
      setConfirming(true)
      return
    }

    onClose()
    void item.onSelect?.()
  }

  return (
    <div className="relative w-full" onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <button
        ref={rowRef}
        type="button"
        role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
        aria-checked={item.checked}
        disabled={item.disabled}
        onClick={handleClick}
        className={cn(
          'relative flex h-[34px] w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1 text-left text-xs font-medium transition-colors select-none',
          isSubmenuActive ? 'bg-[var(--overlay-10)] text-ink' : '',
          item.danger ? (confirming ? 'bg-fail text-white font-semibold' : 'text-fail hover:bg-fail/15 hover:text-fail') : 'text-ink hover:bg-[var(--overlay-10)] hover:text-ink',
          item.disabled && 'opacity-40 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {item.icon}
          <span className="truncate">{confirming ? item.confirmText || '确定执行？再次点击确认' : item.label}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {item.checked ? <LuCheck className="size-3.5 text-accent" aria-hidden="true" /> : null}
          {item.badge && <span className="rounded bg-[var(--overlay-10)] px-1.5 py-0.5 text-[10px] font-mono font-medium text-ink-soft">{item.badge}</span>}
          {item.shortcut && <span className="text-[11px] font-mono text-ink-soft/70">{item.shortcut}</span>}
          {hasChildren && <LuChevronRight className="size-3.5 text-ink-soft/70 shrink-0" aria-hidden />}
        </div>
      </button>
    </div>
  )
}

function FloatingSubmenu({
  anchorRect,
  items,
  color,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: {
  anchorRect: DOMRect
  items: FloatingMenuItem[]
  color: string
  onClose: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const submenuRef = useRef<HTMLDivElement | null>(null)

  const submenuWidth = 236
  const fitsRight = typeof window !== 'undefined' ? anchorRect.right + submenuWidth + 8 <= window.innerWidth : true
  const initialLeft = fitsRight ? anchorRect.right - 2 : Math.max(8, anchorRect.left - submenuWidth + 2)
  const initialTop = typeof window !== 'undefined' ? Math.max(8, Math.min(anchorRect.top - 4, window.innerHeight - 280)) : anchorRect.top

  const [pos, setPos] = useState({ left: initialLeft, top: initialTop })

  useLayoutEffect(() => {
    const node = submenuRef.current
    if (!node) return
    const sRect = node.getBoundingClientRect()

    let left = fitsRight ? anchorRect.right - 2 : anchorRect.left - sRect.width + 2
    if (left + sRect.width > window.innerWidth - 8) {
      left = Math.max(8, anchorRect.left - sRect.width + 2)
    }
    let top = anchorRect.top - 4
    if (top + sRect.height > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - sRect.height - 8)
    }
    setPos({ left, top })
  }, [anchorRect, fitsRight])

  return createPortal(
    <div
      ref={submenuRef}
      role="menu"
      data-git-floating-submenu=""
      className={cn(
        'fixed z-[110] w-[236px] min-w-[220px] max-w-[min(260px,calc(100vw-16px))] overflow-hidden rounded-xl border border-line/80 bg-panel/95 p-1.5 shadow-2xl backdrop-blur-md outline-none animate-in fade-in zoom-in-95 duration-100',
        fitsRight
          ? 'before:absolute before:-left-3 before:top-0 before:bottom-0 before:w-4 before:content-[""]'
          : 'before:absolute before:-right-3 before:top-0 before:bottom-0 before:w-4 before:content-[""]'
      )}
      style={{
        left: pos.left,
        top: pos.top,
      }}
      onPointerEnter={onMouseEnter}
      onPointerLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((child, idx) => {
        const prev = idx > 0 ? items[idx - 1] : undefined
        const showDiv = Boolean(child.dividerBefore || (prev?.group && child.group && prev.group !== child.group))
        return (
          <Fragment key={child.key}>
            {showDiv && <div className="my-1 border-t border-line/60" role="separator" />}
            <FloatingMenuItemRow item={child} onClose={onClose} color={color} />
          </Fragment>
        )
      })}
    </div>,
    document.body
  )
}
