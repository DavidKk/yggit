'use client'

import { useMemo } from 'react'

import { type DebugRegistration, useDebugMenuRegistration } from '@/components/debug/registry'
import { useT } from '@/components/i18n/LocaleProvider'
import { setBrowserAiDebugOverride, useBrowserAiDebugOverride } from '@/lib/agent/browser-ai-debug'

/** Dev-only: registers Browser AI state simulation actions in the global DebugMenu floating ball. */
export function BrowserAiDebug() {
  const t = useT()
  const mode = useBrowserAiDebugOverride()

  const registration = useMemo<DebugRegistration>(
    () => ({
      id: 'agent:browser-ai',
      title: t('gitAgent.debugBrowserAiTitle') || 'Browser AI',
      actions: [
        {
          id: 'browser-ai-downloadable',
          label: t('gitAgent.debugBrowserAiDownloadable') || '模拟未安装（可下载）',
          active: mode === 'downloadable',
          run: () => setBrowserAiDebugOverride(mode === 'downloadable' ? 'real' : 'downloadable'),
        },
        {
          id: 'browser-ai-unavailable',
          label: t('gitAgent.debugBrowserAiUnavailable') || '模拟设备不可用',
          active: mode === 'unavailable',
          run: () => setBrowserAiDebugOverride(mode === 'unavailable' ? 'real' : 'unavailable'),
        },
        {
          id: 'browser-ai-unsupported',
          label: t('gitAgent.debugBrowserAiUnsupported') || '模拟浏览器不支持',
          active: mode === 'unsupported',
          run: () => setBrowserAiDebugOverride(mode === 'unsupported' ? 'real' : 'unsupported'),
        },
      ],
    }),
    [mode, t]
  )

  useDebugMenuRegistration(registration)
  return null
}
