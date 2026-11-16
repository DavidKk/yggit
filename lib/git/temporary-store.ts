'use client'

import { useEffect, useState } from 'react'

import { normalizeRemote } from '@/lib/git/identity'
import { remoteIdentity } from '@/lib/git/project-access'

export interface TemporaryRepo {
  id: string
  name: string
  remoteUrl: string
  fingerprint: string
  provider: 'github' | 'gitlab' | 'generic'
  defaultBranch?: string
  createdAt: number
}

const STORAGE_KEY = 'yggit.temporary_repos'
const CHANGE_EVENT = 'yggit:temporary_repos_changed'

export function parseRemoteUrl(raw: string): { name: string; remoteUrl: string; fingerprint: string; provider: 'github' | 'gitlab' | 'generic' } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Check if it's a URL or owner/repo format
  let url = trimmed
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('git@')) {
    // If shorthand like "facebook/react" or "DavidKk/yggit"
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      url = `https://github.com/${trimmed}`
    } else {
      return null
    }
  }

  const identity = normalizeRemote(url)
  if (!identity) return null
  const fingerprint = identity.key

  let provider: 'github' | 'gitlab' | 'generic' = 'generic'
  if (fingerprint.includes('github.com')) provider = 'github'
  else if (fingerprint.includes('gitlab.com') || fingerprint.includes('gitlab')) provider = 'gitlab'

  const name = identity.key.replace(/^[^/]+\//, '') || identity.name

  return {
    name,
    remoteUrl: identity.httpsUrl || url,
    fingerprint,
    provider,
  }
}

export function getTemporaryRepos(): TemporaryRepo[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveTemporaryRepos(list: TemporaryRepo[]) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    /* ignore session quota */
  }
}

export function addTemporaryRepo(input: {
  name: string
  remoteUrl: string
  fingerprint: string
  provider?: 'github' | 'gitlab' | 'generic'
  defaultBranch?: string
}): TemporaryRepo {
  const current = getTemporaryRepos()
  const existing = current.find((r) => remoteIdentity(r.remoteUrl) === remoteIdentity(input.remoteUrl))
  if (existing) return existing

  const newRepo: TemporaryRepo = {
    id: `temp_${input.fingerprint.replace(/[^a-zA-Z0-9_]/g, '_')}`,
    name: input.name,
    remoteUrl: input.remoteUrl,
    fingerprint: input.fingerprint,
    provider: input.provider || 'generic',
    defaultBranch: input.defaultBranch || 'main',
    createdAt: Date.now(),
  }

  const next = [newRepo, ...current]
  saveTemporaryRepos(next)
  return newRepo
}

export function removeTemporaryRepo(idOrFingerprint: string): void {
  const current = getTemporaryRepos()
  const next = current.filter((r) => r.id !== idOrFingerprint && r.fingerprint !== idOrFingerprint && r.remoteUrl !== idOrFingerprint)
  if (next.length !== current.length) {
    saveTemporaryRepos(next)
  }
}

export function findTemporaryRepo(idOrUrl: string): TemporaryRepo | null {
  const current = getTemporaryRepos()
  return current.find((r) => r.id === idOrUrl || r.remoteUrl === idOrUrl || r.fingerprint === idOrUrl) || null
}

export function isTemporaryRepoId(idOrPath: string): boolean {
  if (!idOrPath) return false
  if (idOrPath.startsWith('temp_')) return true
  if (idOrPath.startsWith('http://') || idOrPath.startsWith('https://')) return true
  return Boolean(findTemporaryRepo(idOrPath))
}

export function useTemporaryRepos(): TemporaryRepo[] {
  const [repos, setRepos] = useState<TemporaryRepo[]>([])

  useEffect(() => {
    setRepos(getTemporaryRepos())
    const handleUpdate = () => setRepos(getTemporaryRepos())
    window.addEventListener(CHANGE_EVENT, handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  return repos
}
