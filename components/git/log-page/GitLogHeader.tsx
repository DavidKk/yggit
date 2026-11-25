'use client'

import Link from 'next/link'
import { type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import { LuChevronsUpDown, LuCompass, LuFolderGit2, LuSettings } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { GitModeSwitcher } from '@/components/git/GitModeSwitcher'
import { GitProjectMenu } from '@/components/git/GitProjectMenu'
import { GitToolbar } from '@/components/git/GitToolbar'
import { repoName } from '@/components/git/log-page/gitLogUtils'
import type { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { WorkspaceHeaderSlot } from '@/components/layout/WorkspaceHeaderContext'
import { Button, Spinner, Tooltip } from '@/components/sk'
import { dropdownTriggerClass } from '@/components/sk/dropdownMenu'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import type { AddRemoteProjectOptions } from '@/lib/git/driver/types'
import { saveLastGitUrl } from '@/lib/git/last-git-url'
import type { GitLogView, GitProjectView } from '@/lib/git/types'
import { cn } from '@/lib/utils'

export function GitLogHeader({
  inWorkspace,
  view,
  viewRef,
  busy,
  picking,
  menuOpen,
  setMenuOpen,
  closeMenu,
  anchorRef,
  projectFindRef,
  projects,
  folders,
  projectSearchRequest,
  load,
  routerPush,
  chooseFolder,
  addRemote,
  cloneProject,
  createFolder,
  deleteFolder,
  renameFolder,
  clearFolder,
  setProjectLabel,
  removeProject,
  moveProject,
  refreshProjects,
  silentRefresh,
  t,
}: {
  inWorkspace: boolean
  view: GitLogView | null
  viewRef: MutableRefObject<GitLogView | null>
  busy: boolean
  picking: boolean
  menuOpen: boolean
  setMenuOpen: Dispatch<SetStateAction<boolean>>
  closeMenu: () => void
  anchorRef: RefObject<HTMLButtonElement | null>
  projectFindRef: RefObject<HTMLDivElement | null>
  projects: GitProjectView[]
  folders: string[]
  projectSearchRequest: number
  load: (repo: string) => Promise<void>
  routerPush: (href: string) => void
  chooseFolder: () => Promise<void>
  addRemote: (input: AddRemoteProjectOptions) => Promise<string>
  cloneProject: (project: GitProjectView) => Promise<string>
  createFolder: (name: string) => Promise<string>
  deleteFolder: (name: string) => Promise<{ error: string; removedCount?: number }>
  renameFolder: (oldName: string, newName: string) => Promise<string>
  clearFolder: (name: string) => Promise<string>
  setProjectLabel: (id: string, label: string) => Promise<string>
  removeProject: (id: string) => Promise<string>
  moveProject: (id: string, group: string, beforeId?: string) => Promise<string>
  refreshProjects: () => Promise<void>
  silentRefresh: () => Promise<void>
  t: ReturnType<typeof useT>
}) {
  const projectSwitcher = (
    <div ref={projectFindRef} data-git-find="project-switcher" className="relative min-w-0">
      <Tooltip content={view?.displayPath || view?.repo || t('git.header.pickRepo')} placement="bottom" suppressed={menuOpen || !view}>
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
          {busy ? <Spinner className="size-3.5 shrink-0 text-accent" /> : <LuFolderGit2 className="size-3.5 shrink-0 text-ink-soft" aria-hidden />}
          <span className="min-w-0 truncate text-[0.8125rem] font-semibold">
            {busy ? t('common.loading') : view ? repoName(view.repo, view.displayPath) : t('git.header.noRepo')}
          </span>
          <LuChevronsUpDown className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
        </Button>
      </Tooltip>
      <GitProjectMenu
        open={menuOpen}
        anchorRef={anchorRef}
        currentPath={view?.repo || ''}
        projects={projects}
        folders={folders}
        busy={busy || picking}
        searchRequest={projectSearchRequest}
        onClose={closeMenu}
        onOpen={(path) => {
          closeMenu()
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('yggit:clear_searches', { detail: { repo: path } }))
          }
          if (!path) {
            void load('')
            if (typeof window !== 'undefined' && window.location.pathname !== '/git') {
              routerPush('/git')
            }
          } else {
            void load(path)
          }
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

  const toolbar = (
    <div className="flex flex-1 items-center justify-center min-w-0">
      {view?.repo ? <GitToolbar repo={view.repo} currentBranch={view.head || view.branch} hasStashes={view.stashes.length > 0} disabled={busy} onRefresh={silentRefresh} /> : null}
    </div>
  )

  if (inWorkspace) {
    return (
      <WorkspaceHeaderSlot>
        {projectSwitcher}
        {toolbar}
      </WorkspaceHeaderSlot>
    )
  }

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-line bg-panel-2/60 px-3 py-1.5">
      <BrandLogo
        href="/git"
        className="shrink-0"
        markClassName="size-7"
        wordmarkClassName="text-[0.95rem]"
        onClick={(e) => {
          e.preventDefault()
          void load('')
          if (typeof window !== 'undefined' && window.location.pathname !== '/git') {
            window.history.pushState(null, '', '/git')
          }
        }}
      />
      <span className="h-4 w-px shrink-0 bg-[color-mix(in_oklab,var(--ink)_16%,transparent)]" aria-hidden />
      {projectSwitcher}
      {toolbar}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {process.env.NODE_ENV === 'development' && (
          <GitModeSwitcher
            currentRepo={view?.repo}
            currentName={view?.displayPath || (view?.repo ? repoName(view.repo, view.displayPath) : '')}
            currentRemoteUrl={view?.remoteUrl}
            onSwitchRepo={async (_nextMode, targetRepo) => {
              const repoToLoad = targetRepo || viewRef.current?.repo || ''
              if (repoToLoad) {
                await load(repoToLoad)
                void refreshProjects()
              }
            }}
          />
        )}
        {process.env.NODE_ENV === 'development' && (
          <Tooltip content={t('landing.studio.headerTip')} placement="bottom">
            <Link href="/dev/studio" className={cn(dropdownTriggerClass, 'px-2 gap-1.5 text-xs font-mono font-medium')} aria-label={t('landing.header.devStudio')}>
              <LuCompass className="size-3.5 text-accent shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t('landing.header.devStudio')}</span>
            </Link>
          </Tooltip>
        )}
        <span className="mx-0.5 h-3.5 w-px shrink-0 bg-[color-mix(in_oklab,var(--ink)_14%,transparent)]" aria-hidden />
        <ThemeSwitcher compact />
        <LocaleSwitcher compact />
        <Tooltip content={t('gitAgent.settingsTitle')} placement="bottom">
          <Link
            href="/settings/models"
            onClick={() => {
              if (typeof window !== 'undefined') {
                saveLastGitUrl(window.location.pathname + window.location.search)
              }
            }}
            className={cn(dropdownTriggerClass, 'px-2')}
            aria-label={t('gitAgent.settingsTitle')}
          >
            <LuSettings className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t('gitAgent.settingsTitle')}</span>
          </Link>
        </Tooltip>
      </div>
    </header>
  )
}
