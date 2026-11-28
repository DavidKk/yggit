export type RouteDriverMode = 'edge' | 'local'

export const LOCAL_ROUTE_PREFIX = '/local'

function isCloudBuild(): boolean {
  return process.env.NEXT_PUBLIC_YGGIT_TARGET === 'cloud' || process.env.NEXT_PUBLIC_CHAYA_TARGET === 'cloud'
}

/**
 * Returns true when the given pathname targets the explicit `/local` namespace.
 */
export function isLocalModePathname(pathname?: string | null): boolean {
  const value = pathname?.trim() || ''
  return value === LOCAL_ROUTE_PREFIX || value.startsWith(`${LOCAL_ROUTE_PREFIX}/`)
}

/**
 * Resolve the driver mode strictly from a URL pathname.
 * Default paths (`/git`, `/workdesk`, `/settings`, `/`) use `edge`;
 * `/local/...` activates `local` unless running in a cloud-only build.
 */
export function driverModeFromPathname(pathname?: string | null): RouteDriverMode {
  if (isCloudBuild()) return 'edge'
  return isLocalModePathname(pathname) ? 'local' : 'edge'
}

/**
 * Remove any leading `/local` namespace prefix while preserving path, query, and hash.
 */
export function stripLocalPrefix(urlOrPath: string): string {
  const trimmed = urlOrPath.trim()
  if (!trimmed) return '/'
  if (trimmed === LOCAL_ROUTE_PREFIX) return '/'
  if (trimmed.startsWith(`${LOCAL_ROUTE_PREFIX}/`)) {
    return trimmed.slice(LOCAL_ROUTE_PREFIX.length) || '/'
  }
  if (trimmed.startsWith(`${LOCAL_ROUTE_PREFIX}?`) || trimmed.startsWith(`${LOCAL_ROUTE_PREFIX}#`)) {
    return `/${trimmed.slice(LOCAL_ROUTE_PREFIX.length)}`
  }
  return trimmed
}

/**
 * Prefix an internal workspace href with `/local` when `mode === 'local'`,
 * or strip `/local` when `mode === 'edge'`. External/API/static URLs pass through unchanged.
 */
export function withDriverModePath(href: string, mode: RouteDriverMode): string {
  const trimmed = href.trim()
  if (!trimmed) return mode === 'local' ? LOCAL_ROUTE_PREFIX : '/'

  if (/^(?:https?:|mailto:|tel:|\/\/)/i.test(trimmed) || trimmed.startsWith('/api/') || trimmed.startsWith('/_next/')) {
    return trimmed
  }

  const base = stripLocalPrefix(trimmed.startsWith('/') ? trimmed : `/${trimmed}`)
  if (mode !== 'local' || isCloudBuild()) {
    return base
  }
  if (base === '/') return LOCAL_ROUTE_PREFIX
  if (base.startsWith('/?') || base.startsWith('/#')) {
    return `${LOCAL_ROUTE_PREFIX}${base.slice(1)}`
  }
  return `${LOCAL_ROUTE_PREFIX}${base}`
}

/** Extract the repository slug segment from `/git/<slug>` or `/local/git/<slug>` paths. */
export function extractRepoSlugFromPathname(pathname?: string | null): string {
  const logical = stripLocalPrefix(pathname || '')
  if (!logical.startsWith('/git/')) return ''
  const match = logical.match(/^\/git\/(.+?)(?:\/(?:commit|branch|tag|blob|tree)\/|$)/)
  return match?.[1] || ''
}
