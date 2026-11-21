/** @jest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { GitSidebar } from '@/components/git/GitSidebar'
import { NotificationProvider } from '@/components/notification/NotificationProvider'
import type { GitLogView } from '@/lib/git/types'

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

const mockView: GitLogView = {
  repo: '/path/to/repo',
  displayPath: 'repo',
  head: 'feature/current',
  branch: 'feature/current',
  branches: [
    { name: 'feature/current', current: true, tip: '1111111', upstream: '' },
    { name: 'feature/feat-a', current: false, tip: '2222222', upstream: '' },
    { name: 'feature/feat-b', current: false, tip: '3333333', upstream: '' },
    { name: 'main', current: false, tip: '0000000', upstream: '' },
  ],
  remotes: [
    { name: 'origin/remote-group/feat-x', remote: 'origin', branch: 'remote-group/feat-x', tip: '4444444' },
    { name: 'origin/remote-group/feat-y', remote: 'origin', branch: 'remote-group/feat-y', tip: '5555555' },
  ],
  tags: [],
  stashes: [],
  worktrees: [],
  submodules: [],
  commits: [],
  hasMore: false,
  marks: {},
  worktree: null,
}

describe('GitSidebar folder batch deletion & menu order', () => {
  it('shows batch delete for local folder and skips current branch', async () => {
    await act(async () => {
      root.render(
        <NotificationProvider>
          <GitSidebar view={mockView} selection={{ kind: 'all' }} width={250} onSelect={jest.fn()} onOpenRepo={jest.fn()} />
        </NotificationProvider>
      )
    })

    // Find the 'feature' folder item
    const folder = host.querySelector('[data-git-tree-id="local:feature"]') as HTMLElement
    expect(folder).not.toBeNull()

    // Trigger context menu
    await act(async () => {
      folder.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }))
    })

    // Find delete-folder-branches action
    const deleteBtn = document.querySelector('[data-menu-key="delete-folder-branches"]') as HTMLElement
    expect(deleteBtn).not.toBeNull()
    expect(deleteBtn.textContent).toContain('2') // feature/feat-a and feature/feat-b (skipping feature/current)

    // Click delete to open modal
    await act(async () => {
      deleteBtn.click()
    })

    // Verify modal is open
    expect(document.body.textContent).toContain('feature/current')
    expect(document.body.textContent).toContain('feature/feat-a')
    expect(document.body.textContent).toContain('feature/feat-b')
  })

  it('does NOT offer delete-folder-branches on remote folders', async () => {
    await act(async () => {
      root.render(
        <NotificationProvider>
          <GitSidebar view={mockView} selection={{ kind: 'all' }} width={250} onSelect={jest.fn()} onOpenRepo={jest.fn()} />
        </NotificationProvider>
      )
    })

    // Open remote section
    const remoteSecBtn = host.querySelector('[data-git-tree-id="section:remote"]') as HTMLElement
    expect(remoteSecBtn).not.toBeNull()
    await act(async () => {
      remoteSecBtn.click()
    })

    const remoteFolder = host.querySelector('[data-git-tree-id="remote:origin:remote-group"]') as HTMLElement
    if (remoteFolder) {
      await act(async () => {
        remoteFolder.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }))
      })
      const deleteBtn = document.querySelector('[data-menu-key="delete-folder-branches"]')
      expect(deleteBtn).toBeNull()
    }
  })
})
