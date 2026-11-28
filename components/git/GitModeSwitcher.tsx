'use client'

import { LuGlobe, LuTerminal } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk'
import { getGitDriver, useGitDriver } from '@/lib/git/driver'
import { normalizeRemote } from '@/lib/git/identity'
import { stripLocalPrefix, withDriverModePath } from '@/lib/git/route-mode'
import { logInfo } from '@/lib/logger'
import { cn } from '@/lib/utils'

export function GitModeSwitcher({
  className,
  currentRepo,
  currentName,
  currentRemoteUrl,
  onSwitchRepo,
}: {
  className?: string
  currentRepo?: string
  currentName?: string
  currentRemoteUrl?: string
  onSwitchRepo?: (targetMode: 'edge' | 'local', targetRepo: string) => void | Promise<void>
}) {
  const t = useT()
  const { setMode, isEdge } = useGitDriver()

  const toggleMode = async () => {
    const nextMode: 'edge' | 'local' = isEdge ? 'local' : 'edge'

    // Determine current repository identification
    let repoIdent = currentRepo?.trim() || ''
    let nameIdent = currentName?.trim() || ''
    let remoteIdent = currentRemoteUrl?.trim() || ''

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (!remoteIdent && url.searchParams.get('remote')) {
        remoteIdent = url.searchParams.get('remote') || ''
      }
      if (!repoIdent && url.searchParams.get('repo')) {
        repoIdent = url.searchParams.get('repo') || ''
      }
      const logicalPath = stripLocalPrefix(window.location.pathname)
      if (!nameIdent && logicalPath.startsWith('/git/')) {
        const parts = logicalPath
          .replace(/^\/git\//, '')
          .split('/')
          .filter(Boolean)
        if (parts.length > 0) {
          nameIdent = parts[parts.length - 1]
        }
      }
    }

    try {
      const targetDriver = getGitDriver(nextMode)
      const catalog = await targetDriver.getProjects().catch(() => ({ projects: [] }))
      const targetProjects = catalog.projects || []

      // Look for a matching project in target mode
      const repoBasename = repoIdent ? repoIdent.split(/[/\\]/).filter(Boolean).pop() || '' : ''
      const match = targetProjects.find((p) => {
        if (nameIdent && p.name && p.name.toLowerCase() === nameIdent.toLowerCase()) return true
        if (repoBasename && p.name && p.name.toLowerCase() === repoBasename.toLowerCase()) return true
        if (repoIdent) {
          if (p.localPath === repoIdent || p.id === repoIdent) return true
          const pBasename = (p.localPath || p.id || '').split(/[/\\]/).filter(Boolean).pop() || ''
          if (repoBasename && pBasename && pBasename.toLowerCase() === repoBasename.toLowerCase()) return true
        }
        if (nameIdent) {
          if (p.id?.toLowerCase() === nameIdent.toLowerCase()) return true
          if (p.localPath?.toLowerCase().endsWith(`/${nameIdent.toLowerCase()}`)) return true
        }
        if (remoteIdent) {
          const kTarget = normalizeRemote(remoteIdent)?.key?.toLowerCase()
          if (kTarget) {
            if (p.httpsUrl && normalizeRemote(p.httpsUrl)?.key?.toLowerCase() === kTarget) return true
            if (p.remotes?.some((r) => normalizeRemote(r.url)?.key?.toLowerCase() === kTarget)) return true
          }
        }
        return false
      })

      targetDriver.clearCache?.()
      const currentDriver = getGitDriver(isEdge ? 'edge' : 'local')
      currentDriver.clearCache?.()

      const nextRepo = match ? (nextMode === 'local' ? match.localPath || match.id : match.id || match.localPath || match.name) : repoIdent || currentRepo || nameIdent || ''
      let nextUrl = withDriverModePath('/git', nextMode)
      if (typeof window !== 'undefined') {
        const logicalPath = stripLocalPrefix(window.location.pathname)
        if (logicalPath.startsWith('/settings') || logicalPath.startsWith('/privacy') || logicalPath.startsWith('/workdesk') || logicalPath.startsWith('/import')) {
          nextUrl = withDriverModePath(`${logicalPath}${window.location.search}`, nextMode)
        } else if (logicalPath.startsWith('/git/') && !logicalPath.startsWith('/git/edge_')) {
          // Keep current canonical repository route seamlessly across mode switches
          nextUrl = withDriverModePath(`${logicalPath}${window.location.search}`, nextMode)
        } else if (match) {
          const base = match.id ? `/git/${match.id}` : `/git?repo=${encodeURIComponent(nextRepo)}`
          nextUrl = withDriverModePath(base, nextMode)
        }
      }

      logInfo('system', `Switched git driver mode to ${nextMode.toUpperCase()}`, {
        from: isEdge ? 'edge' : 'local',
        to: nextMode,
        targetRepo: nextRepo || undefined,
        nextUrl,
      })

      if (typeof window !== 'undefined' && `${window.location.pathname}${window.location.search}` !== nextUrl) {
        // Hard-navigate across /local <-> Edge URL prefixes so Local SSE/timers tear down cleanly before Edge mounts.
        window.location.assign(nextUrl)
        return
      }

      setMode(nextMode, { targetRepo: nextRepo, targetUrl: nextUrl })

      if (onSwitchRepo) {
        await onSwitchRepo(nextMode, nextRepo)
      }
    } catch {
      const fallbackUrl = withDriverModePath('/git', nextMode)
      if (typeof window !== 'undefined' && window.location.pathname !== fallbackUrl && !stripLocalPrefix(window.location.pathname).startsWith('/settings')) {
        window.location.assign(fallbackUrl)
        return
      }
      setMode(nextMode, { targetRepo: '', targetUrl: fallbackUrl })
      if (onSwitchRepo) {
        await onSwitchRepo(nextMode, '')
      }
    }
  }

  const tooltipText = isEdge ? t('git.driver.modeEdgeTip') : t('git.driver.modeLocalTip')
  const label = isEdge ? t('git.driver.modeEdge') : t('git.driver.modeLocal')

  return (
    <Tooltip content={tooltipText} placement="bottom">
      <button
        type="button"
        onClick={() => void toggleMode()}
        aria-label={label}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-all duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-accent select-none',
          isEdge ? 'border-accent/30 bg-accent/10 text-accent hover:bg-accent/15' : 'border-ok/30 bg-ok/10 text-ok hover:bg-ok/15',
          className
        )}
      >
        {isEdge ? <LuGlobe className="size-3.5 shrink-0" aria-hidden /> : <LuTerminal className="size-3.5 shrink-0" aria-hidden />}
        <span>{label}</span>
      </button>
    </Tooltip>
  )
}
