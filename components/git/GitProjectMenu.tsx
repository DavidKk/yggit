'use client'

import { type DragEvent, type RefObject, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AiOutlineCloudSync } from 'react-icons/ai'
import {
  LuChevronDown,
  LuChevronRight,
  LuClock3,
  LuCloud,
  LuCopy,
  LuExternalLink,
  LuFolder,
  LuFolderGit2,
  LuGithub,
  LuGitlab,
  LuGlobe,
  LuHardDrive,
  LuLockKeyhole,
  LuPencil,
  LuStar,
  LuTrash2,
  LuX,
} from 'react-icons/lu'
import { TbCloudLock, TbFolderPlus } from 'react-icons/tb'

import type { AddRemoteProjectOptions } from '@/lib/git/driver/types'

const FOLDER_EXPAND_MS = 450
const AUTO_SCROLL_EDGE = 36
const AUTO_SCROLL_MAX = 18

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { GIT_FIND_EVENT } from '@/components/git/gitFind'
import { GIT_SEARCH_DROPDOWN_ATTR, GitSearchDropdown } from '@/components/git/GitSearchDropdown'
import { FloatingMenu, type FloatingMenuItem } from '@/components/git/RefChipsCell'
import { useT } from '@/components/i18n/LocaleProvider'
import { formControl, formDesc, formField, formFieldInlineDense, formTitle, formTitleInline } from '@/components/layoutClasses'
import { useNotification } from '@/components/notification/useNotification'
import { ApiKeyInput, Badge, Button, EmptyState, Modal, ScrollArea, SwitchToggle, TextInput, Tooltip } from '@/components/sk'
import { copyToClipboard } from '@/lib/clipboard'
import { getDriverMode } from '@/lib/git/driver'
import { extractProjectRemotes, getRemoteCloudType, hasSavedRemote, projectOpenTarget, projectSource, remoteIdentity, type ResolvedRemoteSource } from '@/lib/git/project-access'
import { addTemporaryRepo, parseRemoteUrl, removeTemporaryRepo, type TemporaryRepo, useTemporaryRepos } from '@/lib/git/temporary-store'
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
  onAddRemote: (input: AddRemoteProjectOptions) => Promise<string>
  onClone: (project: GitProjectView) => Promise<string>
  onCreateFolder: (name: string) => Promise<string>
  onDeleteFolder: (name: string) => Promise<{ error: string; removedCount?: number }>
  onRenameFolder?: (oldName: string, newName: string) => Promise<string>
  onClearFolder?: (name: string) => Promise<string>
  onSetProjectLabel?: (id: string, label: string) => Promise<string>
  onRemoveProject?: (id: string) => Promise<string>
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
  onRenameFolder,
  onClearFolder,
  onSetProjectLabel,
  onRemoveProject,
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
  const [importGroup, setImportGroup] = useState(false)
  const [groupProvider, setGroupProvider] = useState<'github' | 'gitlab'>('gitlab')
  const [targetFolder, setTargetFolder] = useState('')
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
  const [remotesMenuAnchor, setRemotesMenuAnchor] = useState<{
    projectId: string
    rect: DOMRect
    remotes: ResolvedRemoteSource[]
  } | null>(null)
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
  const expandTimerRef = useRef<number | null>(null)
  const expandGroupRef = useRef('')
  const autoExpandedRef = useRef<Set<string>>(new Set())
  const dropHandledRef = useRef(false)
  const folderComposingRef = useRef(false)
  const scrollRafRef = useRef(0)
  const scrollDirRef = useRef(0)
  const urlId = useId()
  const tokenId = useId()
  const syncId = useId()
  const folderId = useId()
  const formErrorId = useId()

  const copyValue = async (value: string) => {
    const ok = await copyToClipboard(value)
    if (ok) notify.success(t('common.copied') || '已复制')
    else notify.error(t('common.copyFailed') || '复制失败')
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
      notify.success('文件夹重命名成功')
    }
  }

  const commitProjectLabel = async (id: string) => {
    const next = projectLabelDraft.trim()
    setEditingLabelProjectId(null)
    if (!onSetProjectLabel) return
    const errorMsg = await onSetProjectLabel(id, next)
    if (errorMsg) {
      notify.error(errorMsg)
    } else {
      notify.success(next ? '已设置项目别名' : '已清除项目别名')
    }
  }

  const handleFolderContextMenu = (e: React.MouseEvent, group: string) => {
    e.preventDefault()
    e.stopPropagation()
    const expanded = openGroups[group] !== false
    const itemsInGroup = projects.filter((p) => p.group === group)

    const items: FloatingMenuItem[] = [
      {
        key: 'rename-folder',
        label: '重命名文件夹',
        icon: <LuPencil className="size-3.5 text-accent" />,
        onSelect: () => startRenameFolder(group),
        group: '操作',
      },
      {
        key: 'toggle-expand',
        label: expanded ? '折叠文件夹' : '展开文件夹',
        icon: expanded ? <LuChevronDown className="size-3.5" /> : <LuChevronRight className="size-3.5" />,
        onSelect: () => setOpenGroups((prev) => ({ ...prev, [group]: !expanded })),
        group: '操作',
      },
      {
        key: 'copy-folder-name',
        label: `复制文件夹名称 (${group})`,
        icon: <LuCopy className="size-3.5 text-accent" />,
        onSelect: () => void copyValue(group),
        group: '复制',
      },
      {
        key: 'copy-projects-list',
        label: `复制组内所有项目名 (${itemsInGroup.length} 个)`,
        icon: <LuCopy className="size-3.5 text-accent" />,
        onSelect: () => void copyValue(itemsInGroup.map((p) => p.label || p.name).join('\n')),
        group: '复制',
      },
      ...(onClearFolder
        ? [
            {
              key: 'clear-folder',
              label: '清空文件夹 (移出所有项目)',
              icon: <LuTrash2 className="size-3.5 text-warn" />,
              onSelect: async () => {
                const msg = await onClearFolder(group)
                if (msg) notify.error(msg)
                else notify.success('已清空文件夹')
              },
              dividerBefore: true,
            },
          ]
        : []),
      {
        key: 'delete-folder',
        label: '删除文件夹',
        icon: <LuTrash2 className="size-3.5 text-fail" />,
        onSelect: () => void requestDeleteFolder(group),
      },
    ]

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: group,
      items,
    })
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

    const items: FloatingMenuItem[] = [
      {
        key: 'edit-label',
        label: project.label ? `修改别名 (当前: ${project.label})` : '设置项目别名 / 备注',
        icon: <LuPencil className="size-3.5 text-accent" />,
        onSelect: () => {
          setEditingLabelProjectId(project.id)
          setProjectLabelDraft(project.label || '')
        },
        group: '操作',
      },
      {
        key: 'copy-name',
        label: `复制项目名称 (${project.name})`,
        icon: <LuCopy className="size-3.5 text-accent" />,
        onSelect: () => void copyValue(project.name),
        group: '复制',
      },
      ...(project.label
        ? [
            {
              key: 'copy-label',
              label: `复制项目别名 (${project.label})`,
              icon: <LuCopy className="size-3.5 text-accent" />,
              onSelect: () => void copyValue(project.label!),
              group: '复制',
            },
          ]
        : []),
      ...(project.localPath
        ? [
            {
              key: 'copy-path',
              label: `复制本地路径 (${project.localPath})`,
              icon: <LuHardDrive className="size-3.5 text-ink-soft" />,
              onSelect: () => void copyValue(project.localPath),
              group: '复制',
            },
            ...(getDriverMode() === 'local'
              ? [
                  {
                    key: 'reveal-finder',
                    label: '在访达/资源管理器中显示',
                    icon: <LuFolder className="size-3.5 text-accent" />,
                    onSelect: () => void handleOpenLocalFolder(e, project.localPath),
                    group: '操作',
                  },
                ]
              : []),
          ]
        : []),
      ...(project.httpsUrl
        ? [
            {
              key: 'copy-url',
              label: `复制仓库 URL`,
              icon: <LuGlobe className="size-3.5 text-ink-soft" />,
              onSelect: () => void copyValue(project.httpsUrl),
              group: '复制',
            },
            {
              key: 'open-browser',
              label: '在浏览器中打开远端',
              icon: <LuExternalLink className="size-3.5 text-accent" />,
              onSelect: () => window.open(project.httpsUrl.replace(/\.git$/, ''), '_blank'),
              group: '操作',
            },
          ]
        : []),
      ...(onRemoveProject
        ? [
            {
              key: 'remove-project',
              label: '从项目切换器中移除',
              icon: <LuTrash2 className="size-3.5 text-fail" />,
              onSelect: () => void requestRemoveProject(project),
              dividerBefore: true,
            },
          ]
        : []),
    ]

    setContextMenu({
      anchor: { x: e.clientX, y: e.clientY },
      ariaLabel: project.label || project.name,
      items,
    })
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

  const handleOpenRemoteTemporary = (parsed: ReturnType<typeof parseRemoteUrl>) => {
    if (!parsed) return
    const temp = addTemporaryRepo(parsed)
    onOpen(temp.remoteUrl)
    setQuery('')
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
                    const tempRemotes = extractProjectRemotes({
                      id: temp.id,
                      name: temp.name,
                      group: '',
                      host: temp.provider === 'generic' ? 'local' : temp.provider,
                      localPath: '',
                      httpsUrl: temp.remoteUrl,
                      local: false,
                      remote: true,
                      authorized: false,
                    })
                    const tempCloudType = getRemoteCloudType(tempRemotes)
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
                          <Tooltip content={t('git.project.temporaryBadge')}>
                            <span className="flex size-5 shrink-0 items-center justify-center text-ink-soft" aria-label={t('git.project.temporaryBadge')} tabIndex={0}>
                              <LuClock3 className="size-3.5" aria-hidden />
                            </span>
                          </Tooltip>
                        </Button>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-80 group-hover/temp:opacity-100">
                          {tempCloudType === 'single-private' ? (
                            <Tooltip content={`私有远端: ${tempRemotes[0].name} · 点击打开`}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(tempRemotes[0].webUrl, '_blank')
                                }}
                                className="flex size-6 cursor-pointer items-center justify-center rounded text-warn transition-colors hover:bg-warn/15 hover:text-warn/80"
                                aria-label={`私有远端: ${tempRemotes[0].name}`}
                              >
                                <TbCloudLock className="size-3.5 text-warn" aria-hidden="true" />
                              </button>
                            </Tooltip>
                          ) : tempCloudType === 'single-public' ? (
                            <Tooltip content={`开源远端: ${tempRemotes[0].name} · 点击打开`}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(tempRemotes[0].webUrl, '_blank')
                                }}
                                className="flex size-6 cursor-pointer items-center justify-center rounded text-accent transition-colors hover:bg-accent/15 hover:text-[color-mix(in_oklab,var(--accent)_80%,black)]"
                                aria-label={`开源远端: ${tempRemotes[0].name}`}
                              >
                                <LuCloud className="size-3.5 text-accent" aria-hidden="true" />
                              </button>
                            </Tooltip>
                          ) : null}
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
                      <span className="min-w-0 truncate whitespace-nowrap text-left">{group}</span>
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
                        aria-label="重命名文件夹"
                        tooltip="重命名文件夹"
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
                  ? items.map((project, index) => {
                      const target = projectOpenTarget(project)
                      const online = !project.localPath && Boolean(target)
                      const current = Boolean(target) && (target === currentPath || (online && remoteIdentity(target) === remoteIdentity(currentPath)))
                      const showBefore = dropTarget?.group === group && dropTarget.beforeId === project.id
                      const showAfter = dropTarget?.group === group && dropTarget.beforeId === null && index === items.length - 1 && draggingId !== project.id
                      const isEdgeMode = getDriverMode() === 'edge'
                      const remotes = extractProjectRemotes(project)
                      const cloudType = getRemoteCloudType(remotes)
                      const hasLocal = Boolean(project.localPath)

                      return (
                        <div
                          key={project.id}
                          className="relative w-full"
                          onDragOver={(event) => onProjectDragOver(event, group, project.id)}
                          onDrop={(event) => void commitDrop(event)}
                        >
                          {showBefore ? <span className="pointer-events-none absolute inset-x-2 top-0 z-10 h-0.5 -translate-y-1/2 rounded-full bg-accent" aria-hidden /> : null}
                          <div
                            className={cn(
                              'group/item flex w-full items-center pr-1.5 transition-colors',
                              project.label ? 'h-11' : 'h-8',
                              current
                                ? 'bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-accent font-medium hover:bg-[color-mix(in_oklab,var(--accent)_24%,transparent)]'
                                : 'hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]',
                              draggingId === project.id && 'opacity-50'
                            )}
                            onContextMenu={(e) => handleProjectContextMenu(e, project)}
                          >
                            {editingLabelProjectId === project.id ? (
                              <div className="flex min-w-0 flex-1 items-center px-2 pl-7">
                                <input
                                  autoFocus
                                  type="text"
                                  value={projectLabelDraft}
                                  placeholder="设置项目别名/备注…"
                                  className="h-6 w-full rounded border border-accent bg-paper px-2 text-xs text-ink outline-none focus:ring-1 focus:ring-accent"
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setProjectLabelDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      void commitProjectLabel(project.id)
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault()
                                      setEditingLabelProjectId(null)
                                    }
                                  }}
                                  onBlur={() => {
                                    void commitProjectLabel(project.id)
                                  }}
                                />
                              </div>
                            ) : (
                              <Button
                                variant="plain"
                                draggable={!busy}
                                aria-current={current ? 'true' : undefined}
                                className={cn(
                                  'min-w-0 flex-1 cursor-grab justify-start gap-1.5 rounded-none px-2 pl-7 font-normal text-ink active:cursor-grabbing hover:enabled:bg-transparent',
                                  project.label ? 'h-11' : 'h-8'
                                )}
                                onDragStart={(event) => onProjectDragStart(event, project.id)}
                                onDragEnd={onProjectDragEnd}
                                onClick={() => {
                                  if (target) onOpen(target)
                                  else setCloneTarget(project)
                                }}
                              >
                                <HostIcon host={project.host} />
                                {project.label ? (
                                  <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
                                    <span className="truncate text-xs font-semibold text-ink leading-tight">{project.label}</span>
                                    <span className="truncate text-[10px] text-ink-soft leading-tight font-mono">{project.name}</span>
                                  </div>
                                ) : (
                                  <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-xs font-medium">{project.name}</span>
                                )}
                              </Button>
                            )}

                            <div className="flex shrink-0 items-center gap-0.5">
                              {onRemoveProject && (
                                <Button
                                  variant="plain"
                                  size="icon"
                                  className="size-6 text-ink-soft hover:enabled:text-fail opacity-0 pointer-events-none group-hover/item:pointer-events-auto group-hover/item:opacity-100 disabled:opacity-0 group-hover/item:disabled:opacity-40 transition-opacity"
                                  aria-label={t('git.project.removeProjectConfirm', { name: project.label || project.name })}
                                  tooltip={t('git.project.removeProject')}
                                  disabled={busy}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void requestRemoveProject(project)
                                  }}
                                >
                                  <LuTrash2 className="size-3.5" aria-hidden />
                                </Button>
                              )}
                              {/* Edit project label button on hover */}
                              <Tooltip content={project.label ? '修改项目别名' : '设置项目别名'}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingLabelProjectId(project.id)
                                    setProjectLabelDraft(project.label || '')
                                  }}
                                  className="flex size-6 opacity-0 pointer-events-none group-hover/item:pointer-events-auto group-hover/item:opacity-100 cursor-pointer items-center justify-center rounded text-ink-soft transition-all hover:bg-[var(--overlay-08)] hover:text-accent"
                                  aria-label="设置项目别名"
                                >
                                  <LuPencil className="size-3" aria-hidden="true" />
                                </button>
                              </Tooltip>
                              {/* 1. Local Folder Icon Slot */}
                              {hasLocal ? (
                                <Tooltip content={isEdgeMode ? '本地项目' : '打开本地项目'}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (!isEdgeMode && project.localPath) {
                                        void handleOpenLocalFolder(e, project.localPath)
                                      }
                                    }}
                                    className="flex size-6 cursor-pointer items-center justify-center rounded text-ink-soft transition-colors hover:bg-[var(--overlay-08)] hover:text-accent"
                                    aria-label={isEdgeMode ? '本地项目' : '打开本地项目'}
                                  >
                                    {isEdgeMode && project.authorized === false ? (
                                      <LuLockKeyhole className="size-3.5 text-warn" aria-hidden="true" />
                                    ) : (
                                      <LuHardDrive className="size-3.5" aria-hidden="true" />
                                    )}
                                  </button>
                                </Tooltip>
                              ) : (
                                <span className="size-6 shrink-0" aria-hidden="true" />
                              )}

                              {/* 2. Remote Cloud Icon Slot */}
                              {cloudType === 'single-public' ? (
                                <Tooltip content={`开源远端: ${remotes[0].name} · 点击打开`}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.open(remotes[0].webUrl, '_blank')
                                    }}
                                    className="flex size-6 cursor-pointer items-center justify-center rounded text-accent transition-colors hover:bg-accent/15 hover:text-[color-mix(in_oklab,var(--accent)_80%,black)]"
                                    aria-label={`开源远端: ${remotes[0].name}`}
                                  >
                                    <LuCloud className="size-3.5 text-accent" aria-hidden="true" />
                                  </button>
                                </Tooltip>
                              ) : cloudType === 'single-private' ? (
                                <Tooltip content={`私有远端: ${remotes[0].name} · 点击打开`}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.open(remotes[0].webUrl, '_blank')
                                    }}
                                    className="flex size-6 cursor-pointer items-center justify-center rounded text-warn transition-colors hover:bg-warn/15 hover:text-warn/80"
                                    aria-label={`私有远端: ${remotes[0].name}`}
                                  >
                                    <TbCloudLock className="size-3.5 text-warn" aria-hidden="true" />
                                  </button>
                                </Tooltip>
                              ) : cloudType === 'mixed' ? (
                                <Tooltip content="远端源列表 (多个源) · 点击展开">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const rect = e.currentTarget.getBoundingClientRect()
                                      setRemotesMenuAnchor((prev) => (prev?.projectId === project.id ? null : { projectId: project.id, rect, remotes }))
                                    }}
                                    className={cn(
                                      'flex size-6 cursor-pointer items-center justify-center rounded text-ink-soft transition-colors hover:bg-[var(--overlay-08)] hover:text-ink',
                                      remotesMenuAnchor?.projectId === project.id && 'bg-[var(--overlay-08)] text-accent'
                                    )}
                                    aria-label="远端源列表"
                                    aria-haspopup="menu"
                                    aria-expanded={remotesMenuAnchor?.projectId === project.id}
                                  >
                                    <LuCloud className="size-3.5" aria-hidden="true" />
                                  </button>
                                </Tooltip>
                              ) : (
                                <span className="size-6 shrink-0" aria-hidden="true" />
                              )}
                            </div>
                          </div>
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
      {remotesMenuAnchor ? (
        <div
          data-remotes-popover="true"
          style={{
            position: 'fixed',
            top: remotesMenuAnchor.rect.bottom + 4,
            left: Math.max(12, Math.min(typeof window !== 'undefined' ? window.innerWidth - 268 : 300, remotesMenuAnchor.rect.right - 240)),
            zIndex: 9999,
          }}
          className="w-64 rounded-xl border border-line bg-panel p-1.5 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-line px-2 py-1 text-[0.68rem] font-semibold text-ink-soft">
            <span>远端源列表 ({remotesMenuAnchor.remotes.length})</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setRemotesMenuAnchor(null)
              }}
              className="flex size-4 cursor-pointer items-center justify-center rounded text-ink-soft hover:text-ink"
              aria-label="关闭"
            >
              <LuX className="size-3" />
            </button>
          </div>
          <div className="mt-1 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
            {remotesMenuAnchor.remotes.map((remote) => (
              <Tooltip key={remote.url} content={`在浏览器中打开: ${remote.webUrl}`} placement="left">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRemotesMenuAnchor(null)
                    window.open(remote.webUrl, '_blank')
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md p-1.5 text-left text-xs transition-colors hover:bg-[var(--overlay-08)] hover:text-accent"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {remote.isPrivate ? (
                      <TbCloudLock className="size-4 shrink-0 text-warn" aria-label="私有远端" />
                    ) : (
                      <LuCloud className="size-4 shrink-0 text-accent" aria-label="开源远端" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="truncate font-mono font-medium text-xs text-ink block">{remote.name}</span>
                      <div className="truncate font-mono text-[0.68rem] text-ink-soft">{remote.webUrl.replace(/^https?:\/\//, '')}</div>
                    </div>
                  </div>
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      ) : null}
      {contextMenu ? (
        <FloatingMenu anchor={contextMenu.anchor} ariaLabel={contextMenu.ariaLabel} color="var(--accent)" onClose={() => setContextMenu(null)} items={contextMenu.items} />
      ) : null}
      <Modal
        open={folderOpen}
        title={t('git.project.newFolderTitle')}
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
          <p className={formDesc}>{t('git.project.newFolderDesc')}</p>
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
              onCompositionStart={() => {
                folderComposingRef.current = true
              }}
              onCompositionEnd={() => {
                setTimeout(() => {
                  folderComposingRef.current = false
                }, 50)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  if (event.nativeEvent.isComposing || event.keyCode === 229 || folderComposingRef.current) {
                    return
                  }
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
        title={t(importGroup ? 'git.project.addRemoteGroup' : 'git.project.addRemoteTitle')}
        description={t(importGroup ? 'git.project.remoteGroupDesc' : 'git.project.addRemoteDesc')}
        busy={busy}
        onClose={closeRemoteModal}
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={closeRemoteModal}>
              {t('common.cancel')}
            </Button>
            <Button variant="accent" loading={busy} onClick={() => void submitRemote()}>
              {importGroup ? t('git.project.importGroup') : syncAccount ? t('git.project.syncAndAdd') : t('git.project.add')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className={formField}>
            <label className={formTitle} htmlFor={urlId}>
              {t(importGroup ? 'git.project.groupUrl' : 'git.project.repoUrl')}
            </label>
            {!importGroup && <p className={formDesc}>{t('git.project.repoUrlHint')}</p>}
            <div className={formControl}>
              <TextInput
                ref={urlRef}
                id={urlId}
                placeholder={
                  importGroup ? (groupProvider === 'github' ? 'https://github.com/organization' : 'https://gitlab.com/group/subgroup') : 'https://gitlab.com/group/repo.git'
                }
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
          {importGroup && (
            <>
              <label className="grid gap-1.5 text-xs">
                {t('git.project.provider')}
                <select
                  className="h-8 rounded-md border border-line bg-panel px-2"
                  value={groupProvider}
                  onChange={(event) => setGroupProvider(event.target.value as 'github' | 'gitlab')}
                  disabled={busy}
                >
                  <option value="gitlab">GitLab</option>
                  <option value="github">GitHub</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs">
                {t('git.project.targetFolder')}
                <TextInput
                  fullWidth
                  list={`${urlId}-folders`}
                  value={targetFolder}
                  onChange={(event) => setTargetFolder(event.target.value)}
                  disabled={busy}
                  invalid={fieldInvalid.folder}
                />
                <datalist id={`${urlId}-folders`}>
                  {folders.map((folder) => (
                    <option key={folder} value={folder} />
                  ))}
                </datalist>
              </label>
            </>
          )}
          {!importGroup && (
            <div className={cn(formFieldInlineDense, 'grid-cols-[minmax(0,1fr)_auto]')}>
              <label className={formTitleInline} htmlFor={syncId}>
                {t('git.project.syncAccount')}
              </label>
              <div className="col-start-2 row-span-1 row-start-1 flex items-center justify-end">
                <SwitchToggle id={syncId} checked={syncAccount} onCheckedChange={setSyncAccount} disabled={busy} aria-label={t('git.project.syncAccount')} />
              </div>
            </div>
          )}
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
                  setImportGroup(false)
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
