'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuCloud, LuGitBranch, LuMonitor, LuTag } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { useOptionalAgent } from '@/lib/agent/agent-context'
import { buildBranchContextMenu } from '@/lib/git/branch-context-menu'
import { useContextMenuConfig } from '@/lib/git/context-menu-config'
import type { layoutCommitGraph } from '@/lib/git/graph'
import { DOT } from '@/lib/git/graph-scene'
import type { GitCommit } from '@/lib/git/types'
import { cn } from '@/lib/utils'

import { type FloatingAnchor, FloatingMenu, type FloatingMenuItem } from './FloatingMenu'

export { FloatingMenu }
export type { FloatingAnchor, FloatingMenuItem }

const BADGE_H = DOT

type RefChip = { name: string; label: string; kind: 'head' | 'local' | 'remote' | 'tag' }

function RefChipView({ chip, checkedOut, color, dimmed = false, full = false }: { chip: RefChip; checkedOut: Set<string>; color?: string; dimmed?: boolean; full?: boolean }) {
  const Icon = chip.kind === 'tag' ? LuTag : chip.kind === 'remote' ? LuCloud : checkedOut.has(chip.name) ? LuMonitor : LuGitBranch
  const tint = color || 'var(--accent)'
  return (
    <span
      data-git-ref-chip=""
      className={cn(
        'inline-flex items-center justify-end gap-1.5 self-center rounded-sm px-2 text-[12px] leading-none font-medium transition-opacity duration-100 select-none shadow-xs',
        full ? 'w-max max-w-none whitespace-nowrap' : 'max-w-full min-w-0',
        dimmed && 'opacity-[0.45]'
      )}
      style={{
        height: BADGE_H,
        color: tint,
        background: `color-mix(in oklab, ${tint} 16%, var(--panel))`,
        border: `1px solid color-mix(in oklab, ${tint} 30%, transparent)`,
      }}
    >
      <span className={full ? 'whitespace-nowrap' : 'truncate'}>{chip.label}</span>
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
  remoteNames = [],
  onBranchHoverStart,
  onBranchHoverEnd,
  onSelectCommit,
  onCheckoutBranch,
  onPushBranch,
  onPullBranch,
  onCreateBranch,
  onDeleteBranch,
  onRenameBranch,
  soloBranch,
  onSoloBranch,
}: {
  chips: RefChip[]
  commit?: GitCommit
  checkedOut: Set<string>
  color: string
  dimmed?: boolean
  remoteNames?: string[]
  onBranchHoverStart?: (name: string) => void
  onBranchHoverEnd?: () => void
  onSelectCommit?: (commit: GitCommit) => void
  onCheckoutBranch?: (branch: string, isRemote?: boolean) => Promise<void> | void
  onPushBranch?: (branch: string) => Promise<void> | void
  onPullBranch?: (branch: string) => Promise<void> | void
  onCreateBranch?: (branch: string, startPoint?: string) => Promise<void> | void
  onDeleteBranch?: (branch: string) => Promise<void> | void
  onRenameBranch?: (oldName: string) => Promise<void> | void
  soloBranch?: string | null
  onSoloBranch?: (branch: string | null) => void
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
    const chipEl = triggerRef.current?.querySelector('[data-git-ref-chip]')
    const rect = (chipEl || triggerRef.current)?.getBoundingClientRect()
    if (!rect) return
    setDropdownAnchor({ x: rect.left, y: rect.top, width: rect.width })
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
    const isRemote = chip.kind === 'remote'
    return buildBranchContextMenu({
      branchName: chip.label,
      rawBranchName: chip.name,
      commit,
      isRemote,
      remoteNames,
      soloBranch,
      onSoloBranch,
      config: contextConfig,
      t,
      onNotify: (type, msg) => {
        if (type === 'success') notify.success(msg)
        else notify.error(msg)
      },
      onCheckoutBranch: (branch, remoteFlag) => {
        if (onCheckoutBranch) {
          void onCheckoutBranch(branch, remoteFlag ?? isRemote)
        } else if (agent) {
          agent.setDockMode('dock-right')
          void agent.sendMessage(`帮我跳转到 ${branch}`)
        }
      },
      onPushBranch,
      onPullBranch,
      onCreateBranch,
      onDeleteBranch,
      onRenameBranch,
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
        onMouseOver={() => {
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
        onDoubleClick={(event) => {
          event.stopPropagation()
          if (first && (first.kind === 'head' || first.kind === 'remote')) {
            void onCheckoutBranch?.(first.name)
          }
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
        <span className={cn('flex h-full max-w-full min-w-0 items-stretch gap-0.5 transition-opacity duration-100', dimmed && 'opacity-[0.32]', dropdownOpen && 'opacity-0')}>
          <RefChipView chip={first} checkedOut={checkedOut} color={color} />
          {extra > 0 ? (
            <span
              className="inline-flex shrink-0 items-center self-center rounded-sm px-1.5 text-[12px] leading-none font-medium tabular-nums"
              style={{
                height: BADGE_H,
                color,
                background: `color-mix(in oklab, ${color} 16%, var(--panel))`,
                border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
              }}
              aria-label={t('git.graph.extraRefs', { count: extra })}
            >
              +{extra}
            </span>
          ) : null}
        </span>
      </span>

      {dropdownOpen && dropdownAnchor && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-git-ref-badges-hover=""
              className="fixed z-[100] flex flex-col gap-1 items-start outline-none"
              style={{
                left: dropdownAnchor.x,
                top: dropdownAnchor.y,
              }}
              onMouseEnter={() => {
                if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
                closeTimerRef.current = null
              }}
              onMouseLeave={scheduleCloseDropdown}
            >
              {chips.map((chip) => (
                <div
                  key={`${chip.kind}:${chip.name}`}
                  className="flex h-[22px] items-center cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    const rect = e.currentTarget.getBoundingClientRect()
                    setContextMenu({ chip, anchor: { x: rect.left, y: rect.bottom + 2 } })
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const rect = e.currentTarget.getBoundingClientRect()
                    setContextMenu({ chip, anchor: { x: rect.left, y: rect.bottom + 2 } })
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    void onCheckoutBranch?.(chip.name)
                  }}
                  onMouseEnter={() => {
                    if (chip?.name) onBranchHoverStart?.(chip.name)
                  }}
                >
                  <RefChipView chip={chip} checkedOut={checkedOut} color={color} full />
                </div>
              ))}
            </div>,
            document.body
          )
        : null}

      {contextMenu ? (
        <FloatingMenu anchor={contextMenu.anchor} ariaLabel={contextMenu.chip.name} color={color} onClose={closeContextMenu} items={contextItems(contextMenu.chip)} />
      ) : null}
    </>
  )
}

export function refChips(refs: string[], remoteNames: string[], options?: { hiddenRemotes?: string[]; soloRemote?: string | null }): RefChip[] {
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
        if (options?.hiddenRemotes?.includes(remote)) continue
        if (options?.soloRemote && options.soloRemote !== remote) continue
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
