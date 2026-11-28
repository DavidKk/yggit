'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuChevronsUpDown, LuFlag } from 'react-icons/lu'

import { GIT_FIND_EVENT } from '@/components/git/gitFind'
import { GitProjectMenu } from '@/components/git/GitProjectMenu'
import { useGitProjectActions } from '@/components/git/hooks/useGitProjectActions'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Button, Spinner } from '@/components/sk'
import { getGitDriver, useModeHref } from '@/lib/git/driver'
import type { GitProjectView, GitSelection } from '@/lib/git/types'
import { cn } from '@/lib/utils'

const NOOP = () => {}
const NOOP_SELECTION = (_next: GitSelection) => {}

export function WorkdeskHeaderSwitcher() {
  const t = useT()
  const router = useRouter()
  const modeHref = useModeHref()
  const notification = useNotification()
  const [menuOpen, setMenuOpen] = useState(false)
  const [projects, setProjects] = useState<GitProjectView[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [searchRequest, setSearchRequest] = useState(0)
  const anchorRef = useRef<HTMLButtonElement>(null)

  const applyCatalog = useCallback((body: { projects?: GitProjectView[]; folders?: string[] }) => {
    if (Array.isArray(body.projects)) setProjects(body.projects)
    if (Array.isArray(body.folders)) setFolders(body.folders)
  }, [])

  const refreshProjects = useCallback(async () => {
    try {
      const cat = await getGitDriver().getProjects()
      applyCatalog(cat)
    } catch {
      // Ignore transient catalog refresh errors
    }
  }, [applyCatalog])

  useEffect(() => {
    void refreshProjects()
  }, [refreshProjects])

  // Support Cmd+F / Ctrl+F to open and focus project search in the switcher
  useEffect(() => {
    const onGitFind = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string } | undefined>).detail
      if (!detail || detail.target === 'project-switcher') {
        setMenuOpen(true)
        setSearchRequest((n) => n + 1)
      }
    }
    window.addEventListener(GIT_FIND_EVENT, onGitFind)
    return () => window.removeEventListener(GIT_FIND_EVENT, onGitFind)
  }, [])

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const navigateToProject = useCallback(
    async (path: string) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yggit:clear_searches', { detail: { repo: path } }))
      }
      router.push(modeHref(path ? `/git/${encodeURIComponent(path)}` : '/git'))
    },
    [modeHref, router]
  )

  const reportError = useMemo(
    () => (value: React.SetStateAction<string>) => {
      const msg = typeof value === 'function' ? value('') : value
      if (msg) notification.error(msg)
    },
    [notification]
  )

  const { chooseFolder, addRemote, createFolder, moveProject, deleteFolder, renameFolder, clearFolder, setProjectLabel, removeProject, cloneProject } = useGitProjectActions({
    view: null,
    scope: '',
    t,
    notification,
    applyCatalog,
    refreshProjects,
    closeMenu,
    load: navigateToProject,
    setPicking,
    setBusy,
    setProgressStage: NOOP,
    setError: reportError,
    setView: NOOP,
    setCommits: NOOP,
    setHasMore: NOOP,
    setSelection: NOOP_SELECTION,
    setSelectedHash: NOOP,
    setSelectedFile: NOOP,
  })

  return (
    <div data-git-find="project-switcher" className="relative min-w-0 inline-flex items-center">
      <Button
        ref={anchorRef}
        variant="plain"
        className={cn(
          'h-8 max-w-[16rem] justify-start gap-1.5 rounded-lg border-transparent bg-transparent px-2 font-normal text-ink',
          'hover:enabled:border-transparent hover:enabled:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:enabled:text-ink',
          menuOpen && 'bg-[color-mix(in_oklab,var(--ink)_9%,transparent)] hover:enabled:bg-[color-mix(in_oklab,var(--ink)_9%,transparent)]'
        )}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {busy || picking ? <Spinner className="size-3.5 shrink-0 text-accent" /> : <LuFlag className="size-3.5 shrink-0 text-accent" aria-hidden="true" />}
        <span className="min-w-0 truncate text-[0.8125rem] font-semibold">{t('workdesk.topbarTitle')}</span>
        <LuChevronsUpDown className="size-3.5 shrink-0 text-ink-soft" aria-hidden="true" />
      </Button>

      <GitProjectMenu
        open={menuOpen}
        anchorRef={anchorRef}
        currentPath=""
        activeWorkdesk
        projects={projects}
        folders={folders}
        busy={busy || picking}
        searchRequest={searchRequest}
        onClose={closeMenu}
        onOpen={(path) => {
          closeMenu()
          void navigateToProject(path)
        }}
        onAddLocal={() => void chooseFolder()}
        onAddRemote={addRemote}
        onClone={cloneProject}
        onCreateFolder={createFolder}
        onDeleteFolder={deleteFolder}
        onRenameFolder={renameFolder}
        onClearFolder={clearFolder}
        onSetProjectLabel={setProjectLabel}
        onRemoveProject={removeProject}
        onMoveProject={moveProject}
        onRefreshProjects={refreshProjects}
      />
    </div>
  )
}
