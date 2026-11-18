import { normalizeRemote } from './identity'

export type RemoteGroupProvider = 'github' | 'gitlab'
export type GroupRepository = { name: string; remoteKey: string; httpsUrl: string; host: RemoteGroupProvider }
export type RemoteGroupInput = { url: string; provider: RemoteGroupProvider; token?: string }

export function remoteGroupLocation(input: RemoteGroupInput) {
  if (input.provider !== 'gitlab' && input.provider !== 'github') throw new Error('REMOTE_GROUP_INVALID_PROVIDER')
  const url = new URL(input.url)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('REMOTE_GROUP_INVALID_URL')
  let group = url.pathname.replace(/^\/|\/$/g, '')
  if (input.provider === 'gitlab') group = group.replace(/^groups\//, '')
  if (!group || group.includes('/-/') || (input.provider === 'github' && group.includes('/'))) throw new Error('REMOTE_GROUP_INVALID_URL')
  const api = input.provider === 'gitlab' ? `${url.origin}/api/v4` : url.hostname === 'github.com' ? 'https://api.github.com' : `${url.origin}/api/v3`
  return { origin: url.origin, group, api }
}

/** Enumerate before writing the catalog so a failed page cannot create a partial import. */
export async function listRemoteGroup(input: RemoteGroupInput): Promise<GroupRepository[]> {
  const { origin, group, api } = remoteGroupLocation(input)
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (input.token) headers[input.provider === 'gitlab' ? 'PRIVATE-TOKEN' : 'Authorization'] = input.provider === 'gitlab' ? input.token : `Bearer ${input.token}`
  const repositories = new Map<string, GroupRepository>()
  const seenPages = new Set<string>()
  for (let page = 1; page <= 10000; page++) {
    const endpoint =
      input.provider === 'gitlab'
        ? `${api}/groups/${encodeURIComponent(group)}/projects?include_subgroups=true&with_shared=false&per_page=100&page=${page}`
        : `${api}/orgs/${encodeURIComponent(group)}/repos?type=all&per_page=100&page=${page}`
    let response: Response
    try {
      response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(30000) })
    } catch {
      throw new Error('REMOTE_GROUP_NETWORK_ERROR')
    }
    if (!response.ok) throw new Error(`REMOTE_GROUP_HTTP_${response.status}`)
    const data: unknown = await response.json()
    if (!Array.isArray(data)) throw new Error('REMOTE_GROUP_INVALID_RESPONSE')
    if (!data.length) return [...repositories.values()]
    const signature = JSON.stringify(data.map((row) => row?.id))
    if (seenPages.has(signature)) throw new Error('REMOTE_GROUP_REPEATED_PAGE')
    seenPages.add(signature)
    for (const row of data) {
      const raw = input.provider === 'gitlab' ? row?.http_url_to_repo : row?.clone_url
      if (!row || typeof raw !== 'string' || typeof row.name !== 'string') throw new Error('REMOTE_GROUP_INVALID_RESPONSE')
      const url = new URL(raw)
      if (url.origin !== origin || url.protocol !== 'https:' || url.username || url.password) throw new Error('REMOTE_GROUP_INVALID_RESPONSE')
      const remote = normalizeRemote(raw)
      if (!remote) throw new Error('REMOTE_GROUP_INVALID_RESPONSE')
      repositories.set(remote.key, { name: row.name, remoteKey: remote.key, httpsUrl: url.href, host: input.provider })
    }
    const next = response.headers.get('x-next-page')
    const links = response.headers.get('link')
    if (next === '' || (links !== null && !/rel="next"/.test(links)) || (next === null && links === null && data.length < 100)) return [...repositories.values()]
  }
  throw new Error('REMOTE_GROUP_PAGE_LIMIT')
}
