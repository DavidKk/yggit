'use client'

import { type Dispatch, type DragEvent, type RefObject, type SetStateAction, useEffect, useRef, useState } from 'react'

import type { GitProjectView } from '@/lib/git/types'

export type DropTarget = { group: string; beforeId: string | null }

const PROJECT_MIME = 'application/x-yggdrasil-project-id'
const FOLDER_EXPAND_MS = 450
const AUTO_SCROLL_EDGE = 36
const AUTO_SCROLL_MAX = 18

export function useProjectDragDrop({
  listScrollRef,
  openGroups,
  setOpenGroups,
  listed,
  projects,
  onMoveProject,
  setFormError,
}: {
  listScrollRef: RefObject<HTMLDivElement | null>
  openGroups: Record<string, boolean>
  setOpenGroups: Dispatch<SetStateAction<Record<string, boolean>>>
  listed: GitProjectView[]
  projects: GitProjectView[]
  onMoveProject: (id: string, group: string, beforeId?: string) => Promise<string>
  setFormError: Dispatch<SetStateAction<string>>
}) {
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [draggingId, setDraggingId] = useState('')
  const expandTimerRef = useRef<number | null>(null)
  const expandGroupRef = useRef('')
  const autoExpandedRef = useRef<Set<string>>(new Set())
  const dropHandledRef = useRef(false)
  const scrollRafRef = useRef(0)
  const scrollDirRef = useRef(0)

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

  return {
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
  }
}
