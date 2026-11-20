/** @jest-environment jsdom */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import { GitGraph } from '@/components/git/GitGraph'
import { NotificationProvider } from '@/components/notification/NotificationProvider'
import type { GitCommit } from '@/lib/git/types'

it('shows a secondary branch badge and its node connector on pointer hover', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const commit = (hash: string, parents: string[], refs: string[] = []): GitCommit => ({
    hash,
    short: hash,
    parents,
    refs,
    author: 'Developer',
    date: '2026-11-18',
    subject: hash,
  })
  const commits = [
    commit('merge', ['main', 'other-tip'], ['HEAD -> main']),
    commit('other-tip', ['other'], ['origin/feature']),
    commit('other', ['base']),
    commit('main', ['base']),
    commit('base', []),
  ]
  try {
    await act(async () => {
      root.render(
        <NotificationProvider>
          <GitGraph
            commits={commits}
            worktree={null}
            remoteNames={['origin']}
            highlight="main"
            conflicts={{ merge: { hash: 'merge', hasConflict: true, status: 'conflicted', analyzedAt: 1, conflictCount: 1, unresolvedConflictFiles: ['file.txt'] } }}
          />
        </NotificationProvider>
      )
    })
    const merge = host.querySelector('[data-git-commit-hash="merge"]')!
    const cell = merge.querySelector('[data-git-message-cell]')!
    expect(cell.className).not.toContain('bg-[color-mix')
    const warning = cell.querySelector('button')!
    expect(warning.className).toContain('text-danger')
    const row = host.querySelector('[data-git-commit-hash="other"]')!
    const badge = row.querySelector('[title="feature"]')!
    const connector = () => host.querySelector('line[y1="65"]')
    expect(badge.classList.contains('hidden')).toBe(true)
    expect(connector()).toBeNull()
    await act(async () => {
      row.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, relatedTarget: document.body }))
    })
    expect(badge.classList.contains('hidden')).toBe(false)
    expect(connector()).not.toBeNull()
    await act(async () => {
      row.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body }))
    })
    expect(badge.classList.contains('hidden')).toBe(true)
    expect(connector()).toBeNull()
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})

it('cleans up graph drag listeners on cancellation and unmount', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const add = jest.spyOn(window, 'addEventListener')
  const remove = jest.spyOn(window, 'removeEventListener')
  let mounted = true
  try {
    await act(async () => {
      root.render(
        <NotificationProvider>
          <GitGraph commits={[{ hash: 'tip', short: 'tip', parents: [], refs: [], author: 'Developer', date: '2026-11-18', subject: 'tip' }]} worktree={null} highlight="main" />
        </NotificationProvider>
      )
    })
    const pan = host.querySelector<HTMLElement>('[data-git-graph-pan]')!
    Object.defineProperties(pan, { scrollWidth: { value: 500 }, clientWidth: { value: 100 } })
    const x = Number.parseFloat(document.documentElement.style.getPropertyValue('--git-branch-w')) + 20
    const start = async () => {
      await act(async () => {
        pan.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: x }))
        window.dispatchEvent(new MouseEvent('pointermove', { clientX: x - 20 }))
      })
      const move = add.mock.calls.findLast(([type]) => type === 'pointermove')?.[1]
      expect(move).toBeDefined()
      return move
    }
    const firstMove = await start()
    await act(async () => window.dispatchEvent(new MouseEvent('pointercancel')))
    expect(remove).toHaveBeenCalledWith('pointermove', firstMove)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    window.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    const nextMove = await start()
    await act(async () => root.unmount())
    mounted = false
    expect(remove).toHaveBeenCalledWith('pointermove', nextMove)
  } finally {
    if (mounted) await act(async () => root.unmount())
    host.remove()
    add.mockRestore()
    remove.mockRestore()
  }
})
