'use client'

import { useEffect, useMemo, useState } from 'react'

import { getBrowserAiAvailability } from '@/lib/agent/browser-ai'
import { getLocalModelSpec, inspectLocalModelCache, isLocalModelMarkedReady } from '@/lib/agent/local-models'
import type { AgentModelProfile } from '@/lib/agent/model-profiles'
import { useBrowserDownloads } from '@/lib/downloads/browser-downloads'

/**
 * Tracks whether each profile's local browser runtime (browser-ai / browser-local)
 * is actually ready to use. Cloud/API/CLI profiles are always considered ready here.
 */
export function useLocalProfileReadiness(profiles: AgentModelProfile[]): Record<string, boolean> {
  const downloads = useBrowserDownloads()
  const [asyncMap, setAsyncMap] = useState<Record<string, boolean>>({})

  const activeDownloadIds = useMemo(() => {
    const ids = new Set<string>()
    for (const d of downloads) {
      if (d.status === 'running') {
        ids.add(d.id)
      }
    }
    return ids
  }, [downloads])

  const profileSignature = useMemo(() => profiles.map((p) => `${p.id}:${p.config.provider}:${p.config.model}`).join('|'), [profiles])

  useEffect(() => {
    let cancelled = false

    const localProfiles = profiles.filter((p) => p.config.provider === 'browser-local' || p.config.provider === 'browser-ai')
    if (localProfiles.length === 0) return

    void (async () => {
      const next: Record<string, boolean> = {}
      const hasAi = localProfiles.some((p) => p.config.provider === 'browser-ai')
      let aiAvailable = false
      if (hasAi) {
        const res = await getBrowserAiAvailability().catch(() => ({ status: 'unsupported' as const }))
        aiAvailable = res.status === 'available'
      }

      for (const p of localProfiles) {
        if (p.config.provider === 'browser-ai') {
          next[p.id] = aiAvailable && !activeDownloadIds.has('browser-ai:gemini-nano')
        } else {
          const spec = getLocalModelSpec(p.config.model)
          const isDownloading = activeDownloadIds.has(`browser-local:${spec.id}`)
          if (isDownloading) {
            next[p.id] = false
          } else if (isLocalModelMarkedReady(spec.id)) {
            const info = await inspectLocalModelCache(spec.repository)
            next[p.id] = info.fileCount > 0
          } else {
            const info = await inspectLocalModelCache(spec.repository)
            next[p.id] = info.fileCount > 0 && info.bytes >= spec.estimatedBytes * 0.75
          }
        }
      }

      if (!cancelled) {
        setAsyncMap(next)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [profileSignature, activeDownloadIds, profiles])

  return useMemo(() => {
    const result: Record<string, boolean> = {}
    for (const p of profiles) {
      const provider = p.config.provider
      if (provider !== 'browser-local' && provider !== 'browser-ai') {
        result[p.id] = true
        continue
      }
      if (provider === 'browser-local') {
        const spec = getLocalModelSpec(p.config.model)
        if (activeDownloadIds.has(`browser-local:${spec.id}`)) {
          result[p.id] = false
          continue
        }
      }
      if (p.id in asyncMap) {
        result[p.id] = asyncMap[p.id]
      } else if (provider === 'browser-local') {
        const spec = getLocalModelSpec(p.config.model)
        result[p.id] = isLocalModelMarkedReady(spec.id)
      } else {
        result[p.id] = false
      }
    }
    return result
  }, [profiles, asyncMap, activeDownloadIds])
}
