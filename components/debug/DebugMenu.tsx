'use client'

import { Popover } from '@base-ui/react/popover'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LuBug, LuCheck, LuEraser, LuX } from 'react-icons/lu'

import { useDebugMenuEntries } from '@/components/debug/registry'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button } from '@/components/sk'
import { dropdownPopupClass, dropdownTriggerClass } from '@/components/sk/dropdownMenu'
import { cn } from '@/lib/utils'

const KEY = 'yggit:debug-menu-position:v1'
type Position = { side: 'left' | 'right'; top: number }
function clamp(top: number) {
  return Math.max(8, Math.min(window.innerHeight - 40, top))
}

export function DebugMenu({ children }: { children?: React.ReactNode }) {
  const t = useT()
  const entries = useDebugMenuEntries()
  const [position, setPosition] = useState<Position>({ side: 'right', top: 280 })
  const [open, setOpen] = useState(false)
  const drag = useRef<{ x: number; y: number; top: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  const actions = useMemo(
    () =>
      entries.flatMap((entry) =>
        entry.actions.map((action) => ({
          ...action,
          key: `${entry.id}:${action.id}`,
        })),
      ),
    [entries],
  )
  const customs = useMemo(() => entries.filter((entry) => entry.custom), [entries])
  const hasActive = actions.some((action) => action.active)

  useEffect(() => {
    let saved: Position = { side: 'right', top: window.innerHeight - 96 }
    try {
      const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Position | null
      if (value && ['left', 'right'].includes(value.side) && Number.isFinite(value.top)) saved = value
    } catch {
      /* Storage is optional. */
    }
    setPosition({ ...saved, top: clamp(saved.top) })
    const resize = () => setPosition((current) => ({ ...current, top: clamp(current.top) }))
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (entries.length === 0) setOpen(false)
  }, [entries.length])

  if (process.env.NODE_ENV !== 'development') return null
  if (entries.length === 0 && !children) return null

  return (
    <div className="fixed z-[70]" style={{ top: position.top, [position.side]: 4 }}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          aria-label={t('debug.title')}
          title={t('debug.hint')}
          className={cn(dropdownTriggerClass, 'touch-none rounded-full bg-panel opacity-65 shadow-lg hover:opacity-100 focus-visible:opacity-100')}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            suppressClick.current = false
            drag.current = { x: event.clientX, y: event.clientY, top: position.top, moved: false }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const current = drag.current
            if (!current) return
            if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 4) current.moved = true
            if (current.moved) {
              setOpen(false)
              setPosition({ side: event.clientX < window.innerWidth / 2 ? 'left' : 'right', top: clamp(current.top + event.clientY - current.y) })
            }
          }}
          onPointerUp={(event) => {
            if (!drag.current) return
            suppressClick.current = drag.current.moved
            if (drag.current.moved) {
              const next: Position = { side: event.clientX < window.innerWidth / 2 ? 'left' : 'right', top: clamp(drag.current.top + event.clientY - drag.current.y) }
              setPosition(next)
              try {
                localStorage.setItem(KEY, JSON.stringify(next))
              } catch {
                /* Storage is optional. */
              }
            }
            drag.current = null
            try {
              event.currentTarget.releasePointerCapture(event.pointerId)
            } catch {
              /* Capture may already be released. */
            }
          }}
          onPointerCancel={(event) => {
            drag.current = null
            suppressClick.current = true
            try {
              event.currentTarget.releasePointerCapture(event.pointerId)
            } catch {
              /* Capture may already be released. */
            }
          }}
          onClickCapture={(event) => {
            if (suppressClick.current) {
              event.preventDefault()
              event.stopPropagation()
              suppressClick.current = false
            }
          }}
        >
          <LuBug size={16} aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side={position.side === 'right' ? 'left' : 'right'} align="end" sideOffset={8} collisionPadding={8} positionMethod="fixed" className="z-[70]">
            <Popover.Popup
              aria-label={t('debug.title')}
              initialFocus={false}
              className={cn(dropdownPopupClass, 'flex max-h-[min(36rem,80vh)] w-[16.5rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden p-0')}
            >
              <div className="flex shrink-0 items-center gap-1 bg-panel-2 px-2 py-1">
                <Popover.Title className="m-0 min-w-0 flex-1 truncate text-[11px] font-medium text-ink-soft">{t('debug.title')}</Popover.Title>
                <Button
                  size="mini"
                  variant="plain"
                  aria-label={t('debug.clearAll')}
                  tooltip={t('debug.clearAll')}
                  disabled={!hasActive}
                  onClick={() => {
                    for (const action of actions) {
                      if (action.active && !action.disabled) action.run()
                    }
                  }}
                >
                  <LuEraser size={14} />
                </Button>
                <Button size="mini" variant="plain" aria-label={t('common.close')} onClick={() => setOpen(false)}>
                  <LuX size={14} />
                </Button>
              </div>
              {/* Plain overflow — ScrollArea observers remasure every mutation and keep the popup “unstable” for clicks. */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
                <div className="flex flex-col gap-px">
                  {actions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      disabled={action.disabled}
                      aria-pressed={action.active || undefined}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-[0.2rem] px-1.5 py-1 text-left text-[11px] text-ink outline-none',
                        'hover:bg-[var(--overlay-08)] focus-visible:bg-[var(--overlay-08)]',
                        action.active && 'text-accent',
                        action.disabled && 'cursor-not-allowed opacity-45',
                      )}
                      onMouseDown={(event) => {
                        // Keep focus in the popup so outside-press dismiss does not eat the click.
                        if (event.button === 0) event.preventDefault()
                      }}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (!action.disabled) action.run()
                      }}
                    >
                      <LuCheck className={cn('size-3.5 shrink-0', action.active ? 'opacity-100' : 'opacity-0')} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{action.label}</span>
                    </button>
                  ))}
                  {customs.map((entry) => (
                    <div key={entry.id}>{entry.custom}</div>
                  ))}
                  {children}
                </div>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
