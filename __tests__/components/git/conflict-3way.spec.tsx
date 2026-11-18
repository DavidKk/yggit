/** @jest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { CommitStatusBadge } from '@/components/git/CommitStatusBadge'
import { GitCodePane } from '@/components/git/GitCodePane'
import { GitConflict3WayDiff } from '@/components/git/GitConflict3WayDiff'
import type { MergeConflictRecord } from '@/lib/git/conflict-cache'
import type { GitCommit } from '@/lib/git/types'

jest.mock('@/components/i18n/LocaleProvider', () => {
  const t = (key: string) => key
  return { useT: () => t }
})

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.querySelectorAll('div').forEach((el) => {
    if (el !== container && el.parentElement === document.body) {
      el.remove()
    }
  })
})

const p1: GitCommit = {
  hash: '1111111111111111111111111111111111111111',
  short: '1111111',
  parents: [],
  refs: ['refs/heads/main'],
  author: 'Author',
  date: '2026-01-01',
  subject: 'Parent 1',
}

const p2: GitCommit = {
  hash: '2222222222222222222222222222222222222222',
  short: '2222222',
  parents: [],
  refs: ['refs/heads/feature/test'],
  author: 'Author',
  date: '2026-01-02',
  subject: 'Parent 2',
}

const mergeCommit: GitCommit = {
  hash: '3333333333333333333333333333333333333333',
  short: '3333333',
  parents: [p1.hash, p2.hash],
  refs: [],
  author: 'Author',
  date: '2026-01-03',
  subject: "Merge branch 'feature/test' into main",
}

const conflictRecord: MergeConflictRecord = {
  hash: mergeCommit.hash,
  hasConflict: true,
  conflictCount: 2,
  conflictFiles: ['pkg/app.go', 'go.mod'],
  status: 'conflicted',
  analyzedAt: Date.now(),
}

it('keeps code visible when the same file changes from a long version to a short version', async () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({ text: `line ${index}`, number: index + 1 }))
  await act(async () => root.render(<GitCodePane label="result" path="app.go" rows={rows} />))
  const scroller = container.querySelector('[data-code-line]')!.parentElement!.parentElement!.parentElement!
  await act(async () => {
    scroller.scrollTop = 15000
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
  })
  expect(container.textContent).not.toContain('line 0')
  await act(async () => root.render(<GitCodePane label="result" path="app.go" rows={[{ text: 'short result', number: 1 }]} />))
  expect(scroller.scrollTop).toBe(0)
  expect(container.textContent).toContain('short result')
})

describe('CommitStatusBadge', () => {
  it('uses a tooltip trigger without a rich popover and opens comparison directly', async () => {
    const onOpen = jest.fn()
    await act(async () => {
      root.render(<CommitStatusBadge commit={mergeCommit} conflict={conflictRecord} onOpenConflictView={onOpen} />)
    })
    const badgeBtn = container.querySelector('button')!
    expect(badgeBtn.getAttribute('aria-label')).toBe('git.history.historicalConflicts')
    expect(badgeBtn.className).toContain('text-warn')
    await act(async () => {
      badgeBtn.click()
    })
    expect(document.body.textContent).not.toContain('合并冲突 (已解决)')
    expect(document.body.textContent).not.toContain('查看 3 视窗对比')
    expect(onOpen).toHaveBeenCalledWith(mergeCommit.hash, 'pkg/app.go')
  })
})

describe('GitConflict3WayDiff', () => {
  beforeEach(() => {
    // Mock global fetch for blob reading
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/git/blob')) {
        if (url.includes(p1.hash)) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('code on parent1\nline 2') })
        }
        if (url.includes(p2.hash)) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('code on parent2\nline 2 changed') })
        }
        if (url.includes(mergeCommit.hash)) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve('merged code\nline 2 resolved') })
        }
      }
      if (url.includes('/api/git/conflicts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ diff: 'remerge diff output', files: ['pkg/app.go'] }),
        })
      }
      return Promise.resolve({ ok: false, text: () => Promise.resolve('') })
    }) as jest.Mock
  })

  it('renders 3 viewports for base, incoming, and merged result', async () => {
    const onClose = jest.fn()
    const onSelectPath = jest.fn()

    await act(async () => {
      root.render(
        <GitConflict3WayDiff
          repo="/test/repo"
          commit={mergeCommit}
          commits={[mergeCommit, p1, p2]}
          conflict={conflictRecord}
          selectedPath="pkg/app.go"
          onSelectPath={onSelectPath}
          onClose={onClose}
        />
      )
    })

    expect(container.textContent).toContain('git.diff.conflictComparison')
    expect(container.textContent).toContain('pkg/app.go')

    // Check 3 viewports
    expect(container.textContent).toContain('git.diff.parentOne')
    expect(container.textContent).toContain('git.diff.parentTwo')
    expect(container.textContent).toContain('git.diff.mergeResult')

    expect(container.querySelectorAll('button[aria-label^="git.diff.searchContent"]')).toHaveLength(3)
    expect(container.textContent).not.toContain('曾发生冲突')

    // Click close button
    const closeBtn = container.querySelector('button[aria-label="common.close"]')
    expect(closeBtn).toBeTruthy()
    await act(async () => {
      closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalled()
  })
})

it('cycles conflict targets in both directions across all three panes', async () => {
  const content = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n')
  const patch = [
    'diff --git a/pkg/app.go b/pkg/app.go',
    '--- a/pkg/app.go',
    '+++ b/pkg/app.go',
    '@@ -1,5 +1,1 @@',
    '-<<<<<<< ours',
    '-line 1',
    '-=======',
    '-line 2',
    '->>>>>>> theirs',
    '+resolved',
    '@@ -10,5 +30,1 @@',
    '-<<<<<<< ours',
    '-line 30',
    '-=======',
    '-line 31',
    '->>>>>>> theirs',
    '+resolved',
  ].join('\n')
  global.fetch = jest
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(url.includes('/api/git/blob') ? { ok: true, text: async () => content } : { ok: true, json: async () => ({ diff: patch, files: ['pkg/app.go'] }) })
    )
  await act(async () =>
    root.render(
      <GitConflict3WayDiff repo="/navigation-test" commit={mergeCommit} commits={[mergeCommit, p1, p2]} selectedPath="pkg/app.go" onSelectPath={jest.fn()} onClose={jest.fn()} />
    )
  )
  const targets = () => [...container.querySelectorAll('[data-code-line]')].filter((el) => el.classList.contains('bg-warn/15')).map((el) => el.getAttribute('data-code-line'))
  const next = container.querySelector<HTMLButtonElement>('[aria-label="git.diff.nextConflict"]')!
  const previous = container.querySelector<HTMLButtonElement>('[aria-label="git.diff.previousConflict"]')!
  expect(next.disabled).toBe(false)
  await act(async () => next.click())
  expect(targets()).toEqual(['1', '2', '0'])
  await act(async () => next.click())
  expect(targets()).toEqual(['30', '31', '29'])
  await act(async () => next.click())
  expect(targets()).toEqual(['1', '2', '0'])
  await act(async () => previous.click())
  expect(targets()).toEqual(['30', '31', '29'])
})
