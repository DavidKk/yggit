/** @jest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { GitMergePanel } from '@/components/git/GitMergePanel'
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
  refs: ['refs/heads/feat/foo'],
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
  subject: "Merge branch 'feat/foo' into main",
}

it('returns null for non-merge commits', async () => {
  await act(async () => {
    root.render(<GitMergePanel commit={p1} commits={[p1, p2]} highlighted={false} onHighlight={jest.fn()} onLocate={jest.fn()} />)
  })
  expect(container.innerHTML).toBe('')
})

it('renders merge lineage controls and calls onHighlight and onLocate', async () => {
  const onHighlight = jest.fn()
  const onLocate = jest.fn()
  const onClose = jest.fn()

  await act(async () => {
    root.render(<GitMergePanel commit={mergeCommit} commits={[mergeCommit, p1, p2]} highlighted={false} onHighlight={onHighlight} onLocate={onLocate} onClose={onClose} />)
  })

  expect(container.textContent).toContain('git.commit.mergeLineage')

  // Click source or target button
  const buttons = container.querySelectorAll('button')
  const sourceBtn = [...buttons].find((b) => b.title === 'feat/foo' || b.textContent?.includes('feat/foo'))
  expect(sourceBtn).toBeTruthy()
  await act(async () => sourceBtn?.click())
  expect(onLocate).toHaveBeenCalledWith(p2.hash)

  // Toggle highlight
  const highlightBtn = [...buttons].find((b) => b.getAttribute('aria-pressed') === 'false' || b.getAttribute('aria-label') === 'git.commit.highlightLineage')
  expect(highlightBtn).toBeTruthy()
  await act(async () => highlightBtn?.click())
  expect(onHighlight).toHaveBeenCalledWith(true, expect.any(Array))
})

it('does not render conflict badge when conflict is not present or clean', async () => {
  await act(async () => {
    root.render(
      <GitMergePanel
        commit={mergeCommit}
        commits={[mergeCommit, p1, p2]}
        conflict={{ hash: mergeCommit.hash, hasConflict: false, status: 'clean', analyzedAt: Date.now() }}
        highlighted={false}
        onHighlight={jest.fn()}
        onLocate={jest.fn()}
      />
    )
  })

  expect(container.querySelector('[aria-label*="曾发生冲突"]')).toBeNull()
})

it('renders conflict badge when conflict is detected and calls onOpenConflictView on click', async () => {
  const onOpenConflictView = jest.fn()
  await act(async () => {
    root.render(
      <GitMergePanel
        commit={mergeCommit}
        commits={[mergeCommit, p1, p2]}
        conflict={{ hash: mergeCommit.hash, hasConflict: true, conflictCount: 3, conflictFiles: ['a.ts', 'b.ts', 'c.ts'], status: 'conflicted', analyzedAt: Date.now() }}
        highlighted={false}
        onHighlight={jest.fn()}
        onLocate={jest.fn()}
        onOpenConflictView={onOpenConflictView}
      />
    )
  })

  const conflictBtn =
    container.querySelector<HTMLButtonElement>('button[aria-label="git.operations.conflictBadge"]') || container.querySelector<HTMLButtonElement>('button[aria-label="曾发生冲突"]')
  expect(conflictBtn).toBeTruthy()
  await act(async () => conflictBtn?.click())
  expect(onOpenConflictView).toHaveBeenCalled()
})
