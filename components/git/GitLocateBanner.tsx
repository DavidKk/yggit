'use client'

import { LuArrowUpRight, LuCheck, LuCircleAlert, LuLoader, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'

export interface LocateStatusState {
  id: number
  hash: string
  target: string
  phase: 'loading' | 'ready' | 'not_found'
}

interface GitLocateBannerProps {
  status: LocateStatusState | null
  onJump: (hash: string) => void
  onCancel: () => void
  onDismiss: () => void
}

/**
 * Non-blocking floating status pill shown while locating an off-screen branch/commit or when ready after user interaction.
 */
export function GitLocateBanner({ status, onJump, onCancel, onDismiss }: GitLocateBannerProps) {
  const t = useT()
  if (!status) return null

  const short = status.hash.slice(0, 7)

  return (
    <div
      className="pointer-events-auto absolute bottom-3 right-3 z-30 flex max-w-[min(420px,calc(100%-24px))] items-center gap-2 rounded-md border border-line bg-panel/95 px-2.5 py-1.5 text-xs text-ink shadow-md backdrop-blur-sm"
      role="status"
      aria-live="polite"
      data-git-locate-banner={status.phase}
    >
      {status.phase === 'loading' ? (
        <LuLoader className="size-3.5 shrink-0 animate-spin text-accent" aria-hidden />
      ) : status.phase === 'ready' ? (
        <LuCheck className="size-3.5 shrink-0 text-ok" aria-hidden />
      ) : (
        <LuCircleAlert className="size-3.5 shrink-0 text-fail" aria-hidden />
      )}
      <span className="min-w-0 truncate font-medium">
        {status.phase === 'loading'
          ? t('git.history.locatingBranch', { target: status.target, hash: short })
          : status.phase === 'ready'
            ? t('git.history.locateReady', { target: status.target, hash: short })
            : t('git.history.locateNotFound', { hash: short })}
      </span>
      {status.phase === 'loading' ? (
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-medium text-ink-soft transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-ink"
        >
          {t('git.history.cancelLocate')}
        </button>
      ) : null}
      {status.phase === 'ready' ? (
        <button
          type="button"
          onClick={() => onJump(status.hash)}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent/25"
        >
          <span>{t('git.history.jumpToLocated')}</span>
          <LuArrowUpRight className="size-3" aria-hidden />
        </button>
      ) : null}
      {status.phase !== 'loading' ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('git.history.closeFind')}
          className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-ink-soft transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-ink"
        >
          <LuX className="size-3" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
