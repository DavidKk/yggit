import { stripLocalPrefix } from '@/lib/git/route-mode'

export const ALLOWED_AGENT_PATH_PREFIXES = ['/git', '/repo', '/workdesk', '/settings'] as const

export function isAllowedAgentPath(pathname: string): boolean {
  const clean = stripLocalPrefix(pathname.trim())
  return ALLOWED_AGENT_PATH_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`))
}
