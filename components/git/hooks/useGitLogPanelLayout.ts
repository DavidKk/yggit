'use client'

import { type CSSProperties, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction, useCallback, useEffect, useRef } from 'react'

import { measurePanelFit } from '@/components/git/fitColumn'
import { MAIN_MIN, SIDEBAR_MIN, TREE_MIN } from '@/components/git/log-page/gitLogUtils'
import { useGitUiReady } from '@/lib/git/ui-prefs'

export function useGitLogPanelLayout({
  frameRef,
  sidebarWidth,
  setSidebarWidth,
  treeWidth,
  setTreeWidth,
  selected,
  selectedFile,
  selectedFileRef,
  filePanelRef,
  busy,
  menuOpen,
  setFilePanel,
  setSelectedFile,
  setSelectedStatus,
  setSelectedHash,
}: {
  frameRef: RefObject<HTMLDivElement | null>
  sidebarWidth: number
  setSidebarWidth: (next: number) => void
  treeWidth: number
  setTreeWidth: (next: number) => void
  selected: boolean
  selectedFile: string
  selectedFileRef: MutableRefObject<string>
  filePanelRef: MutableRefObject<{ type: 'history' | 'blame'; path: string; hash?: string } | null>
  busy: boolean
  menuOpen: boolean
  setFilePanel: Dispatch<SetStateAction<{ type: 'history' | 'blame'; path: string; hash?: string } | null>>
  setSelectedFile: Dispatch<SetStateAction<string>>
  setSelectedStatus: Dispatch<SetStateAction<string>>
  setSelectedHash: Dispatch<SetStateAction<string>>
}) {
  const sidebarWidthRef = useRef(sidebarWidth)
  const treeWidthRef = useRef(treeWidth)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  selectedFileRef.current = selectedFile

  const prefsReady = useGitUiReady()
  const frameStyle = (
    prefsReady
      ? {
          ['--git-sidebar-w']: `${sidebarWidth}px`,
          ['--git-tree-w']: `${treeWidth}px`,
        }
      : {}
  ) as CSSProperties

  useEffect(() => {
    document.documentElement.style.setProperty('--git-sidebar-w', `${sidebarWidth}px`)
    document.documentElement.style.setProperty('--git-tree-w', `${treeWidth}px`)
  }, [sidebarWidth, treeWidth])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (busy) return
      if (event.key !== 'Escape') return
      if (event.defaultPrevented) return
      if (menuOpen) return

      if (filePanelRef.current) {
        event.preventDefault()
        setFilePanel(null)
        return
      }

      if (selectedFileRef.current) {
        event.preventDefault()
        setSelectedFile('')
        setSelectedStatus('')
        return
      }

      if (selectedRef.current) {
        event.preventDefault()
        setSelectedHash('')
        setSelectedFile('')
        setSelectedStatus('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, busy, filePanelRef, selectedFileRef, setFilePanel, setSelectedFile, setSelectedHash, setSelectedStatus])

  const limitWidth = useCallback(
    (next: number, other: number, min: number) => {
      const total = frameRef.current?.clientWidth ?? next + other + MAIN_MIN
      const max = Math.max(min, total - other - MAIN_MIN)
      return Math.min(max, Math.max(min, next))
    },
    [frameRef]
  )

  const applySidebar = useCallback(
    (next: number) => {
      const width = limitWidth(next, selectedRef.current ? treeWidthRef.current : 0, SIDEBAR_MIN)
      sidebarWidthRef.current = width
      frameRef.current?.style.setProperty('--git-sidebar-w', `${width}px`)
      return width
    },
    [frameRef, limitWidth]
  )

  const applyTree = useCallback(
    (next: number) => {
      const width = limitWidth(next, selectedFileRef.current ? 0 : sidebarWidthRef.current, TREE_MIN)
      treeWidthRef.current = width
      frameRef.current?.style.setProperty('--git-tree-w', `${width}px`)
      return width
    },
    [frameRef, limitWidth, selectedFileRef]
  )

  const resizeSidebar = useCallback(
    (delta: number) => {
      applySidebar(sidebarWidthRef.current + delta)
    },
    [applySidebar]
  )

  const resizeTree = useCallback(
    (delta: number) => {
      applyTree(treeWidthRef.current - delta)
    },
    [applyTree]
  )

  const commitSidebar = useCallback(() => setSidebarWidth(sidebarWidthRef.current), [setSidebarWidth])
  const commitTree = useCallback(() => setTreeWidth(treeWidthRef.current), [setTreeWidth])

  const fitSidebar = useCallback(() => {
    const panel = frameRef.current?.querySelector('[data-git-sidebar]') as HTMLElement | null
    if (!panel) return
    const fitted = Math.max(SIDEBAR_MIN, measurePanelFit(panel, '[data-git-sidebar-label]', 16))
    setSidebarWidth(applySidebar(fitted))
  }, [applySidebar, frameRef, setSidebarWidth])

  const fitTree = useCallback(() => {
    const panel = frameRef.current?.querySelector('[data-git-tree]') as HTMLElement | null
    if (!panel) return
    const fitted = Math.max(TREE_MIN, measurePanelFit(panel, '[data-git-tree-label]', 20))
    setTreeWidth(applyTree(fitted))
  }, [applyTree, frameRef, setTreeWidth])

  return {
    frameStyle,
    resizeSidebar,
    resizeTree,
    commitSidebar,
    commitTree,
    fitSidebar,
    fitTree,
  }
}
