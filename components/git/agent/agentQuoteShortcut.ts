'use client'

import { useEffect, useRef } from 'react'

import { quoteBranchToAgent, quoteCommitToAgent, quoteFileToAgent, quoteFolderToAgent } from '@/lib/agent/agent-quote'

export function isApplePlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent)
}

/**
 * Shortcut label for Agent quotation.
 * On macOS: ⌥A or ⇧⌘A; On Windows/Linux: Alt+A or Ctrl+Shift+A
 */
export function agentQuoteShortcutLabel(apple = isApplePlatform()) {
  return apple ? '⌥A' : 'Alt+A'
}

/**
 * Checks if keyboard event matches agent quote chord:
 * - Alt + A (or Option + A on macOS)
 * - Cmd + Shift + A / Ctrl + Shift + A
 * Note: Q and W are strictly avoided to prevent accidental browser tab close (Cmd+W) or app quit (Cmd+Q).
 */
export function isAgentQuoteChord(event: Pick<KeyboardEvent, 'altKey' | 'shiftKey' | 'key' | 'metaKey' | 'ctrlKey'>): boolean {
  const k = event.key?.toLowerCase()
  // Reject any 'q' or 'w' key combo to protect from browser tab close / app quit
  if (k === 'q' || k === 'w') {
    return false
  }
  // 1) Alt + A (Option + A on macOS)
  if (event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey && k === 'a') {
    return true
  }
  // 2) Cmd + Shift + A / Ctrl + Shift + A
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && k === 'a') {
    return true
  }
  return false
}

export interface AgentQuoteShortcutOptions {
  repo?: string
  currentBranch?: string
  selectedHash?: string
  selectedFile?: string
  selectedStatus?: string
  commits?: Array<{ hash: string; subject: string; author?: string }>
}

/**
 * Global keyboard shortcut listener for quoting hovered or selected Git elements
 * (files, folders, commits, branches) directly to Git Agent.
 */
export function useAgentQuoteGlobalShortcut(options: AgentQuoteShortcutOptions) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isAgentQuoteChord(event)) return

      const activeEl = document.activeElement
      // Do not hijack typing in text inputs or textareas
      if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || activeEl?.getAttribute('contenteditable') === 'true') {
        return
      }

      const { repo, currentBranch, selectedHash, selectedFile, selectedStatus, commits } = optionsRef.current

      // 1. Check if an item is actively hovered or focused
      // a) File row
      const hoveredFileEl = (document.querySelector('[data-git-file-path]:hover') as HTMLElement | null) || (activeEl?.closest('[data-git-file-path]') as HTMLElement | null)
      if (hoveredFileEl) {
        const filePath = hoveredFileEl.getAttribute('data-git-file-path')
        if (filePath) {
          event.preventDefault()
          event.stopPropagation()
          quoteFileToAgent(filePath, undefined, repo)
          return
        }
      }

      // b) Folder row in tree
      const hoveredFolderEl = (document.querySelector('[data-git-tree-id]:hover') as HTMLElement | null) || (activeEl?.closest('[data-git-tree-id]') as HTMLElement | null)
      if (hoveredFolderEl) {
        const folderPath = hoveredFolderEl.getAttribute('data-git-tree-id')
        if (folderPath && !folderPath.startsWith('section:')) {
          event.preventDefault()
          event.stopPropagation()
          quoteFolderToAgent(folderPath, repo)
          return
        }
      }

      // c) Commit row in graph/table
      const hoveredCommitEl = (document.querySelector('[data-git-commit-hash]:hover') as HTMLElement | null) || (activeEl?.closest('[data-git-commit-hash]') as HTMLElement | null)
      if (hoveredCommitEl) {
        const hash = hoveredCommitEl.getAttribute('data-git-commit-hash')
        if (hash) {
          event.preventDefault()
          event.stopPropagation()
          const c = commits?.find((x) => x.hash === hash)
          quoteCommitToAgent(c ? { hash: c.hash, summary: c.subject, author: c.author } : { hash, summary: '' }, repo)
          return
        }
      }

      // d) Branch row in sidebar
      const hoveredBranchEl =
        (document.querySelector('[data-git-sidebar-branch]:hover') as HTMLElement | null) || (activeEl?.closest('[data-git-sidebar-branch]') as HTMLElement | null)
      if (hoveredBranchEl) {
        const branchName = hoveredBranchEl.getAttribute('data-git-sidebar-branch')
        if (branchName) {
          event.preventDefault()
          event.stopPropagation()
          quoteBranchToAgent(branchName, false, repo)
          return
        }
      }

      // 2. If nothing directly hovered, check panel scope
      // a) Files panel or Diff panel
      const filesPanelHovered = document.querySelector('[data-git-find="files"]:hover, [data-git-find="diff"]:hover')
      if (filesPanelHovered && selectedFile) {
        event.preventDefault()
        event.stopPropagation()
        quoteFileToAgent(selectedFile, selectedStatus, repo)
        return
      }

      // b) Graph panel
      const graphPanelHovered = document.querySelector('[data-git-graph-pan]:hover, [data-git-commit-hash]:hover')
      if (graphPanelHovered && selectedHash) {
        event.preventDefault()
        event.stopPropagation()
        const c = commits?.find((x) => x.hash === selectedHash)
        quoteCommitToAgent(c ? { hash: c.hash, summary: c.subject, author: c.author } : { hash: selectedHash, summary: '' }, repo)
        return
      }

      // c) Sidebar panel
      const sidebarHovered = document.querySelector('[data-git-sidebar]:hover, [data-git-find^="sidebar"]:hover')
      if (sidebarHovered && currentBranch) {
        event.preventDefault()
        event.stopPropagation()
        quoteBranchToAgent(currentBranch, false, repo)
        return
      }

      // 3. Fallback: quote current selection
      if (selectedFile) {
        event.preventDefault()
        event.stopPropagation()
        quoteFileToAgent(selectedFile, selectedStatus, repo)
        return
      }

      if (selectedHash) {
        event.preventDefault()
        event.stopPropagation()
        const c = commits?.find((x) => x.hash === selectedHash)
        quoteCommitToAgent(c ? { hash: c.hash, summary: c.subject, author: c.author } : { hash: selectedHash, summary: '' }, repo)
        return
      }

      if (currentBranch) {
        event.preventDefault()
        event.stopPropagation()
        quoteBranchToAgent(currentBranch, false, repo)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
