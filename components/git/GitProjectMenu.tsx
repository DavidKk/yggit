'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AiOutlineCloudSync } from 'react-icons/ai'
import { LuCheck, LuChevronDown, LuChevronRight, LuFlag, LuFolder, LuFolderGit2, LuGlobe, LuHardDrive, LuPencil, LuTrash2 } from 'react-icons/lu'
import { TbFolderPlus } from 'react-icons/tb'

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { GIT_FIND_EVENT } from '@/components/git/gitFind'
import { GIT_SEARCH_DROPDOWN_ATTR, GitSearchDropdown } from '@/components/git/GitSearchDropdown'
import { buildFolderContextItems, buildProjectContextItems } from '@/components/git/project-menu/projectMenuContextItems'
import { ProjectMenuModals, RemotesListPopover, type RemotesMenuAnchor } from '@/components/git/project-menu/ProjectMenuDialogs'
import { ProjectMenuItemRow } from '@/components/git/project-menu/ProjectMenuItemRow'
import { TemporaryReposSection } from '@/components/git/project-menu/TemporaryReposSection'
import { type GitProjectMenuProps } from '@/components/git/project-menu/types'
import { useProjectDragDrop } from '@/components/git/project-menu/useProjectDragDrop'
import { FloatingMenu, type FloatingMenuItem } from '@/components/git/RefChipsCell'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, EmptyState, ScrollArea } from '@/components/sk'
import { copyToClipboard } from '@/lib/clipboard'
import { useGitDriver } from '@/lib/git/driver'
import { hasSavedRemote, projectOpenTarget, projectSource, remoteIdentity } from '@/lib/git/project-access'
import { addTemporaryRepo, parseRemoteUrl, removeTemporaryRepo, type TemporaryRepo, useTemporaryRepos } from '@/lib/git/temporary-store'
import type { GitProjectView } from '@/lib/git/types'
import { isRecordBoolean, useGitUiPref } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'

/** Internal default group identifiers used for persistence and initial state. */
const DEFAULT_GROUP_WORK = '工作项目'
const DEFAULT_GROUP_PERSONAL = '个人项目'
const DEFAULT_GROUP_UNGROUPED = '未分类'

