'use client'

import { type DragEvent, type RefObject, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AiOutlineCloudSync } from 'react-icons/ai'
import { LuChevronDown, LuChevronRight, LuCloud, LuFolder, LuGithub, LuGitlab, LuGlobe, LuHardDrive, LuStar, LuTrash2, LuX } from 'react-icons/lu'
import { TbFolderPlus } from 'react-icons/tb'

const FOLDER_EXPAND_MS = 450
const AUTO_SCROLL_EDGE = 36
const AUTO_SCROLL_MAX = 18

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { GIT_FIND_EVENT } from '@/components/git/gitFind'
import { GIT_SEARCH_DROPDOWN_ATTR, GitSearchDropdown } from '@/components/git/GitSearchDropdown'
import { useT } from '@/components/i18n/LocaleProvider'
import { formControl, formDesc, formField, formFieldInlineDense, formTitle, formTitleInline } from '@/components/layoutClasses'
import { ApiKeyInput, Badge, Button, EmptyState, Modal, ScrollArea, SwitchToggle, TextInput } from '@/components/sk'
import { addTemporaryRepo, parseRemoteUrl, removeTemporaryRepo, useTemporaryRepos, type TemporaryRepo } from '@/lib/git/temporary-store'
import type { GitProjectHost, GitProjectView } from '@/lib/git/types'
import { isRecordBoolean, useGitUiPref } from '@/lib/git/ui-prefs'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  currentPath: string
  projects: GitProjectView[]
  folders: string[]
  busy: boolean
  onClose: () => void
  onOpen: (path: string) => void
  onAddLocal: () => void
  onAddRemote: (input: { url: string; token?: string; syncAccount?: boolean }) => Promise<string>
  onClone: (project: GitProjectView) => Promise<string>
  onCreateFolder: (name: string) => Promise<string>
  onDeleteFolder: (name: string) => Promise<{ error: string; removedCount?: number }>
  onMoveProject: (id: string, group: string, beforeId?: string) => Promise<string>
  /** Bump to open the project search field (Cmd+F from the switcher). */
  searchRequest?: number
}

type DropTarget = { group: string; beforeId: string | null }

const PROJECT_MIME = 'application/x-yggdrasil-project-id'

