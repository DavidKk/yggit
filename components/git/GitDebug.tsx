'use client'

import { useMemo } from 'react'

import { type DebugRegistration, useDebugMenuRegistration } from '@/components/debug/registry'
import {
  setGitUiDebugHoldExploreLoading,
  setGitUiDebugHoldGapLoading,
  setGitUiDebugPreviewGapStrip,
  useGitUiDebugHoldExploreLoading,
  useGitUiDebugHoldGapLoading,
  useGitUiDebugPreviewGapStrip,
} from '@/components/git/git-ui-debug'
import { useT } from '@/components/i18n/LocaleProvider'

/** Dev-only: debug menu toggles for explore loading and segmented gap row previews. */
export function GitDebug() {
  const t = useT()
  const holdExplore = useGitUiDebugHoldExploreLoading()
  const previewGap = useGitUiDebugPreviewGapStrip()
  const holdGapLoading = useGitUiDebugHoldGapLoading()

  const registration = useMemo<DebugRegistration>(
    () => ({
      id: 'git:ui',
      title: t('debug.gitTitle'),
      actions: [
        {
          id: 'explore-loading',
          label: t('debug.gitExploreLoading'),
          active: holdExplore,
          run: () => setGitUiDebugHoldExploreLoading(!holdExplore),
        },
        {
          id: 'gap-preview',
          label: t('debug.gitGapPreview'),
          active: previewGap,
          run: () => setGitUiDebugPreviewGapStrip(!previewGap),
        },
        {
          id: 'gap-loading',
          label: t('debug.gitGapLoading'),
          active: holdGapLoading,
          run: () => setGitUiDebugHoldGapLoading(!holdGapLoading),
        },
      ],
    }),
    [holdExplore, previewGap, holdGapLoading, t]
  )

  useDebugMenuRegistration(registration)
  return null
}
