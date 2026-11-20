'use client'

import { useEffect, useState } from 'react'

import { getGitDriver } from '@/lib/git/driver'
import type { GitBlameLine } from '@/lib/git/driver/types'

const blameCache = new Map<string, Record<number, GitBlameLine>>()

export function useGitBlame(repo?: string, path?: string, hash?: string): Record<number, GitBlameLine> {
  const [blameMap, setBlameMap] = useState<Record<number, GitBlameLine>>(() => {
    if (!repo || !path) return {}
    return blameCache.get(`${repo}:${hash || ''}:${path}`) || {}
  })

  useEffect(() => {
    if (!repo || !path) {
      setBlameMap({})
      return
    }
    const cacheKey = `${repo}:${hash || ''}:${path}`
    const cached = blameCache.get(cacheKey)
    if (cached) {
      setBlameMap(cached)
      return
    }

    let active = true
    const driver = getGitDriver()
    driver
      .readBlame({ repo, path, hash })
      .then((map) => {
        if (!active) return
        blameCache.set(cacheKey, map)
        setBlameMap(map)
      })
      .catch(() => {
        if (!active) return
        setBlameMap({})
      })

    return () => {
      active = false
    }
  }, [repo, path, hash])

  return blameMap
}
