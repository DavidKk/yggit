'use client'

import React, { Fragment, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuChevronRight, LuCloud, LuDiamond, LuMonitor, LuTag } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { useOptionalAgent } from '@/lib/agent/agent-context'
import { buildBranchContextMenu, type FloatingMenuItem } from '@/lib/git/branch-context-menu'
import { useContextMenuConfig } from '@/lib/git/context-menu-config'
import type { layoutCommitGraph } from '@/lib/git/graph'
import { DOT } from '@/lib/git/graph-scene'
import type { GitCommit } from '@/lib/git/types'
import { cn } from '@/lib/utils'

export type { FloatingMenuItem }

const BADGE_H = DOT

type RefChip = { name: string; label: string; kind: 'head' | 'local' | 'remote' | 'tag' }
export type FloatingAnchor = { x: number; y: number; width?: number }

function RefChipView({
  chip,
  checkedOut,
  tone = 'default',
  color,
  dimmed = false,
}: {
  chip: RefChip
  checkedOut: Set<string>
  tone?: 'default' | 'stack'
  color?: string
  dimmed?: boolean
}) {
  const Icon = chip.kind === 'tag' ? LuTag : chip.kind === 'remote' ? LuCloud : checkedOut.has(chip.name) ? LuMonitor : LuDiamond
  const tint = color || 'var(--accent)'
  if (tone === 'stack') {
    return (
      <span className="inline-flex h-[22px] max-w-full min-w-0 w-full items-center justify-between gap-3 px-2 text-[12px] leading-none font-medium" style={{ height: BADGE_H }}>
        <span className="min-w-0 break-all">{chip.label}</span>
        <Icon className="size-3.5 shrink-0" aria-hidden />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center justify-end gap-1.5 self-center rounded-sm px-2 text-[12px] leading-none font-medium transition-opacity duration-100',
        dimmed && 'opacity-[0.45]'
      )}
      style={{ height: BADGE_H, color: tint, background: `color-mix(in oklab, ${tint} 18%, transparent)` }}
    >
      <span className="truncate">{chip.label}</span>
      <Icon className="size-3.5 shrink-0" style={{ color: tint }} aria-hidden />
    </span>
  )
}

