/** @jest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { agentQuoteShortcutLabel, isAgentQuoteChord, useAgentQuoteGlobalShortcut } from '@/components/git/agent/agentQuoteShortcut'

// @ts-expect-error global flag for react act
globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('agentQuoteShortcut', () => {
  describe('isAgentQuoteChord', () => {
    it('matches Alt + A', () => {
      expect(isAgentQuoteChord({ altKey: true, shiftKey: false, metaKey: false, ctrlKey: false, key: 'a' })).toBe(true)
      expect(isAgentQuoteChord({ altKey: true, shiftKey: false, metaKey: false, ctrlKey: false, key: 'A' })).toBe(true)
    })

    it('matches Cmd + Shift + A or Ctrl + Shift + A', () => {
      expect(isAgentQuoteChord({ altKey: false, shiftKey: true, metaKey: true, ctrlKey: false, key: 'a' })).toBe(true)
      expect(isAgentQuoteChord({ altKey: false, shiftKey: true, metaKey: false, ctrlKey: true, key: 'a' })).toBe(true)
    })

    it('rejects Q and W chords to prevent accidental tab close or app quit', () => {
      // Alt + Q
      expect(isAgentQuoteChord({ altKey: true, shiftKey: false, metaKey: false, ctrlKey: false, key: 'q' })).toBe(false)
      // Cmd + Q
      expect(isAgentQuoteChord({ altKey: false, shiftKey: false, metaKey: true, ctrlKey: false, key: 'q' })).toBe(false)
      // Cmd + W
      expect(isAgentQuoteChord({ altKey: false, shiftKey: false, metaKey: true, ctrlKey: false, key: 'w' })).toBe(false)
      // Alt + W
      expect(isAgentQuoteChord({ altKey: true, shiftKey: false, metaKey: false, ctrlKey: false, key: 'w' })).toBe(false)
      // Cmd + F (Find chord)
      expect(isAgentQuoteChord({ altKey: false, shiftKey: false, metaKey: true, ctrlKey: false, key: 'f' })).toBe(false)
    })

    it('provides shortcut label based on platform', () => {
      expect(agentQuoteShortcutLabel(true)).toBe('⌥A')
      expect(agentQuoteShortcutLabel(false)).toBe('Alt+A')
    })
  })

  describe('useAgentQuoteGlobalShortcut', () => {
    let root: Root
    let host: HTMLDivElement
    let eventDispatched: CustomEvent | null = null

    const handleAgentOpen = (e: Event) => {
      eventDispatched = e as CustomEvent
    }

    beforeEach(() => {
      eventDispatched = null
      host = document.createElement('div')
      document.body.appendChild(host)
      root = createRoot(host)
      window.addEventListener('yggit:agent_open', handleAgentOpen)
    })

    afterEach(() => {
      act(() => {
        root.unmount()
      })
      host.remove()
      window.removeEventListener('yggit:agent_open', handleAgentOpen)
    })

    function ShortcutTestComponent(props: {
      repo?: string
      currentBranch?: string
      selectedHash?: string
      selectedFile?: string
      commits?: Array<{ hash: string; subject: string; author?: string }>
    }) {
      useAgentQuoteGlobalShortcut(props)
      return (
        <div>
          <div data-git-file-path="src/utils/math.ts" className="file-row">
            math.ts
          </div>
          <div data-git-commit-hash="abcd1234efgh" className="commit-row">
            fix: test
          </div>
          <div data-git-sidebar-branch="feature/login" className="branch-row">
            feature/login
          </div>
        </div>
      )
    }

    it('quotes selected file when shortcut is pressed and no element is hovered', () => {
      act(() => {
        root.render(<ShortcutTestComponent repo="my-repo" selectedFile="src/core/main.ts" currentBranch="main" />)
      })

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'a',
            altKey: true,
            bubbles: true,
            cancelable: true,
          })
        )
      })

      expect(eventDispatched).not.toBeNull()
      expect(eventDispatched?.detail.reference.kind).toBe('file')
      expect(eventDispatched?.detail.reference.path).toBe('src/core/main.ts')
    })

    it('quotes selected commit when no file is selected', () => {
      act(() => {
        root.render(
          <ShortcutTestComponent repo="my-repo" selectedHash="abcd1234efgh" commits={[{ hash: 'abcd1234efgh', subject: '修复崩溃问题', author: 'Bob' }]} currentBranch="main" />
        )
      })

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'a',
            altKey: true,
            bubbles: true,
            cancelable: true,
          })
        )
      })

      expect(eventDispatched).not.toBeNull()
      expect(eventDispatched?.detail.reference.kind).toBe('commit')
      expect(eventDispatched?.detail.reference.commit).toBe('abcd1234efgh')
      expect(eventDispatched?.detail.reference.summary).toBe('修复崩溃问题')
    })

    it('quotes current branch when nothing is selected', () => {
      act(() => {
        root.render(<ShortcutTestComponent repo="my-repo" currentBranch="release-2.0" />)
      })

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'a',
            altKey: true,
            bubbles: true,
            cancelable: true,
          })
        )
      })

      expect(eventDispatched).not.toBeNull()
      expect(eventDispatched?.detail.reference.kind).toBe('branch')
      expect(eventDispatched?.detail.reference.branch).toBe('release-2.0')
    })

    it('does not trigger shortcut when activeElement is an input or textarea', () => {
      act(() => {
        root.render(<ShortcutTestComponent repo="my-repo" selectedFile="src/index.ts" />)
      })

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      act(() => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'a',
            altKey: true,
            bubbles: true,
            cancelable: true,
          })
        )
      })

      expect(eventDispatched).toBeNull()
      input.remove()
    })
  })
})
