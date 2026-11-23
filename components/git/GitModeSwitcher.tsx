'use client'

import { useRouter } from 'next/navigation'
import { LuGlobe, LuTerminal } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Tooltip } from '@/components/sk'
import { getGitDriver, useGitDriver } from '@/lib/git/driver'
import { normalizeRemote } from '@/lib/git/identity'
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
  const router = useRouter()
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
      if (!nameIdent && window.location.pathname.startsWith('/git/')) {
        const parts = window.location.pathname
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
        // 1. By project name
        if (nameIdent && p.name && p.name.toLowerCase() === nameIdent.toLowerCase()) return true
        if (repoBasename && p.name && p.name.toLowerCase() === repoBasename.toLowerCase()) return true
        // 2. By localPath / id / folder basename
        if (repoIdent) {
          if (p.localPath === repoIdent || p.id === repoIdent) return true
          const pBasename = (p.localPath || p.id || '').split(/[/\\]/).filter(Boolean).pop() || ''
          if (repoBasename && pBasename && pBasename.toLowerCase() === repoBasename.toLowerCase()) return true
        }
        if (nameIdent) {
          if (p.id?.toLowerCase() === nameIdent.toLowerCase()) return true
          if (p.localPath?.toLowerCase().endsWith(`/${nameIdent.toLowerCase()}`)) return true
        }
        // 3. By normalized remote URL
        if (remoteIdent) {
          const kTarget = normalizeRemote(remoteIdent)?.key?.toLowerCase()
          if (kTarget) {
            if (p.httpsUrl && normalizeRemote(p.httpsUrl)?.key?.toLowerCase() === kTarget) return true
            if (p.remotes?.some((r) => normalizeRemote(r.url)?.key?.toLowerCase() === kTarget)) return true
          }
        }
        return false
      })

      // Invalidate caches in both drivers to guarantee freshly synchronized repository content
      targetDriver.clearCache?.()
      const currentDriver = getGitDriver(isEdge ? 'edge' : 'local')
      currentDriver.clearCache?.()

      setMode(nextMode)

      if (match) {
        const nextRepo = nextMode === 'local' ? match.localPath || match.id : match.id || match.localPath || match.name
        const nextUrl = match.id ? `/git/${match.id}` : `/git?repo=${encodeURIComponent(nextRepo)}`
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', nextUrl)
        }
        if (onSwitchRepo) {
          await onSwitchRepo(nextMode, nextRepo)
        } else {
          router.push(nextUrl)
        }
      } else {
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/git')
        }
        if (onSwitchRepo) {
          await onSwitchRepo(nextMode, '')
        } else {
          router.push('/git')
        }
      }
    } catch {
      setMode(nextMode)
      if (onSwitchRepo) {
        await onSwitchRepo(nextMode, '')
      } else {
        router.push('/git')
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
