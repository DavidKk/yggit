'use client'

import { useT } from '@/components/i18n/LocaleProvider'
import type { BrowserDownloadItem } from '@/lib/downloads/browser-downloads'

/** Single running browser download row (read-only progress display) */
export function DownloadItemRow({ item }: { item: BrowserDownloadItem }) {
  const t = useT()
  const percent = typeof item.percent === 'number' ? Math.min(100, Math.max(0, Math.round(item.percent))) : undefined
  const phaseLabel = item.phase === 'prepare' ? t('downloads.phase.prepare') : t('downloads.phase.download')

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[0.8125rem] font-medium text-ink">{item.title}</span>
        <span className="shrink-0 text-[0.75rem] text-ink-soft">{phaseLabel}</span>
      </div>

      <span className="block truncate text-[0.75rem] text-ink-soft">
        {t('downloads.channelBrowser')} · {item.subtitle}
      </span>

      <div
        role="progressbar"
        aria-label={item.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-busy={percent == null ? true : undefined}
        className="h-1.5 overflow-hidden rounded-full bg-inset"
      >
        {percent == null ? (
          <div className="h-full w-full animate-pulse rounded-full bg-accent/55" />
        ) : (
          <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
        )}
      </div>

      {item.detail ? <div className="text-[0.75rem] tabular-nums text-ink-soft">{item.detail}</div> : null}
    </li>
  )
}
