'use client'

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'
import { LuCheck, LuChevronDown, LuFlag, LuFolderGit2, LuPlus } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { getGitDriver } from '@/lib/git/driver'
import { projectOpenTarget } from '@/lib/git/project-access'
import type { GitProjectView } from '@/lib/git/types'
import type { MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function WorkdeskHeaderSwitcher() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<GitProjectView[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getGitDriver()
      .getProjects()
      .then((cat) => setProjects(cat.projects || []))
      .catch(() => {})
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 text-xs font-semibold text-accent shadow-2xs transition-colors',
          'hover:bg-panel-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40'
        )}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <LuFlag className="size-3.5 text-accent" aria-hidden="true" />
        <span>{t('workdesk.topbarTitle')}</span>
        <LuChevronDown className={cn('size-3 text-ink-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-56 rounded-xl border border-line bg-panel p-1 shadow-lg">
          {/* Active Workdesk Selection */}
          <Link
            href="/workdesk"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-accent dark:bg-emerald-950/40"
          >
            <div className="flex items-center gap-2">
              <LuFlag className="size-3.5" aria-hidden="true" />
              <span>{t('workdesk.topbarTitle')}</span>
            </div>
            <LuCheck className="size-3.5" aria-hidden="true" />
          </Link>

          {/* Projects Divider & List */}
          {projects.length > 0 && (
            <div className="mt-1 flex flex-col border-t border-line/60 pt-1">
              <span className="px-2.5 py-1 text-[10px] font-semibold text-ink-muted">{t('workdesk.ui.switchSingleRepo' as MessageKey)}</span>
              <div className="max-h-48 overflow-y-auto">
                {projects.map((proj) => {
                  const target = projectOpenTarget(proj)
                  return (
                    <Link
                      key={proj.id}
                      href={target ? `/git/${encodeURIComponent(target)}` : '/git'}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-panel-2 dark:hover:bg-panel-2"
                    >
                      <LuFolderGit2 className="size-3.5 text-ink-muted" aria-hidden="true" />
                      <span className="truncate">{proj.label || proj.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Add project entry */}
          <div className="mt-1 border-t border-line/60 pt-1">
            <Link href="/git" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-ink-soft hover:bg-panel-2 hover:text-ink">
              <LuPlus className="size-3.5" aria-hidden="true" />
              <span>{t('workdesk.ui.addNewProject' as MessageKey)}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