export function RefChipsCell({
  chips,
  commit,
  checkedOut,
  color,
  dimmed = false,
  onBranchHoverStart,
  onBranchHoverEnd,
  onSelectCommit,
}: {
  chips: RefChip[]
  commit?: GitCommit
  checkedOut: Set<string>
  color: string
  dimmed?: boolean
  onBranchHoverStart?: (name: string) => void
  onBranchHoverEnd?: () => void
  onSelectCommit?: (commit: GitCommit) => void
}) {
  const t = useT()
  const notify = useNotification()
  const [contextConfig] = useContextMenuConfig()
  const agent = useOptionalAgent()

  const triggerRef = useRef<HTMLElement | null>(null)
  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownAnchor, setDropdownAnchor] = useState<FloatingAnchor | null>(null)
  const [contextMenu, setContextMenu] = useState<{ chip: RefChip; anchor: FloatingAnchor } | null>(null)

  const openDropdown = () => {
    if (chips.length === 0) return
    if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current)
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    openTimerRef.current = null
    closeTimerRef.current = null
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setDropdownAnchor({ x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width })
    setDropdownOpen(true)
  }

  const closeDropdown = useCallback(
    (force = false) => {
      if (!force && contextMenu) return
      setDropdownOpen(false)
      setDropdownAnchor(null)
    },
    [contextMenu]
  )

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
    setDropdownOpen(false)
    setDropdownAnchor(null)
    onBranchHoverEnd?.()
  }, [onBranchHoverEnd])

  const closeAll = useCallback(() => {
    if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current)
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    openTimerRef.current = null
    closeTimerRef.current = null
    setContextMenu(null)
    setDropdownOpen(false)
    setDropdownAnchor(null)
    onBranchHoverEnd?.()
  }, [onBranchHoverEnd])

  const scheduleCloseDropdown = () => {
    if (chips.length === 0) return
    if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current)
    openTimerRef.current = null
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => closeDropdown(), 180)
  }

  useEffect(
    () => () => {
      if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current)
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    },
    []
  )

  useEffect(() => {
    if (!dropdownOpen && !contextMenu) return
    const handleScroll = (event: Event) => {
      if (event.target instanceof Element && (event.target.closest('[data-git-floating-menu]') || event.target.closest('[data-git-floating-submenu]'))) return
      closeAll()
    }
    const handleWheel = (event: WheelEvent) => {
      if (event.target instanceof Element && (event.target.closest('[data-git-floating-menu]') || event.target.closest('[data-git-floating-submenu]'))) return
      if (Math.hypot(event.deltaX, event.deltaY) > 3) {
        closeAll()
      }
    }
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    window.addEventListener('wheel', handleWheel, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('wheel', handleWheel, true)
    }
  }, [dropdownOpen, contextMenu, closeAll])

  function contextItems(chip: RefChip): FloatingMenuItem[] {
    return buildBranchContextMenu({
      branchName: chip.label,
      commit,
      config: contextConfig,
      onNotify: (type, msg) => {
        if (type === 'success') notify.success(msg)
        else notify.error(msg)
      },
      onCheckoutBranch: (branch) => {
        if (agent) {
          agent.setDockMode('dock-right')
          void agent.sendMessage(`帮我跳转到 ${branch}`)
        }
      },
      onAgentPrompt: (prompt) => {
        if (agent) {
          agent.setDockMode('dock-right')
          void agent.sendMessage(prompt)
        }
      },
    })
  }

  if (chips.length === 0) return null
  const first = chips[0]
  const extra = chips.length - 1

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        data-git-ref-menu-trigger=""
        aria-label={chips.map((chip) => chip.name).join(', ')}
        aria-haspopup="menu"
        aria-expanded={dropdownOpen}
        className="flex h-[22px] max-w-full min-w-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => {
          openDropdown()
          if (first?.name) onBranchHoverStart?.(first.name)
        }}
        onMouseLeave={() => {
          scheduleCloseDropdown()
          onBranchHoverEnd?.()
        }}
        onClick={(event) => {
          event.stopPropagation()
          if (commit && onSelectCommit) {
            onSelectCommit(commit)
          }
          openDropdown()
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          event.stopPropagation()
          if (commit && onSelectCommit) {
            onSelectCommit(commit)
          }
          openDropdown()
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          const rect = event.currentTarget.getBoundingClientRect()
          setContextMenu({ chip: first, anchor: { x: rect.left, y: rect.bottom + 2 } })
        }}
      >
        <span className={cn('flex h-full max-w-full min-w-0 items-stretch gap-0.5 transition-opacity duration-100', dimmed && 'opacity-[0.32]')}>
          <RefChipView chip={first} checkedOut={checkedOut} color={color} />
          {extra > 0 ? (
            <span
              className="inline-flex shrink-0 items-center self-center rounded-sm px-1.5 text-[12px] leading-none font-medium tabular-nums"
              style={{ height: BADGE_H, color, background: `color-mix(in oklab, ${color} 18%, transparent)` }}
              aria-label={t('git.graph.extraRefs', { count: extra })}
            >
              +{extra}
            </span>
          ) : null}
        </span>
      </span>

      {dropdownOpen && dropdownAnchor ? (
        <FloatingMenu
          anchor={dropdownAnchor}
          ariaLabel={chips.map((chip) => chip.name).join(', ')}
          color={color}
          variant="overlay"
          ignoreRef={triggerRef}
          onClose={() => closeDropdown(true)}
          onMouseEnter={() => {
            if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
            closeTimerRef.current = null
          }}
          onMouseLeave={scheduleCloseDropdown}
        >
          {chips.map((chip) => (
            <div
              key={`${chip.kind}:${chip.name}`}
              className="px-2 py-1 hover:bg-[var(--overlay-08)] cursor-pointer text-xs"
              onClick={(e) => {
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                setContextMenu({ chip, anchor: { x: rect.left, y: rect.bottom + 2 } })
              }}
            >
              <RefChipView chip={chip} checkedOut={checkedOut} color={color} />
            </div>
          ))}
        </FloatingMenu>
      ) : null}

      {contextMenu ? (
        <FloatingMenu anchor={contextMenu.anchor} ariaLabel={contextMenu.chip.name} color={color} onClose={closeContextMenu} items={contextItems(contextMenu.chip)} />
      ) : null}
    </>
  )
}

