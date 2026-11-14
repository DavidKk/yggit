import { createHash } from 'node:crypto'

import type { GitProjectHost } from '@/lib/git/types'

export const GIT_LOG_PAGE_SIZE = 40

export type RemoteIdentity = {
  key: string
  host: string
  kind: Exclude<GitProjectHost, 'local'>
  name: string
  httpsUrl: string
}

export function projectId(key: string): string {
  return createHash('sha1').update(key).digest('hex').slice(0, 16)
}

export function hostKind(host: string): Exclude<GitProjectHost, 'local'> {
  const name = host.toLowerCase()
  if (name === 'github.com' || name.endsWith('.github.com')) return 'github'
  return 'gitlab'
}

/** One canonical key for ssh, https, and credentialed URLs of the same repo. */
export function normalizeRemote(raw: string): RemoteIdentity | null {
  const input = raw.trim()
  if (!input) return null
  let host = ''
  let pathName = ''
  if (input.startsWith('git@') && input.includes(':')) {
    const rest = input.slice('git@'.length)
    const colon = rest.indexOf(':')
    host = rest.slice(0, colon)
    pathName = rest.slice(colon + 1)
  } else if (input.includes('://')) {
    try {
      const url = new URL(input)
      host = url.hostname
      pathName = url.pathname.replace(/^\//, '')
    } catch {
      return null
    }
  } else return null
  host = host.toLowerCase()
  pathName = pathName.replace(/\.git$/i, '').replace(/\/+$/, '')
  if (!host || !pathName || pathName.includes('..')) return null
  const name = pathName.split('/').filter(Boolean).pop() || pathName
  const kind = hostKind(host)
  return { key: `${host}/${pathName}`, host, kind, name, httpsUrl: `https://${host}/${pathName}.git` }
}
