/** @jest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { RefChipsCell } from '@/components/git/RefChipsCell'
import { NotificationProvider } from '@/components/notification/NotificationProvider'
import type { GitCommit } from '@/lib/git/types'

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

const mockCommit: GitCommit = {
  hash: 'abc1234',
  short: 'abc1234',
  author: 'Developer <dev@example.com>',
  date: '2026-11-16 00:00:00',
  subject: 'feat: new branch feature',
  parents: ['def5678'],
  refs: ['refs/heads/feature-xyz'],
}

it('invokes onSelectCommit when clicking the branch chip badge', async () => {
  const onSelectCommit = jest.fn()
  await act(async () => {
    root.render(
      <NotificationProvider>
        <RefChipsCell
          chips={[{ name: 'feature-xyz', label: 'feature-xyz', kind: 'local' }]}
          commit={mockCommit}
          checkedOut={new Set()}
          color="#3b82f6"
          onSelectCommit={onSelectCommit}
        />
      </NotificationProvider>
    )
  })

  const trigger = host.querySelector('[data-git-ref-menu-trigger]') as HTMLElement
  expect(trigger).not.toBeNull()

  await act(async () => {
    trigger.click()
  })

  expect(onSelectCommit).toHaveBeenCalledTimes(1)
  expect(onSelectCommit).toHaveBeenCalledWith(mockCommit)
})

it('synchronously dismisses tooltip when right-click context menu is closed', async () => {
  await act(async () => {
    root.render(
      <NotificationProvider>
        <RefChipsCell chips={[{ name: 'feature-xyz', label: 'feature-xyz', kind: 'local' }]} commit={mockCommit} checkedOut={new Set()} color="#3b82f6" />
      </NotificationProvider>
    )
  })

  const trigger = host.querySelector('[data-git-ref-menu-trigger]') as HTMLElement
  expect(trigger).not.toBeNull()

  // Hover to open overlay badge stack
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }))
  })
  expect(document.querySelector('[data-git-ref-badges-hover]')).not.toBeNull()

  // Right-click to open context menu
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })
  const menus = document.querySelectorAll('[data-git-floating-menu]')
  expect(menus.length).toBeGreaterThanOrEqual(1)

  // Press Escape to close context menu
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })

  // Both context menu and overlay badges should be synchronously dismissed
  expect(document.querySelectorAll('[data-git-floating-menu]').length).toBe(0)
  expect(document.querySelectorAll('[data-git-ref-badges-hover]').length).toBe(0)
})

it('dismisses open context menu and tooltip when scrolling', async () => {
  await act(async () => {
    root.render(
      <NotificationProvider>
        <RefChipsCell chips={[{ name: 'feature-xyz', label: 'feature-xyz', kind: 'local' }]} commit={mockCommit} checkedOut={new Set()} color="#3b82f6" />
      </NotificationProvider>
    )
  })

  const trigger = host.querySelector('[data-git-ref-menu-trigger]') as HTMLElement

  // Hover and right-click
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }))
    trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })
  expect(document.querySelectorAll('[data-git-floating-menu]').length).toBeGreaterThanOrEqual(1)

  // Scroll event on window or container
  await act(async () => {
    window.dispatchEvent(new Event('scroll'))
  })

  // All floating menus should be dismissed immediately
  expect(document.querySelectorAll('[data-git-floating-menu]').length).toBe(0)
})

it('dismisses open context menu and tooltip when wheel gesture occurs outside', async () => {
  await act(async () => {
    root.render(
      <NotificationProvider>
        <RefChipsCell chips={[{ name: 'feature-xyz', label: 'feature-xyz', kind: 'local' }]} commit={mockCommit} checkedOut={new Set()} color="#3b82f6" />
      </NotificationProvider>
    )
  })

  const trigger = host.querySelector('[data-git-ref-menu-trigger]') as HTMLElement

  // Hover and right-click
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }))
    trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })
  expect(document.querySelectorAll('[data-git-floating-menu]').length).toBeGreaterThanOrEqual(1)

  // Wheel gesture with delta > 3
  await act(async () => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 15, bubbles: true }))
  })

  expect(document.querySelectorAll('[data-git-floating-menu]').length).toBe(0)
})