/**
 * Standard hierarchical context menu component:
 * - Width: 220–260px (default w-[236px])
 * - Item height: 32–36px (default h-[34px])
 * - Cascading submenus with automatic left/right overflow flip
 * - Secondary confirmation for dangerous operations
 */
export function FloatingMenu({
  anchor,
  ariaLabel,
  color,
  onClose,
  children,
  items,
  variant = 'context',
  ignoreRef,
  onMouseEnter,
  onMouseLeave,
}: {
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
}) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState(anchor)

  useLayoutEffect(() => {
    const node = menuRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const isOverlay = variant === 'overlay'
    const left = isOverlay
      ? Math.max(8, Math.min(anchor.x, window.scrollX + window.innerWidth - rect.width - 8))
      : Math.max(8, Math.min(anchor.x, window.innerWidth - rect.width - 8))
    const top = isOverlay
      ? Math.max(8, Math.min(anchor.y, window.scrollY + window.innerHeight - rect.height - 8))
      : Math.max(8, Math.min(anchor.y, window.innerHeight - rect.height - 8))
    setPosition({ x: left, y: top })
  }, [anchor, variant])

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
    }
  }, [ignoreRef, onClose])

  return createPortal(
    <div
      ref={menuRef}
      role={variant === 'context' ? 'menu' : 'list'}
      aria-label={ariaLabel}
      data-git-floating-menu=""
      className={cn(
        variant === 'overlay'
          ? 'absolute z-[100] min-w-48 max-w-[min(24rem,calc(100vw-16px))] max-h-[min(240px,calc(100vh-16px))] overflow-y-auto rounded-lg p-0 outline-none'
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
                <FloatingMenuItemRow item={item} color={color} onClose={onClose} />
              </Fragment>
            )
          })
        : children}
    </div>,
    document.body
  )
}

