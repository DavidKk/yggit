'use client'

import { useMemo } from 'react'

import { type DebugRegistration, useDebugMenuRegistration } from '@/components/debug/registry'
import { setGitUiDebugHoldExploreLoading, useGitUiDebugHoldExploreLoading } from '@/components/git/git-ui-debug'
import { useT } from '@/components/i18n/LocaleProvider'

/** Dev-only: one toggle for the explore-strip loading preview. */
export function GitDebug() {
  const t = useT()
  const hold = useGitUiDebugHoldExploreLoading()

  const registration = useMemo<DebugRegistration>(
    () => ({
      id: 'git:ui',
      title: t('debug.gitTitle'),
      actions: [
        {
          id: 'explore-loading',
          label: t('debug.gitExploreLoading'),
          active: hold,
          run: () => setGitUiDebugHoldExploreLoading(!hold),
        },
      ],
    }),
    [hold, t]
  )

  useDebugMenuRegistration(registration)
  return null
}
