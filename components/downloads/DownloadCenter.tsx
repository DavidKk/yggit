'use client'

import { Popover } from '@base-ui/react/popover'
import { useEffect, useRef, useState } from 'react'
import { LuDownload } from 'react-icons/lu'

import { DownloadItemRow } from '@/components/downloads/DownloadItemRow'
import { useT } from '@/components/i18n/LocaleProvider'
import { dropdownPopupClass, dropdownTriggerClass } from '@/components/sk/dropdownMenu'
import { onDownloadCenterOpenRequest, useBrowserDownloads } from '@/lib/downloads/browser-downloads'
import { cn } from '@/lib/utils'

/**
 * Top-right header download center (modeled after chaya's DownloadCenter pattern).
 * Hidden completely when no browser download/preparation task is running.
 */
export function DownloadCenter() {
  const t = useT()
  const running = useBrowserDownloads().filter((item) => item.status === 'running')
  const visible = running.length > 0
  const [open, setOpen] = useState(false)
  const programmatic = useRef(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [container, setContainer] = useState<ShadowRoot>()

  useEffect(() => {
    const root = anchorRef.current?.getRootNode()
    if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
      setContainer(root)
    }
  }, [visible])

  useEffect(
    () =>
      onDownloadCenterOpenRequest(() => {
        programmatic.current = true
        setOpen(true)
      }),
    []
  )

  useEffect(() => {
    if (!visible) setOpen(false)
  }, [visible])

  if (!visible) return null

  const count = running.length > 99 ? '99+' : String(running.length)

  return (
    <span ref={anchorRef} className="inline-flex">
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          programmatic.current = false
          setOpen(next)
        }}
      >
        <Popover.Trigger aria-label={`${t('downloads.triggerAria')} (${t('downloads.running', { count: running.length })})`} className={cn(dropdownTriggerClass, 'relative')}>
          <LuDownload className="size-3.5 shrink-0" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] leading-none font-semibold tabular-nums text-accent-ink"
          >
            {count}
          </span>
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} positionMethod="fixed" className="z-[70]">
            <Popover.Popup
              aria-label={t('downloads.title')}
              initialFocus={() => !programmatic.current}
              finalFocus={() => !programmatic.current}
              className={cn(dropdownPopupClass, 'flex w-[22rem] max-w-[calc(100vw-1rem)] flex-col p-0')}
            >
              <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
                <Popover.Title className="m-0 text-[0.8125rem] font-semibold text-ink">{t('downloads.title')}</Popover.Title>
                <span className="text-[0.75rem] text-ink-soft">{t('downloads.running', { count: running.length })}</span>
              </div>
              <ul className="m-0 max-h-[60vh] list-none divide-y divide-line/60 overflow-y-auto p-0">
                {running.map((item) => (
                  <DownloadItemRow key={item.id} item={item} />
                ))}
              </ul>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </span>
  )
}
