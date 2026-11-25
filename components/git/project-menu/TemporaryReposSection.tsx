'use client'

import type { Dispatch, SetStateAction } from 'react'
import { LuChevronDown, LuChevronRight, LuClock3, LuCloud, LuGlobe, LuStar, LuX } from 'react-icons/lu'
import { TbCloudLock } from 'react-icons/tb'

import { HostIcon } from '@/components/git/project-menu/ProjectMenuItemRow'
import type { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, Tooltip } from '@/components/sk'
import { extractProjectRemotes, getRemoteCloudType } from '@/lib/git/project-access'
import type { TemporaryRepo } from '@/lib/git/temporary-store'
import { cn } from '@/lib/utils'

export function TemporaryReposSection({
  listedTemporary,
  temporaryExpanded,
  setTemporaryExpanded,
  currentPath,
  favoriteLoadingId,
  onOpenTarget,
  onClose,
  onFavoriteTemporary,
  onRemoveTemporary,
  t,
}: {
  listedTemporary: TemporaryRepo[]
  temporaryExpanded: boolean
  setTemporaryExpanded: Dispatch<SetStateAction<boolean>>
  currentPath: string
  favoriteLoadingId: string | null
  onOpenTarget: (target: string) => void
  onClose: () => void
  onFavoriteTemporary: (temp: TemporaryRepo) => Promise<void>
  onRemoveTemporary: (temp: TemporaryRepo) => void
  t: ReturnType<typeof useT>
}) {
  return (
    <section className="mb-2 border-b border-line pb-2">
      <div className="flex h-8 w-full items-center hover:bg-[var(--overlay-06)]">
        <Button
          variant="plain"
          className="h-8 min-w-0 flex-1 justify-start gap-1.5 px-2 font-normal text-ink-soft hover:enabled:bg-transparent"
          aria-expanded={temporaryExpanded}
          onClick={() => setTemporaryExpanded((prev) => !prev)}
        >
          {temporaryExpanded ? <LuChevronDown className="size-3.5 shrink-0" aria-hidden /> : <LuChevronRight className="size-3.5 shrink-0" aria-hidden />}
          <LuGlobe className="size-3.5 text-accent" aria-hidden />
          <span className="min-w-0 truncate whitespace-nowrap text-left">{t('git.project.temporary')}</span>
          <Badge tone="neutral" size="mini" dot={false} className="shrink-0">
            {listedTemporary.length}
          </Badge>
        </Button>
      </div>
      {temporaryExpanded
        ? listedTemporary.map((temp) => {
            const current = currentPath === temp.remoteUrl || currentPath === temp.id
            const isFavoriting = favoriteLoadingId === temp.id
            const tempRemotes = extractProjectRemotes({
              id: temp.id,
              name: temp.name,
              group: '',
              host: temp.provider === 'generic' ? 'local' : temp.provider,
              localPath: '',
              httpsUrl: temp.remoteUrl,
              local: false,
              remote: true,
              authorized: false,
            })
            const tempCloudType = getRemoteCloudType(tempRemotes)
            return (
              <div key={temp.id} className="group/temp relative flex h-8 w-full items-center pr-1 hover:bg-[var(--overlay-06)]">
                <Button
                  variant="plain"
                  aria-current={current ? 'true' : undefined}
                  className={cn(
                    'h-8 min-w-0 flex-1 justify-start gap-1.5 rounded-none px-2 pl-7 font-normal text-ink',
                    current && 'bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] hover:enabled:bg-[color-mix(in_oklab,var(--accent)_24%,transparent)]'
                  )}
                  onClick={() => {
                    onOpenTarget(temp.remoteUrl)
                    onClose()
                  }}
                >
                  <HostIcon host={temp.provider} />
                  <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">{temp.name}</span>
                  <Tooltip content={t('git.project.temporaryBadge')}>
                    <span className="flex size-5 shrink-0 items-center justify-center text-ink-soft" aria-label={t('git.project.temporaryBadge')} tabIndex={0}>
                      <LuClock3 className="size-3.5" aria-hidden />
                    </span>
                  </Tooltip>
                </Button>
                <div className="flex shrink-0 items-center gap-0.5 opacity-80 group-hover/temp:opacity-100">
                  {tempCloudType === 'single-private' ? (
                    <Tooltip content={t('git.project.privateRemoteTooltip', { name: tempRemotes[0].name }) || `Private remote: ${tempRemotes[0].name} · Click to open`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(tempRemotes[0].webUrl, '_blank')
                        }}
                        className="flex size-6 cursor-pointer items-center justify-center rounded text-warn transition-colors hover:bg-warn/15 hover:text-warn/80"
                        aria-label={t('git.project.privateRemoteAria', { name: tempRemotes[0].name }) || `Private remote: ${tempRemotes[0].name}`}
                      >
                        <TbCloudLock className="size-3.5 text-warn" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  ) : tempCloudType === 'single-public' ? (
                    <Tooltip content={t('git.project.publicRemoteTooltip', { name: tempRemotes[0].name }) || `Public remote: ${tempRemotes[0].name} · Click to open`}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(tempRemotes[0].webUrl, '_blank')
                        }}
                        className="flex size-6 cursor-pointer items-center justify-center rounded text-accent transition-colors hover:bg-accent/15 hover:text-[color-mix(in_oklab,var(--accent)_80%,black)]"
                        aria-label={t('git.project.publicRemoteAria', { name: tempRemotes[0].name }) || `Public remote: ${tempRemotes[0].name}`}
                      >
                        <LuCloud className="size-3.5 text-accent" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  ) : null}
                  <Button
                    variant="plain"
                    size="mini"
                    className="size-6 text-warn hover:bg-warn/15"
                    aria-label={t('git.project.favoriteProject')}
                    tooltip={t('git.project.favoriteProject')}
                    loading={isFavoriting}
                    onClick={(e) => {
                      e.stopPropagation()
                      void onFavoriteTemporary(temp)
                    }}
                  >
                    <LuStar className="size-3.5 fill-warn/30 text-warn" aria-hidden />
                  </Button>
                  <Button
                    variant="plain"
                    size="mini"
                    className="size-6 text-ink-soft hover:bg-[var(--overlay-08)] hover:text-fail"
                    aria-label={t('git.project.removeTemporary')}
                    tooltip={t('git.project.removeTemporary')}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveTemporary(temp)
                    }}
                  >
                    <LuX className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            )
          })
        : null}
    </section>
  )
}