function FloatingMenuItemRow({ item, onClose, color }: { item: FloatingMenuItem; onClose: () => void; color: string }) {
  const rowRef = useRef<HTMLButtonElement | null>(null)
  const [showSubmenu, setShowSubmenu] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const hasChildren = Boolean(item.children && item.children.length > 0)

  const handleMouseEnter = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (hasChildren) {
      setShowSubmenu(true)
    }
  }

  const handleMouseLeave = () => {
    if (hasChildren) {
      closeTimerRef.current = window.setTimeout(() => {
        setShowSubmenu(false)
      }, 180)
    }
    setConfirming(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) {
      setShowSubmenu(!showSubmenu)
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
    <div className="relative w-full" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        ref={rowRef}
        type="button"
        role="menuitem"
        disabled={item.disabled}
        onClick={handleClick}
        className={cn(
          'flex h-[34px] w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1 text-left text-xs font-medium transition-colors select-none',
          item.danger ? (confirming ? 'bg-fail text-white font-semibold' : 'text-fail hover:bg-fail/15 hover:text-fail') : 'text-ink hover:bg-[var(--overlay-10)] hover:text-ink',
          item.disabled && 'opacity-40 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {item.icon}
          <span className="truncate">{confirming ? item.confirmText || '确定执行？再次点击确认' : item.label}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {item.badge && <span className="rounded bg-[var(--overlay-10)] px-1.5 py-0.5 text-[10px] font-mono font-medium text-ink-soft">{item.badge}</span>}
          {item.shortcut && <span className="text-[11px] font-mono text-ink-soft/70">{item.shortcut}</span>}
          {hasChildren && <LuChevronRight className="size-3.5 text-ink-soft/70 shrink-0" aria-hidden />}
        </div>
      </button>

      {/* Cascading Submenu Flyout */}
      {hasChildren && showSubmenu && rowRef.current && (
        <FloatingSubmenu anchorRef={rowRef} items={item.children!} color={color} onClose={onClose} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
      )}
    </div>
  )
}

function FloatingSubmenu({
  anchorRef,
  items,
  color,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  items: FloatingMenuItem[]
  color: string
  onClose: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const submenuRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const submenu = submenuRef.current
    if (!anchor || !submenu) return
    const aRect = anchor.getBoundingClientRect()
    const sRect = submenu.getBoundingClientRect()

    let left = aRect.right - 2
    if (left + sRect.width > window.innerWidth - 8) {
      left = Math.max(8, aRect.left - sRect.width + 2)
    }
    let top = aRect.top - 2
    if (top + sRect.height > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - sRect.height - 8)
    }
    setPos({ left, top })
  }, [anchorRef])

  return createPortal(
    <div
      ref={submenuRef}
      role="menu"
      data-git-floating-submenu=""
      className="fixed z-[110] w-[236px] min-w-[220px] max-w-[min(260px,calc(100vw-16px))] overflow-hidden rounded-xl border border-line/80 bg-panel/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 outline-none"
      style={{
        left: pos.left,
        top: pos.top,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
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

export function refChips(refs: string[], remoteNames: string[]): RefChip[] {
  const chips: RefChip[] = []
  for (const ref of refs) {
    if (ref === 'HEAD' || ref.endsWith('/HEAD')) continue
    if (ref.startsWith('HEAD -> ')) {
      const name = ref.slice('HEAD -> '.length)
      chips.push({ name, label: name, kind: 'head' })
    } else if (ref.startsWith('tag: ')) {
      const name = ref.slice('tag: '.length)
      chips.push({ name, label: name, kind: 'tag' })
    } else {
      const remote = remoteNames.find((item) => ref === item || ref.startsWith(`${item}/`))
      if (remote) {
        const label = ref === remote ? remote : ref.slice(remote.length + 1)
        chips.push({ name: ref, label, kind: 'remote' })
      } else {
        chips.push({ name: ref, label: ref, kind: 'local' })
      }
    }
  }
  const locals = new Set(chips.filter((chip) => chip.kind === 'head' || chip.kind === 'local').map((chip) => chip.name))
  return chips.filter((chip) => {
    if (chip.kind !== 'remote') return true
    const slash = chip.name.indexOf('/')
    const branch = slash >= 0 ? chip.name.slice(slash + 1) : chip.name
    return !locals.has(branch)
  })
}

function tipBranchLabel(chips: RefChip[]): string {
  const tip = chips.find((chip) => chip.kind === 'head' || chip.kind === 'local') || chips.find((chip) => chip.kind === 'remote')
  return tip?.label || ''
}

export function branchAtCommits(commits: GitCommit[], points: ReturnType<typeof layoutCommitGraph>, remoteNames: string[]): Map<string, string> {
  const byColor = new Map<number, string>()
  const byHash = new Map<string, string>()
  commits.forEach((commit, index) => {
    const point = points[index]
    if (!point) return
    const tip = tipBranchLabel(refChips(commit.refs, remoteNames))
    if (tip) {
      byColor.set(point.color, tip)
      byHash.set(commit.hash, tip)
      return
    }
    const inherited = byColor.get(point.color)
    if (inherited) byHash.set(commit.hash, inherited)
  })
  return byHash
}
