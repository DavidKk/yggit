'use client'

import { Fragment, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuClock, LuCloud, LuDiamond, LuGitBranch, LuHash, LuMonitor, LuTag, LuText, LuUser } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { copyToClipboard } from '@/lib/clipboard'
import type { layoutCommitGraph } from '@/lib/git/graph'
import { DOT } from '@/lib/git/graph-scene'
import type { GitCommit } from '@/lib/git/types'
import { cn } from '@/lib/utils'

const BADGE_H = DOT

type RefChip = { name: string; label: string; kind: 'head' | 'local' | 'remote' | 'tag' }
export type FloatingAnchor = { x: number; y: number; width?: number }
export type FloatingMenuItem = {
  key: string
  label: string
  icon: ReactNode
  onSelect: () => Promise<void> | void
  group?: string
  dividerBefore?: boolean
}

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
  /** Lane / node color — branch badges follow the graph node. */
  color?: string
  /** Soften historical / off-path labels. */
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
      if (event.target instanceof Element && event.target.closest('[data-git-floating-menu]')) return
      closeAll()
    }
    const handleWheel = (event: WheelEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-git-floating-menu]')) return
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

  async function copyValue(value: string) {
    const ok = await copyToClipboard(value)
    if (ok) notify.success(t('common.copied'))
    else notify.error(t('common.copyFailed'))
  }

  function contextItems(chip: RefChip): FloatingMenuItem[] {
    const items: FloatingMenuItem[] = [
      {
        key: 'branch',
        label: `${t('git.graph.copyBranchName')} (${chip.label})`,
        icon: <LuGitBranch className="size-3.5 shrink-0" aria-hidden />,
        onSelect: () => void copyValue(chip.label),
        group: '复制',
      },
    ]
    if (commit) {
      items.push(
        {
          key: 'subject',
          label: t('git.graph.copyCommitSubject'),
          icon: <LuText className="size-3.5 shrink-0" aria-hidden />,
          onSelect: () => void copyValue(commit.subject),
          group: '复制',
        },
        {
          key: 'hash',
          label: t('git.graph.copyCommitHash'),
          icon: <LuHash className="size-3.5 shrink-0" aria-hidden />,
          onSelect: () => void copyValue(commit.hash),
          group: '复制',
        },
        {
          key: 'short-hash',
          label: `${t('git.graph.copyCommitHash')} (Short: ${commit.short || commit.hash.slice(0, 7)})`,
          icon: <LuHash className="size-3.5 shrink-0" aria-hidden />,
          onSelect: () => void copyValue(commit.short || commit.hash.slice(0, 7)),
          group: '复制',
        },
        {
          key: 'author',
          label: `${t('git.graph.copyAuthor')} (${commit.author})`,
          icon: <LuUser className="size-3.5 shrink-0" aria-hidden />,
          onSelect: () => void copyValue(commit.author),
          group: '复制',
        }
      )
      if (commit.date) {
        items.push({
          key: 'date',
          label: `${t('git.graph.copyDate')} (${commit.date})`,
          icon: <LuClock className="size-3.5 shrink-0" aria-hidden />,
          onSelect: () => void copyValue(commit.date),
          group: '复制',
        })
      }
    }
    return items
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
              data-git-ref-menu-row=""
              className="flex h-[22px] cursor-pointer items-center rounded-sm outline-none hover:bg-[var(--overlay-10)]"
              style={{ height: BADGE_H }}
              onClick={(event) => {
                event.stopPropagation()
                if (commit && onSelectCommit) {
                  onSelectCommit(commit)
                }
              }}
              onMouseEnter={() => {
                const bName = chip.name || chip.label
                if (bName) onBranchHoverStart?.(bName)
              }}
              onMouseLeave={() => {
                onBranchHoverEnd?.()
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setDropdownOpen(true)
                const rect = event.currentTarget.getBoundingClientRect()
                setContextMenu({ chip, anchor: { x: rect.left, y: rect.bottom + 2 } })
              }}
            >
              <RefChipView chip={chip} checkedOut={checkedOut} tone="stack" color={color} />
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
      if (ignoreRef?.current?.contains(event.target)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const handleScroll = (event: Event) => {
      if (event.target instanceof Element && menuRef.current?.contains(event.target)) return
      onClose()
    }
    const handleWheel = (event: WheelEvent) => {
      if (event.target instanceof Element && menuRef.current?.contains(event.target)) return
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
          ? 'absolute z-[100] min-w-48 max-w-[min(24rem,calc(100vw-16px))] max-h-[min(240px,calc(100vh-16px))] overflow-y-auto rounded-sm p-0 outline-none'
          : 'fixed z-[100] min-w-48 max-w-[min(20rem,calc(100vw-16px))] max-h-[min(224px,calc(100vh-16px))] overflow-y-auto rounded-sm border border-line p-0.5 shadow-[var(--shadow-menu)] outline-none'
      )}
      style={{
        color,
        background: `color-mix(in oklab, ${color} 24%, var(--panel-2))`,
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
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] font-medium leading-none text-ink transition-colors hover:bg-[var(--overlay-10)] focus-visible:bg-[var(--overlay-10)] focus-visible:outline-none"
                  onClick={(event) => {
                    event.stopPropagation()
                    onClose()
                    void item.onSelect()
                  }}
                >
                  {item.icon}
                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              </Fragment>
            )
          })
        : children}
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

/** Prefer HEAD/local tip, else remote tip — tags are not “branch at the time”. */
function tipBranchLabel(chips: RefChip[]): string {
  const tip = chips.find((chip) => chip.kind === 'head' || chip.kind === 'local') || chips.find((chip) => chip.kind === 'remote')
  return tip?.label || ''
}

/**
 * Infer the branch name for each commit by walking newest→oldest and carrying tip
 * labels down the same graph color (first-parent lane), GitKraken-style.
 */
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