function HostIcon({ host }: { host: GitProjectHost | 'generic' }) {
  if (host === 'github') return <LuGithub className="size-3.5 shrink-0 text-ink" aria-hidden />
  if (host === 'gitlab') return <LuGitlab className="size-3.5 shrink-0 text-ink" aria-hidden />
  if (host === 'generic') return <LuGlobe className="size-3.5 shrink-0 text-accent" aria-hidden />
  return <LuHardDrive className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
}

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
  onMoveProject,
  searchRequest = 0,
}: Props) {
  const t = useT()
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useGitUiPref('projectMenu.openGroups', { 工作项目: true, 个人项目: true } as Record<string, boolean>, isRecordBoolean)
  const [remoteOpen, setRemoteOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [cloneTarget, setCloneTarget] = useState<GitProjectView | null>(null)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [token, setToken] = useState('')
  const [tokenUnlocked, setTokenUnlocked] = useState(true)
  const [syncAccount, setSyncAccount] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldInvalid, setFieldInvalid] = useState<{ url?: boolean; token?: boolean; folder?: boolean }>({})
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [draggingId, setDraggingId] = useState('')
  const [searchMenuOpen, setSearchMenuOpen] = useState(false)
  const [folderDeleting, setFolderDeleting] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const expandTimerRef = useRef<number | null>(null)
  const expandGroupRef = useRef('')
  const autoExpandedRef = useRef<Set<string>>(new Set())
  const dropHandledRef = useRef(false)
  const scrollRafRef = useRef(0)
  const scrollDirRef = useRef(0)
  const urlId = useId()
  const tokenId = useId()
  const syncId = useId()
  const folderId = useId()
  const formErrorId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !remoteOpen && !cloneTarget && !folderOpen && !folderDeleting && !searchMenuOpen) onClose()
    }
    function onPointer(event: PointerEvent) {
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
  }, [anchorRef, cloneTarget, folderDeleting, folderOpen, onClose, open, remoteOpen, searchMenuOpen])

  useEffect(() => {
    if (folderOpen) folderRef.current?.focus()
  }, [folderOpen])

  useEffect(() => {
    if (open) return
    setQuery('')
    setSearchMenuOpen(false)
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
    return projects.filter((project) => project.name.toLowerCase().includes(needle))
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
    if (!needle) return temporaryRepos
    return temporaryRepos.filter((t) => t.name.toLowerCase().includes(needle) || t.remoteUrl.toLowerCase().includes(needle))
  }, [needle, temporaryRepos])

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
    removeTemporaryRepo(temp.id)
    if (currentPath === temp.remoteUrl || currentPath === temp.id) {
      const fallback = projects[0]?.localPath || ''
      onOpen(fallback)
    }
  }

  const handleOpenRemoteTemporary = (parsed: ReturnType<typeof parseRemoteUrl>) => {
    if (!parsed) return
    const temp = addTemporaryRepo(parsed)
    onOpen(temp.remoteUrl)
    setQuery('')
    onClose()
  }

  function closeRemoteModal() {
    setRemoteOpen(false)
    setFormError('')
    setFieldInvalid({})
    setRemoteUrl('')
    setToken('')
    setTokenUnlocked(true)
    setSyncAccount(false)
  }

  function closeFolderModal() {
    setFolderOpen(false)
    setFolderName('')
    setFormError('')
    setFieldInvalid({})
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
      token: syncAccount && !token.trim(),
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
    const message = await onAddRemote({
      url,
      token: token.trim() || undefined,
      syncAccount,
    })
    if (message) {
      setFormError(message)
      ;(syncAccount || token.trim() ? document.getElementById(tokenId) : urlRef.current)?.focus()
      return
    }
    closeRemoteModal()
  }

  function clearExpandTimer() {
    if (expandTimerRef.current != null) {
      window.clearTimeout(expandTimerRef.current)
      expandTimerRef.current = null
    }
    expandGroupRef.current = ''
  }

  function stopAutoScroll() {
    scrollDirRef.current = 0
    if (scrollRafRef.current) {
      window.cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = 0
    }
  }

  function tickAutoScroll() {
    const node = listScrollRef.current
    const dir = scrollDirRef.current
    if (!node || !dir) {
      scrollRafRef.current = 0
      return
    }
    node.scrollTop += dir
    scrollRafRef.current = window.requestAnimationFrame(tickAutoScroll)
  }

  function updateAutoScroll(clientY: number) {
    const node = listScrollRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const topDist = clientY - rect.top
    const bottomDist = rect.bottom - clientY
    let next = 0
    if (topDist < AUTO_SCROLL_EDGE) {
      next = -Math.max(2, Math.round(((AUTO_SCROLL_EDGE - topDist) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX))
    } else if (bottomDist < AUTO_SCROLL_EDGE) {
      next = Math.max(2, Math.round(((AUTO_SCROLL_EDGE - bottomDist) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX))
    }
    scrollDirRef.current = next
    if (next && !scrollRafRef.current) scrollRafRef.current = window.requestAnimationFrame(tickAutoScroll)
    if (!next) stopAutoScroll()
  }

  function isProjectDrag(event: DragEvent) {
    return Boolean(draggingId) || [...event.dataTransfer.types].includes(PROJECT_MIME) || [...event.dataTransfer.types].includes('text/plain')
  }

  function scheduleFolderExpand(group: string) {
    if (openGroups[group] !== false) {
      clearExpandTimer()
      return
    }
    if (expandGroupRef.current === group) return
    clearExpandTimer()
    expandGroupRef.current = group
    expandTimerRef.current = window.setTimeout(() => {
      autoExpandedRef.current.add(group)
      setOpenGroups((prev) => ({ ...prev, [group]: true }))
      expandTimerRef.current = null
      expandGroupRef.current = ''
    }, FOLDER_EXPAND_MS)
  }

  function collapseAutoExpanded(except?: string) {
    if (autoExpandedRef.current.size === 0) return
    const closing = [...autoExpandedRef.current].filter((group) => group !== except)
    autoExpandedRef.current = new Set()
    if (closing.length === 0) return
    setOpenGroups((prev) => {
      const next = { ...prev }
      for (const group of closing) next[group] = false
      return next
    })
  }

  function onProjectDragStart(event: DragEvent<HTMLButtonElement>, id: string) {
    event.dataTransfer.setData(PROJECT_MIME, id)
    event.dataTransfer.setData('text/plain', id)
    event.dataTransfer.effectAllowed = 'move'
    dropHandledRef.current = false
    setDraggingId(id)
    autoExpandedRef.current = new Set()
  }

  function onProjectDragEnd() {
    clearExpandTimer()
    stopAutoScroll()
    if (!dropHandledRef.current) collapseAutoExpanded()
    dropHandledRef.current = false
    setDraggingId('')
    setDropTarget(null)
  }

  function onListDragOver(event: DragEvent<HTMLElement>) {
    if (!isProjectDrag(event)) return
    updateAutoScroll(event.clientY)
  }

  function onFolderHeaderDragOver(event: DragEvent<HTMLElement>, group: string) {
    if (!isProjectDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    updateAutoScroll(event.clientY)
    setDropTarget({ group, beforeId: null })
    scheduleFolderExpand(group)
  }

  function onFolderBodyDragOver(event: DragEvent<HTMLElement>, group: string) {
    if (!isProjectDrag(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    updateAutoScroll(event.clientY)
    clearExpandTimer()
    setDropTarget((prev) => (prev?.group === group && prev.beforeId === null ? prev : { group, beforeId: null }))
  }

  function onProjectDragOver(event: DragEvent<HTMLElement>, group: string, projectId: string) {
    if (!isProjectDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    updateAutoScroll(event.clientY)
    clearExpandTimer()
    if (projectId === draggingId) {
      setDropTarget(null)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const beforeHalf = event.clientY < rect.top + rect.height / 2
    const items = listed.filter((project) => project.group === group)
    const index = items.findIndex((project) => project.id === projectId)
    let beforeId = beforeHalf ? projectId : items[index + 1]?.id || null
    if (beforeId === draggingId) {
      const dragIndex = items.findIndex((project) => project.id === draggingId)
      beforeId = items[dragIndex + 1]?.id || null
    }
    setDropTarget({ group, beforeId })
  }

  async function commitDrop(event: DragEvent<HTMLElement>, fallback?: DropTarget) {
    event.preventDefault()
    event.stopPropagation()
    clearExpandTimer()
    stopAutoScroll()
    const id = event.dataTransfer.getData(PROJECT_MIME) || event.dataTransfer.getData('text/plain') || draggingId
    const target = dropTarget || fallback
    setDropTarget(null)
    setDraggingId('')
    if (!id || !target) return
    const project = projects.find((item) => item.id === id)
    if (!project) return
    if (target.beforeId === id) return
    if (project.group === target.group) {
      const siblings = projects.filter((item) => item.group === target.group)
      const from = siblings.findIndex((item) => item.id === id)
      const to = target.beforeId ? siblings.findIndex((item) => item.id === target.beforeId) : siblings.length
      if (from < 0 || to < 0) return
      const insertAt = to > from ? to - 1 : to
      if (insertAt === from) return
    }
    dropHandledRef.current = true
    collapseAutoExpanded(target.group)
    setOpenGroups((prev) => ({ ...prev, [target.group]: true }))
    const message = await onMoveProject(id, target.group, target.beforeId || undefined)
    if (message) setFormError(message)
  }

  useEffect(() => {
    return () => {
      clearExpandTimer()
      stopAutoScroll()
    }
  }, [])

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
            onClick={() => setRemoteOpen(true)}
          >
            <AiOutlineCloudSync className="size-3.5" aria-hidden />
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
      ) : listed.length === 0 && temporaryRepos.length === 0 && needle && !parsedRemoteInput ? (
        <EmptyState className="min-h-0 flex-1" title={t('git.project.noMatches')} message={t('git.project.noMatchesMsg')} />
      ) : (
        <ScrollArea className="min-h-0 flex-1" reserveGutter={false} scrollRef={listScrollRef} scrollProps={{ onDragOver: onListDragOver }}>
          {listedTemporary.length > 0 ? (
            <section className="mb-2 border-b border-line pb-2">
              <div className="flex h-8 w-full items-center hover:bg-[var(--overlay-06)]">
                <Button
                  variant="plain"
                  className="h-8 min-w-0 flex-1 justify-start gap-1.5 px-2 font-normal text-ink-soft hover:enabled:bg-transparent"
                  aria-expanded={temporaryExpanded}
                  onClick={() => setTemporaryExpanded((prev) => !prev)}
                >
                  {temporaryExpanded ? <LuChevronDown className="size-3.5 shrink-0" aria-hidden /> : <LuChevronRight className="size-3.5 shrink-0" aria-hidden />}
                  <LuGlobe className="size-3.5 text-accent" aria-hidden />
                  <span className="min-w-0 truncate whitespace-nowrap text-left">{t('git.project.temporary')}</span>
                  <Badge tone="neutral" size="mini" dot={false} className="shrink-0">
                    {listedTemporary.length}
                  </Badge>
                </Button>
              </div>
              {temporaryExpanded
                ? listedTemporary.map((temp) => {
                    const current = currentPath === temp.remoteUrl || currentPath === temp.id
                    const isFavoriting = favoriteLoadingId === temp.id
                    return (
                      <div key={temp.id} className="group/temp relative flex h-8 w-full items-center pr-1 hover:bg-[var(--overlay-06)]">
                        <Button
                          variant="plain"
                          aria-current={current ? 'true' : undefined}
                          className={cn(
                            'h-8 min-w-0 flex-1 justify-start gap-1.5 rounded-none px-2 pl-7 font-normal text-ink',
                            current && 'bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] hover:enabled:bg-[color-mix(in_oklab,var(--accent)_24%,transparent)]'
                          )}
                          onClick={() => {
                            onOpen(temp.remoteUrl)
                            onClose()
                          }}
                        >
                          <HostIcon host={temp.provider} />
                          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">{temp.name}</span>
                          <Badge tone="neutral" size="mini" dot={false} className="shrink-0 text-[10px]">
                            {t('git.project.temporaryBadge')}
                          </Badge>
                        </Button>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-80 group-hover/temp:opacity-100">
                          <Button
                            variant="plain"
                            size="mini"
                            className="size-6 text-warn hover:bg-warn/15"
                            aria-label={t('git.project.favoriteProject')}
                            tooltip={t('git.project.favoriteProject')}
                            loading={isFavoriting}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleFavoriteTemporary(temp)
                            }}
                          >
                            <LuStar className="size-3.5 fill-warn/30 text-warn" aria-hidden />
                          </Button>
                          <Button
                            variant="plain"
                            size="mini"
                            className="size-6 text-ink-soft hover:bg-[var(--overlay-08)] hover:text-fail"
                            aria-label={t('git.project.removeTemporary')}
                            tooltip={t('git.project.removeTemporary')}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveTemporary(temp)
                            }}
                          >
                            <LuX className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                : null}
            </section>
          ) : null}
          {visibleFolders.map((group) => {
            const items = listed.filter((project) => project.group === group)
            if (needle && items.length === 0) return null
            const expanded = openGroups[group] !== false
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
                >
                  <Button
                    variant="plain"
                    className="h-8 min-w-0 flex-1 justify-start gap-1.5 px-2 font-normal text-ink-soft hover:enabled:bg-transparent"
                    aria-expanded={expanded}
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [group]: !(prev[group] !== false) }))}
                  >
                    {expanded ? <LuChevronDown className="size-3.5 shrink-0" aria-hidden /> : <LuChevronRight className="size-3.5 shrink-0" aria-hidden />}
                    <LuFolder className="size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate whitespace-nowrap text-left">{group}</span>
                    <Badge tone="neutral" size="mini" dot={false} className="shrink-0">
                      {groupCount}
                    </Badge>
                  </Button>
                  <Button
                    variant="plain"
                    size="icon"
                    className="mr-0.5 size-6 shrink-0 text-ink-soft opacity-0 transition-opacity pointer-events-none group-hover/grp:pointer-events-auto group-hover/grp:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-fail"
                    aria-label={t('git.project.deleteFolderAria', { name: group })}
                    tooltip={t('git.project.deleteFolderTip')}
                    disabled={busy}
                    onClick={() => void requestDeleteFolder(group)}
                  >
                    <LuTrash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
                {expanded
                  ? items.map((project, index) => {
                      const current = Boolean(project.localPath) && project.localPath === currentPath
                      const showBefore = dropTarget?.group === group && dropTarget.beforeId === project.id
                      const showAfter = dropTarget?.group === group && dropTarget.beforeId === null && index === items.length - 1 && draggingId !== project.id
                      return (
                        <div
                          key={project.id}
                          className="relative w-full"
                          onDragOver={(event) => onProjectDragOver(event, group, project.id)}
                          onDrop={(event) => void commitDrop(event)}
                        >
                          {showBefore ? <span className="pointer-events-none absolute inset-x-2 top-0 z-10 h-0.5 -translate-y-1/2 rounded-full bg-accent" aria-hidden /> : null}
                          <Button
                            variant="plain"
                            draggable={!busy}
                            aria-current={current ? 'true' : undefined}
                            className={cn(
                              'h-8 w-full cursor-grab justify-start gap-1.5 rounded-none px-2 pl-7 font-normal text-ink active:cursor-grabbing',
                              current && 'bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] hover:enabled:bg-[color-mix(in_oklab,var(--accent)_24%,transparent)]',
                              draggingId === project.id && 'opacity-50'
                            )}
                            onDragStart={(event) => onProjectDragStart(event, project.id)}
                            onDragEnd={onProjectDragEnd}
                            onClick={() => {
                              if (project.localPath) onOpen(project.localPath)
                              else setCloneTarget(project)
                            }}
                          >
                            <HostIcon host={project.host} />
                            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">{project.name}</span>
                            {project.local ? <LuHardDrive className="size-3.5 shrink-0 text-ink-soft" aria-hidden /> : null}
                            {project.remote ? <LuCloud className={cn('size-3.5 shrink-0', project.authorized ? 'text-accent' : 'text-ink-soft')} aria-hidden /> : null}
                          </Button>
                          {showAfter ? <span className="pointer-events-none absolute inset-x-2 bottom-0 z-10 h-0.5 translate-y-1/2 rounded-full bg-accent" aria-hidden /> : null}
                        </div>
                      )
                    })
                  : null}
                {expanded && items.length === 0 ? (
                  <EmptyState density="compact" className="px-2 py-3" title={t('git.project.folderEmpty')} message={t('git.project.folderEmptyMsg')} />
                ) : null}
              </section>
            )
          })}
        </ScrollArea>
      )}
      <Modal
        open={folderOpen}
        title={t('git.project.newFolderTitle')}
        description={t('git.project.newFolderDesc')}
        busy={busy}
        onClose={closeFolderModal}
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={closeFolderModal}>
              {t('common.cancel')}
            </Button>
            <Button variant="accent" loading={busy} onClick={() => void submitFolder()}>
              {t('git.project.create')}
            </Button>
          </>
        }
      >
        <div className={formField}>
          <label className={formTitle} htmlFor={folderId}>
            {t('git.project.name')}
          </label>
          <div className={formControl}>
            <TextInput
              ref={folderRef}
              id={folderId}
              fullWidth
              placeholder={t('git.project.namePlaceholder')}
              invalid={fieldInvalid.folder}
              value={folderName}
              onChange={(event) => {
                setFolderName(event.target.value)
                if (fieldInvalid.folder) setFieldInvalid({})
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void submitFolder()
                }
              }}
            />
          </div>
          {formError && folderOpen ? (
            <p className="m-0 text-xs text-fail" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      </Modal>
      <Modal
        open={remoteOpen}
        title={t('git.project.addRemoteTitle')}
        description={t('git.project.addRemoteDesc')}
        busy={busy}
        onClose={closeRemoteModal}
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={closeRemoteModal}>
              {t('common.cancel')}
            </Button>
            <Button variant="accent" loading={busy} onClick={() => void submitRemote()}>
              {syncAccount ? t('git.project.syncAndAdd') : t('git.project.add')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className={formField}>
            <label className={formTitle} htmlFor={urlId}>
              {t('git.project.repoUrl')}
            </label>
            <p className={formDesc}>{t('git.project.repoUrlHint')}</p>
            <div className={formControl}>
              <TextInput
                ref={urlRef}
                id={urlId}
                placeholder="https://gitlab.com/group/repo.git"
                fullWidth
                spellCheck={false}
                invalid={fieldInvalid.url}
                aria-describedby={formError && fieldInvalid.url ? formErrorId : undefined}
                value={remoteUrl}
                onChange={(event) => {
                  setRemoteUrl(event.target.value)
                  if (fieldInvalid.url) setFieldInvalid((prev) => ({ ...prev, url: false }))
                }}
              />
            </div>
          </div>
          <div className={formField}>
            <label className={formTitle} htmlFor={tokenId}>
              {t('git.project.accessToken')}
            </label>
            <p className={formDesc}>{t('git.project.tokenHint')}</p>
            <div className={formControl}>
              <ApiKeyInput
                id={tokenId}
                configured={false}
                unlocked={tokenUnlocked}
                onUnlockedChange={setTokenUnlocked}
                placeholder="GitLab / GitHub token"
                invalid={fieldInvalid.token}
                aria-describedby={formError && fieldInvalid.token ? formErrorId : undefined}
                value={token}
                onChange={(value) => {
                  setToken(value)
                  if (fieldInvalid.token) setFieldInvalid((prev) => ({ ...prev, token: false }))
                }}
                disabled={busy}
              />
            </div>
          </div>
          <div className={cn(formFieldInlineDense, 'grid-cols-[minmax(0,1fr)_auto]')}>
            <label className={formTitleInline} htmlFor={syncId}>
              {t('git.project.syncAccount')}
            </label>
            <div className="col-start-2 row-span-1 row-start-1 flex items-center justify-end">
              <SwitchToggle id={syncId} checked={syncAccount} onCheckedChange={setSyncAccount} disabled={busy} aria-label={t('git.project.syncAccount')} />
            </div>
          </div>
          {formError && remoteOpen ? (
            <p id={formErrorId} className="m-0 text-xs text-fail" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      </Modal>
      <Modal
        open={Boolean(cloneTarget)}
        title={cloneTarget ? t('git.project.cloneTitle', { name: cloneTarget.name }) : t('git.project.clone')}
        description={cloneTarget?.authorized ? t('git.project.cloneAuthorizedDesc') : t('git.project.clonePublicDesc')}
        busy={busy}
        onClose={() => {
          setCloneTarget(null)
          setFormError('')
        }}
        footer={
          <>
            {!cloneTarget?.authorized ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setCloneTarget(null)
                  setFormError('')
                  setRemoteUrl(cloneTarget?.httpsUrl || '')
                  setRemoteOpen(true)
                }}
              >
                {t('git.project.authorize')}
              </Button>
            ) : null}
            <Button
              variant="accent"
              loading={busy}
              onClick={() => {
                if (!cloneTarget) return
                void onClone(cloneTarget).then((message) => {
                  if (!message) {
                    setCloneTarget(null)
                    setFormError('')
                  } else setFormError(message)
                })
              }}
            >
              {t('git.project.pickFolderClone')}
            </Button>
          </>
        }
      >
        {formError && cloneTarget ? (
          <p className="m-0 text-xs text-fail" role="alert">
            {formError}
          </p>
        ) : null}
      </Modal>
    </div>
  )
}