export function GitProjectMenu({
  open,
  anchorRef,
  currentPath,
  projects,
  folders,
  busy,
  onClose,
  onOpen,
  onAddLocal,
  onAddRemote,
  onClone,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onClearFolder,
  onSetProjectLabel,
  onRemoveProject,
  onMoveProject,
  onRefreshProjects,
  searchRequest = 0,
  activeWorkdesk = false,
}: GitProjectMenuProps) {
  const t = useT()
  const { isEdge } = useGitDriver()
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useGitUiPref(
    'projectMenu.openGroups',
    { [DEFAULT_GROUP_WORK]: true, [DEFAULT_GROUP_PERSONAL]: true } as Record<string, boolean>,
    isRecordBoolean
  )
  const [remoteOpen, setRemoteOpen] = useState(false)
  const [bindingRemoteProject, setBindingRemoteProject] = useState<GitProjectView | null>(null)
  const [bindRemoteBusy, setBindRemoteBusy] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [cloneTarget, setCloneTarget] = useState<GitProjectView | null>(null)
  const [importGroup, setImportGroup] = useState(false)
  const [groupProvider, setGroupProvider] = useState<'github' | 'gitlab'>('gitlab')
  const [targetFolder, setTargetFolder] = useState('')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [token, setToken] = useState('')
  const [tokenUnlocked, setTokenUnlocked] = useState(true)
  const [syncAccount, setSyncAccount] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldInvalid, setFieldInvalid] = useState<{ url?: boolean; token?: boolean; folder?: boolean }>({})
  const [searchMenuOpen, setSearchMenuOpen] = useState(false)
  const [folderDeleting, setFolderDeleting] = useState(false)
  const [remotesMenuAnchor, setRemotesMenuAnchor] = useState<RemotesMenuAnchor | null>(null)
  const notify = useNotification()
  const [contextMenu, setContextMenu] = useState<{
    anchor: { x: number; y: number }
    ariaLabel: string
    items: FloatingMenuItem[]
  } | null>(null)
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [renameFolderDraft, setRenameFolderDraft] = useState('')
  const [editingLabelProjectId, setEditingLabelProjectId] = useState<string | null>(null)
  const [projectLabelDraft, setProjectLabelDraft] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const folderComposingRef = useRef(false)
  const urlId = useId()
  const tokenId = useId()
  const syncId = useId()
  const folderId = useId()
  const formErrorId = useId()

  const copyValue = async (value: string) => {
    const ok = await copyToClipboard(value)
    if (ok) notify.success(t('common.copied') || 'Copied')
    else notify.error(t('common.copyFailed') || 'Copy failed')
  }

  const startRenameFolder = (group: string) => {
    setEditingFolder(group)
    setRenameFolderDraft(group)
  }

  const commitRenameFolder = async (oldName: string) => {
    const next = renameFolderDraft.trim()
    setEditingFolder(null)
    if (!next || next === oldName || !onRenameFolder) return
    const errorMsg = await onRenameFolder(oldName, next)
    if (errorMsg) {
      notify.error(errorMsg)
    } else {
      setOpenGroups((prev) => {
        const copy = { ...prev }
        delete copy[oldName]
        copy[next] = true
        return copy
      })
    }
  }

  const commitProjectLabel = async (id: string) => {
    const next = projectLabelDraft.trim()
    setEditingLabelProjectId(null)
    if (!onSetProjectLabel) return
    const errorMsg = await onSetProjectLabel(id, next)
    if (errorMsg) {
      notify.error(errorMsg)
    }
  }

  const handleFolderContextMenu = (e: React.MouseEvent, group: string) => {
    e.preventDefault()
    e.stopPropagation()
    const expanded = openGroups[group] !== false
    const itemsInGroup = projects.filter((p) => p.group === group)
    const items = buildFolderContextItems({
      group,
      expanded,
      itemsInGroup,
      t,
      notify,
      copyValue,
      startRenameFolder,
      onToggleExpand: (grp, next) => setOpenGroups((prev) => ({ ...prev, [grp]: next })),
      onClearFolder,
      requestDeleteFolder,
    })
    setContextMenu({ anchor: { x: e.clientX, y: e.clientY }, ariaLabel: group, items })
  }

  const requestRemoveProject = async (project: GitProjectView) => {
    if (!onRemoveProject) return
    setFolderDeleting(true)
    try {
      await confirm({
        title: t('git.project.removeProjectConfirm', { name: project.label || project.name }),
        description: t('git.project.removeProjectHint'),
        confirmLabel: t('git.project.removeProject'),
        confirmVariant: 'fail',
        onConfirm: async () => {
          const message = await onRemoveProject(project.id)
          if (message) {
            notify.error(message)
            throw new Error(message)
          }
          const target = projectOpenTarget(project)
          if (target && (target === currentPath || remoteIdentity(target) === remoteIdentity(currentPath)))
            onOpen(
              projects
                .filter((item) => item.id !== project.id)
                .map(projectOpenTarget)
                .find(Boolean) || ''
            )
        },
      })
    } finally {
      setFolderDeleting(false)
    }
  }

  const handleProjectContextMenu = (e: React.MouseEvent, project: GitProjectView) => {
    e.preventDefault()
    e.stopPropagation()
    const items = buildProjectContextItems({
      project,
      isEdge,
      t,
      copyValue,
      onEditLabel: (proj) => {
        setEditingLabelProjectId(proj.id)
        setProjectLabelDraft(proj.label || '')
      },
      onOpenLocalFolder: (localPath) => handleOpenLocalFolder(e, localPath),
      onRequestRemoveProject: requestRemoveProject,
      canRemove: Boolean(onRemoveProject),
    })
    setContextMenu({ anchor: { x: e.clientX, y: e.clientY }, ariaLabel: project.label || project.name, items })
  }

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null)
          return
        }
        if (remotesMenuAnchor) {
          setRemotesMenuAnchor(null)
          return
        }
        if (!remoteOpen && !cloneTarget && !folderOpen && !folderDeleting && !searchMenuOpen) onClose()
      }
    }
    function onPointer(event: PointerEvent) {
      if (contextMenu) {
        setContextMenu(null)
      }
      if (remotesMenuAnchor) {
        const target = event.target as Element | null
        if (!target?.closest('[data-remotes-popover="true"]')) {
          setRemotesMenuAnchor(null)
        }
      }
      if (remoteOpen || cloneTarget || folderOpen || folderDeleting) return
      const target = event.target as Node | null
      if (!target) return
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      if (target instanceof Element && target.closest(`[${GIT_SEARCH_DROPDOWN_ATTR}]`)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [anchorRef, cloneTarget, contextMenu, folderDeleting, folderOpen, onClose, open, remoteOpen, remotesMenuAnchor, searchMenuOpen])

  useEffect(() => {
    if (folderOpen) folderRef.current?.focus()
  }, [folderOpen])

  useEffect(() => {
    if (open) return
    setQuery('')
    setSearchMenuOpen(false)
    setRemotesMenuAnchor(null)
  }, [open])

  useEffect(() => {
    if (!open || !searchRequest) return
    const panel = panelRef.current
    if (!panel) return
    const frame = window.requestAnimationFrame(() => {
      panel.dispatchEvent(new CustomEvent(GIT_FIND_EVENT, { bubbles: false }))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, searchRequest])

  const needle = query.trim().toLowerCase()
  const listed = useMemo(() => {
    if (!needle) return projects
    return projects.filter((project) => `${project.name} ${projectSource(project)}`.toLowerCase().includes(needle))
  }, [needle, projects])

  const visibleFolders = useMemo(() => {
    if (!needle) return folders
    return folders.filter((folder) => listed.some((project) => project.group === folder))
  }, [folders, listed, needle])

  const temporaryRepos = useTemporaryRepos()
  const parsedRemoteInput = useMemo(() => parseRemoteUrl(query), [query])
  const [favoriteLoadingId, setFavoriteLoadingId] = useState<string | null>(null)
  const [temporaryExpanded, setTemporaryExpanded] = useState(true)

  const listedTemporary = useMemo(() => {
    return temporaryRepos.filter((repo) => !hasSavedRemote(projects, repo.remoteUrl) && (!needle || `${repo.name} ${repo.remoteUrl}`.toLowerCase().includes(needle)))
  }, [needle, projects, temporaryRepos])

  const handleFavoriteTemporary = async (temp: TemporaryRepo) => {
    setFavoriteLoadingId(temp.id)
    try {
      await onAddRemote({ url: temp.remoteUrl })
      removeTemporaryRepo(temp.id)
    } finally {
      setFavoriteLoadingId(null)
    }
  }

  const handleRemoveTemporary = (temp: TemporaryRepo) => {
    setFolderDeleting(true)
    void confirm({
      title: t('git.project.removeProjectConfirm', { name: temp.name }),
      description: t('git.project.removeProjectHint'),
      confirmLabel: t('git.project.removeProject'),
      confirmVariant: 'fail',
      onConfirm: () => {
        removeTemporaryRepo(temp.id)
        if (currentPath === temp.remoteUrl || currentPath === temp.id) {
          const fallback = projects.map(projectOpenTarget).find(Boolean) || ''
          onOpen(fallback)
        }
      },
    }).finally(() => setFolderDeleting(false))
  }

  const handleOpenTarget = useCallback(
    (targetPath: string) => {
      setQuery('')
      setSearchMenuOpen(false)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yggit:clear_searches', { detail: { repo: targetPath } }))
      }
      onOpen(targetPath)
      onClose()
    },
    [onOpen, onClose]
  )

  const handleOpenRemoteTemporary = (parsed: ReturnType<typeof parseRemoteUrl>) => {
    if (!parsed) return
    const temp = addTemporaryRepo(parsed)
    handleOpenTarget(temp.remoteUrl)
    onClose()
  }

  const closeRemoteModal = useCallback(() => {
    setRemoteOpen(false)
    setFormError('')
    setFieldInvalid({})
    setRemoteUrl('')
    setToken('')
    setTokenUnlocked(true)
    setSyncAccount(false)
  }, [])

  const closeFolderModal = useCallback(() => {
    setFolderOpen(false)
    setFolderName('')
    setFormError('')
    setFieldInvalid({})
  }, [])

  const handleOpenLocalFolder = async (e: React.MouseEvent, localPath?: string) => {
    e.stopPropagation()
    if (!localPath) return
    try {
      await fetch('/api/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: localPath }),
      })
    } catch {
      // Gracefully fall back to badge indicator
    }
  }

  async function submitFolder() {
    setFormError('')
    const name = folderName.trim()
    if (!name) {
      setFieldInvalid({ folder: true })
      setFormError(t('git.project.errFolderName'))
      folderRef.current?.focus()
      return
    }
    const message = await onCreateFolder(name)
    if (message) {
      setFieldInvalid({ folder: true })
      setFormError(message)
      folderRef.current?.focus()
      return
    }
    setOpenGroups((prev) => ({ ...prev, [name]: true }))
    closeFolderModal()
  }

  async function submitRemote() {
    setFormError('')
    const url = remoteUrl.trim()
    const nextInvalid = {
      url: !url,
      token: !importGroup && syncAccount && !token.trim(),
      folder: importGroup && !targetFolder.trim(),
    }
    setFieldInvalid(nextInvalid)
    if (nextInvalid.url) {
      setFormError(t('git.project.errRepoUrl'))
      urlRef.current?.focus()
      return
    }
    if (nextInvalid.token) {
      setFormError(t('git.project.errTokenRequired'))
      document.getElementById(tokenId)?.focus()
      return
    }
    if (nextInvalid.folder) {
      setFormError(t('git.project.targetFolder'))
      return
    }
    const message = await onAddRemote({
      url,
      importGroup,
      provider: importGroup ? groupProvider : undefined,
      group: importGroup ? targetFolder.trim() : undefined,
      token: token.trim() || undefined,
      syncAccount: !importGroup && syncAccount,
    })
    if (message) {
      setFormError(importGroup ? t(message.includes('REMOTE_GROUP_EMPTY') ? 'git.project.importGroupEmpty' : 'git.project.importGroupFailed') : message)
      ;(syncAccount || token.trim() ? document.getElementById(tokenId) : urlRef.current)?.focus()
      return
    }
    closeRemoteModal()
  }

  const {
    dropTarget,
    setDropTarget,
    draggingId,
    expandGroupRef,
    clearExpandTimer,
    onProjectDragStart,
    onProjectDragEnd,
    onListDragOver,
    onFolderHeaderDragOver,
    onFolderBodyDragOver,
    onProjectDragOver,
    commitDrop,
  } = useProjectDragDrop({
    listScrollRef,
    openGroups,
    setOpenGroups,
    listed,
    projects,
    onMoveProject,
    setFormError,
  })

  async function requestDeleteFolder(group: string) {
    const count = projects.filter((project) => project.group === group).length
    setFolderDeleting(true)
    try {
      await confirm({
        title: t('git.project.deleteFolderConfirmTitle', { name: group }),
        description: count > 0 ? t('git.project.deleteFolderConfirmWithProjects', { count }) : t('git.project.deleteFolderConfirmEmpty'),
        confirmLabel: t('git.project.delete'),
        confirmVariant: 'fail',
        onConfirm: async () => {
          const result = await onDeleteFolder(group)
          if (result.error) throw new Error(result.error)
          setOpenGroups((prev) => {
            const next = { ...prev }
            delete next[group]
            return next
          })
        },
      })
    } finally {
      setFolderDeleting(false)
    }
  }

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('git.project.switcher')}
      data-git-find="project-menu"
      className="absolute top-full left-0 z-[70] mt-2 flex min-h-[20rem] max-h-[32rem] w-[24rem] flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-lg"
    >
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-2">
        <h2 className="m-0 min-w-0 flex-1 truncate px-1 text-xs font-medium whitespace-nowrap text-ink">{t('git.project.switcher')}</h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="plain"
            size="icon"
            className="size-7 shrink-0"
            aria-label={t('git.project.addLocal')}
            tooltip={t('git.project.addLocalTip')}
            disabled={busy}
            onClick={onAddLocal}
          >
            <LuHardDrive className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="plain"
            size="icon"
            className="size-7 shrink-0"
            aria-label={t('git.project.addRemote')}
            tooltip={t('git.project.addRemoteTip')}
            disabled={busy}
            onClick={() => {
              setImportGroup(false)
              setRemoteOpen(true)
            }}
          >
            <AiOutlineCloudSync className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="plain"
            size="icon"
            className="size-7 shrink-0"
            aria-label={t('git.project.addRemoteGroup')}
            tooltip={t('git.project.addRemoteGroup')}
            disabled={busy}
            onClick={() => {
              setImportGroup(true)
              setRemoteUrl('')
              setTargetFolder(folders[0] || '')
              setFormError('')
              setRemoteOpen(true)
            }}
          >
            <LuFolderGit2 className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="plain"
            size="icon"
            className="size-7 shrink-0"
            aria-label={t('git.project.newFolder')}
            tooltip={t('git.project.newFolderTip')}
            disabled={busy}
            onClick={() => setFolderOpen(true)}
          >
            <TbFolderPlus className="size-3.5" aria-hidden />
          </Button>
          <GitSearchDropdown
            className="mr-0 size-7"
            label={t('git.project.searchProjects')}
            placeholder={t('git.project.searchName')}
            value={query}
            onChange={setQuery}
            onOpenChange={setSearchMenuOpen}
          />
        </div>
      </div>
      {/* 工作台入口 (Workdesk Entry) */}
      {!query && (
        <div className="border-b border-line p-1">
          <Link
            href="/workdesk"
            data-workdesk-entry="true"
            onClick={onClose}
            className={cn(
              'flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-xs font-semibold transition-colors cursor-pointer no-underline',
              activeWorkdesk ? 'bg-emerald-500/10 text-accent dark:bg-emerald-950/40' : 'text-ink hover:bg-panel-2'
            )}
          >
            <span className="flex items-center gap-2">
              <LuFlag className="size-3.5 text-accent" aria-hidden="true" />
              {t('workdesk.topbarTitle') || '工作台'}
            </span>
            {activeWorkdesk ? <LuCheck className="size-3.5 shrink-0 text-accent" aria-hidden="true" /> : null}
          </Link>
        </div>
      )}
      {parsedRemoteInput ? (
        <div className="border-b border-line bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] p-1.5">
          <Button
            variant="plain"
            className="h-8 w-full justify-start gap-2 px-2 text-xs font-medium text-accent hover:enabled:bg-[color-mix(in_oklab,var(--accent)_20%,transparent)]"
            onClick={() => handleOpenRemoteTemporary(parsedRemoteInput)}
          >
            <LuGlobe className="size-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate text-left">
              {t('git.project.openRemoteTemporary')}: <strong className="font-semibold text-ink">{parsedRemoteInput.name}</strong>
            </span>
          </Button>
        </div>
      ) : null}
      {visibleFolders.length === 0 && projects.length === 0 && temporaryRepos.length === 0 ? (
        <EmptyState className="min-h-0 flex-1" title={t('git.project.noProjects')} message={t('git.project.noProjectsMsg')} hint={t('git.project.noProjectsHint')} />
      ) : listed.length === 0 && listedTemporary.length === 0 && needle && !parsedRemoteInput ? (
        <EmptyState className="min-h-0 flex-1" title={t('git.project.noMatches')} message={t('git.project.noMatchesMsg')} />
      ) : (
        <ScrollArea className="min-h-0 flex-1" reserveGutter={false} scrollRef={listScrollRef} scrollProps={{ onDragOver: onListDragOver }}>
          {listedTemporary.length > 0 ? (
            <TemporaryReposSection
              listedTemporary={listedTemporary}
              temporaryExpanded={temporaryExpanded}
              setTemporaryExpanded={setTemporaryExpanded}
              currentPath={currentPath}
              favoriteLoadingId={favoriteLoadingId}
              onOpenTarget={handleOpenTarget}
              onClose={onClose}
              onFavoriteTemporary={handleFavoriteTemporary}
              onRemoveTemporary={handleRemoveTemporary}
              t={t}
            />
          ) : null}
          {visibleFolders.map((group) => {
            const items = listed.filter((project) => project.group === group)
            if (needle && items.length === 0) return null
            const expanded = Boolean(needle) || openGroups[group] !== false
            const droppingFolder = dropTarget?.group === group && dropTarget.beforeId === null && !expanded
            const droppingBody = dropTarget?.group === group && dropTarget.beforeId === null && expanded
            const groupCount = needle ? items.length : projects.filter((project) => project.group === group).length
            return (
              <section
                key={group}
                className={cn('pb-2', (droppingFolder || droppingBody) && 'bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]')}
                onDragOver={(event) => (expanded ? onFolderBodyDragOver(event, group) : onFolderHeaderDragOver(event, group))}
                onDragLeave={() => {
                  if (expandGroupRef.current === group) clearExpandTimer()
                  setDropTarget((prev) => (prev?.group === group && prev.beforeId === null ? null : prev))
                }}
                onDrop={(event) => void commitDrop(event, { group, beforeId: null })}
              >
                <div
                  className={cn('group/grp flex h-8 w-full items-center hover:bg-[var(--overlay-06)]', droppingFolder && 'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]')}
                  onDragOver={(event) => onFolderHeaderDragOver(event, group)}
                  onDrop={(event) => void commitDrop(event, { group, beforeId: null })}
                  onContextMenu={(e) => handleFolderContextMenu(e, group)}
                >
                  {editingFolder === group ? (
                    <div className="flex h-8 min-w-0 flex-1 items-center px-2">
                      <input
                        autoFocus
                        type="text"
                        value={renameFolderDraft}
                        className="h-6 min-w-0 flex-1 rounded border border-accent bg-paper px-2 text-xs text-ink outline-none focus:ring-1 focus:ring-accent"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameFolderDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void commitRenameFolder(group)
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            setEditingFolder(null)
                          }
                        }}
                        onBlur={() => {
                          void commitRenameFolder(group)
                        }}
                      />
                    </div>
                  ) : (
                    <Button
                      variant="plain"
                      className="h-8 min-w-0 flex-1 justify-start gap-1.5 px-2 font-normal text-ink-soft hover:enabled:bg-transparent"
                      aria-expanded={expanded}
                      onClick={() => setOpenGroups((prev) => ({ ...prev, [group]: !(prev[group] !== false) }))}
                    >
                      {expanded ? <LuChevronDown className="size-3.5 shrink-0" aria-hidden /> : <LuChevronRight className="size-3.5 shrink-0" aria-hidden />}
                      <LuFolder className="size-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate whitespace-nowrap text-left">
                        {group === DEFAULT_GROUP_WORK
                          ? t('git.project.folderWork') || 'Work Projects'
                          : group === DEFAULT_GROUP_PERSONAL
                            ? t('git.project.folderPersonal') || 'Personal Projects'
                            : group === DEFAULT_GROUP_UNGROUPED
                              ? t('git.project.folderUngrouped') || 'Ungrouped'
                              : group}
                      </span>
                      <Badge tone="neutral" size="mini" dot={false} className="shrink-0">
                        {groupCount}
                      </Badge>
                    </Button>
                  )}
                  {editingFolder !== group ? (
                    <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover/grp:opacity-100 transition-opacity">
                      <Button
                        variant="plain"
                        size="icon"
                        className="size-6 shrink-0 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-accent"
                        aria-label={t('git.project.renameFolder') || 'Rename folder'}
                        tooltip={t('git.project.renameFolder') || 'Rename folder'}
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation()
                          startRenameFolder(group)
                        }}
                      >
                        <LuPencil className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="plain"
                        size="icon"
                        className="size-6 shrink-0 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-fail"
                        aria-label={t('git.project.deleteFolderAria', { name: group })}
                        tooltip={t('git.project.deleteFolderTip')}
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation()
                          void requestDeleteFolder(group)
                        }}
                      >
                        <LuTrash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </div>
                {expanded
                  ? items.map((project, index) => (
                      <ProjectMenuItemRow
                        key={project.id}
                        project={project}
                        group={group}
                        isLast={index === items.length - 1}
                        currentPath={currentPath}
                        isEdge={isEdge}
                        busy={busy}
                        draggingId={draggingId}
                        dropTarget={dropTarget}
                        editingLabelProjectId={editingLabelProjectId}
                        setEditingLabelProjectId={setEditingLabelProjectId}
                        projectLabelDraft={projectLabelDraft}
                        setProjectLabelDraft={setProjectLabelDraft}
                        commitProjectLabel={commitProjectLabel}
                        remotesMenuAnchor={remotesMenuAnchor}
                        setRemotesMenuAnchor={setRemotesMenuAnchor}
                        setCloneTarget={setCloneTarget}
                        setBindingRemoteProject={setBindingRemoteProject}
                        onOpenTarget={handleOpenTarget}
                        onOpenLocalFolder={handleOpenLocalFolder}
                        onRemoveProject={Boolean(onRemoveProject)}
                        requestRemoveProject={requestRemoveProject}
                        onProjectDragOver={onProjectDragOver}
                        commitDrop={commitDrop}
                        onProjectDragStart={onProjectDragStart}
                        onProjectDragEnd={onProjectDragEnd}
                        onProjectContextMenu={handleProjectContextMenu}
                        t={t}
                      />
                    ))
                  : null}
                {expanded && items.length === 0 ? (
                  <EmptyState density="compact" className="px-2 py-3" title={t('git.project.folderEmpty')} message={t('git.project.folderEmptyMsg')} />
                ) : null}
              </section>
            )
          })}
        </ScrollArea>
      )}
      {remotesMenuAnchor ? <RemotesListPopover remotesMenuAnchor={remotesMenuAnchor} setRemotesMenuAnchor={setRemotesMenuAnchor} t={t} /> : null}
      {contextMenu ? (
        <FloatingMenu anchor={contextMenu.anchor} ariaLabel={contextMenu.ariaLabel} color="var(--accent)" onClose={() => setContextMenu(null)} items={contextMenu.items} />
      ) : null}
      <ProjectMenuModals
        busy={busy}
        t={t}
        notify={notify}
        currentPath={currentPath}
        folders={folders}
        onOpen={onOpen}
        onClone={onClone}
        onRefreshProjects={onRefreshProjects}
        folderOpen={folderOpen}
        closeFolderModal={closeFolderModal}
        submitFolder={submitFolder}
        folderId={folderId}
        folderRef={folderRef}
        folderName={folderName}
        setFolderName={setFolderName}
        folderComposingRef={folderComposingRef}
        remoteOpen={remoteOpen}
        closeRemoteModal={closeRemoteModal}
        submitRemote={submitRemote}
        importGroup={importGroup}
        setImportGroup={setImportGroup}
        syncAccount={syncAccount}
        setSyncAccount={setSyncAccount}
        urlId={urlId}
        urlRef={urlRef}
        remoteUrl={remoteUrl}
        setRemoteUrl={setRemoteUrl}
        tokenId={tokenId}
        tokenUnlocked={tokenUnlocked}
        setTokenUnlocked={setTokenUnlocked}
        token={token}
        setToken={setToken}
        groupProvider={groupProvider}
        setGroupProvider={setGroupProvider}
        targetFolder={targetFolder}
        setTargetFolder={setTargetFolder}
        syncId={syncId}
        cloneTarget={cloneTarget}
        setCloneTarget={setCloneTarget}
        setRemoteOpen={setRemoteOpen}
        bindingRemoteProject={bindingRemoteProject}
        setBindingRemoteProject={setBindingRemoteProject}
        bindRemoteBusy={bindRemoteBusy}
        setBindRemoteBusy={setBindRemoteBusy}
        fieldInvalid={fieldInvalid}
        setFieldInvalid={setFieldInvalid}
        formError={formError}
        setFormError={setFormError}
        formErrorId={formErrorId}
      />
    </div>
  )
}
