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
