/** @jest-environment jsdom */

import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { GitCommitPanel } from '@/components/git/GitCommitPanel'
import { areCommitListsEquivalent, hasGitLogViewMetadataChanged, reconcileCommitsPreservingRefs } from '@/lib/git/refresh-diff'
import type { GitCommit, GitLogView } from '@/lib/git/types'

jest.mock('@/components/i18n/LocaleProvider', () => ({ useT: () => (key: string) => key, useLocaleCode: () => 'zh' }))
jest.mock('@/components/git/GitSearchDropdown', () => ({ GitSearchDropdown: () => null }))
jest.mock('@/lib/git/driver', () => ({
  getGitDriver: () => ({
    readCommitDiff: jest.fn().mockResolvedValue({ files: [{ path: 'go.mod', status: 'M', additions: 1, deletions: 0 }] }),
  }),
}))
jest.mock('@/lib/git/ui-prefs', () => ({
  useGitUiPref: (_key: string, initial: unknown) => [initial, jest.fn()],
}))

function makeCommit(hash: string, refs: string[] = []): GitCommit {
  return {
    hash,
    short: hash.slice(0, 7),
    subject: `commit ${hash.slice(0, 7)}`,
    author: 'dev',
    date: '2026-11-25T10:00:00Z',
    parents: [],
    refs,
  }
}

function makeView(commits: GitCommit[]): GitLogView {
  return {
    repo: '/tmp/repo',
    displayPath: '/tmp/repo',
    head: 'main',
    branch: 'main',
    commits,
    hasMore: false,
    branches: [{ name: 'main', tip: commits[0]?.hash || '', current: true, upstream: 'origin/main' }],
    remotes: [],
    tags: [],
    stashes: [],
    worktrees: [],
    submodules: [],
    marks: {},
    worktree: null,
  }
}

describe('git refresh diff & render stability', () => {
  it('detects zero-change refreshes and preserves commit object references when new commits arrive', () => {
    const c1 = makeCommit('aaa1111', ['HEAD -> main'])
    const c2 = makeCommit('bbb2222')
    const prevView = makeView([c1, c2])
    const sameNextView = makeView([makeCommit('aaa1111', ['HEAD -> main']), makeCommit('bbb2222')])

    expect(areCommitListsEquivalent(prevView.commits, sameNextView.commits)).toBe(true)
    expect(hasGitLogViewMetadataChanged(prevView, sameNextView)).toBe(false)

    // A new commit c0 arrives on another branch, while c2 (the selected commit) is unchanged
    const c0 = makeCommit('0000000', ['origin/feat'])
    const reconciled = reconcileCommitsPreservingRefs([c1, c2], [c0, makeCommit('aaa1111', ['HEAD -> main']), makeCommit('bbb2222')])
    expect(reconciled).toHaveLength(3)
    expect(reconciled[1]).toBe(c1)
    expect(reconciled[2]).toBe(c2)
  })

  it('does not re-render GitCommitPanel when parent re-renders with new callback identities for the same commit', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    const host = document.createElement('div')
    document.body.append(host)
    const root: Root = createRoot(host)

    let panelRenderCount = 0
    const origAside = React.createElement
    void origAside

    // Wrap GitCommitPanel to count actual renders of the memoized component via onFilesLoaded / DOM stability
    const spySelect = jest.fn()
    const selectedCommit = makeCommit('775aa38b2391845303f4c4cefee9b0fa7ce40c57')

    let triggerParentTick!: () => void
    function Harness() {
      const [tick, setTick] = useState(0)
      triggerParentTick = () => setTick((v) => v + 1)
      return (
        <div data-tick={tick}>
          <GitCommitPanel
            repo="/tmp/repo"
            commit={makeCommit(selectedCommit.hash)}
            width={320}
            selectedPath="go.mod"
            onSelect={() => spySelect(tick)}
            onFilesLoaded={() => {
              panelRenderCount += 1
            }}
            onClose={() => {}}
          />
        </div>
      )
    }

    await act(async () => root.render(<Harness />))
    expect(panelRenderCount).toBe(1)

    // Trigger parent re-render with fresh inline callbacks and fresh commit object for same hash
    await act(async () => triggerParentTick())
    await act(async () => triggerParentTick())

    // GitCommitPanel must NOT re-fetch or re-invoke onFilesLoaded
    expect(panelRenderCount).toBe(1)

    await act(async () => root.unmount())
    host.remove()
  })
})
