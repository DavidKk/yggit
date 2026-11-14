import { commitsReachableFromRef, gitSelectionHash } from '@/lib/git/scope'
import type { GitCommit, GitLogView } from '@/lib/git/types'

function commit(hash: string, parents: string[], refs: string[] = []): GitCommit {
  return { hash, short: hash, parents, author: 'Ada', date: '2026-11-13T10:00:00+08:00', refs, subject: hash }
}

describe('commitsReachableFromRef', () => {
  const commits = [commit('c', ['b'], ['HEAD -> feature']), commit('b', ['a'], ['main']), commit('a', [])]

  it('keeps the named branch and its ancestors', () => {
    expect(commitsReachableFromRef(commits, 'feature').map((item) => item.hash)).toEqual(['c', 'b', 'a'])
  })

  it('drops commits that are not ancestors of the ref', () => {
    expect(commitsReachableFromRef(commits, 'main').map((item) => item.hash)).toEqual(['b', 'a'])
  })

  it('matches tags', () => {
    const tagged = [commit('t', [], ['tag: v1'])]
    expect(commitsReachableFromRef(tagged, 'v1')).toHaveLength(1)
  })
})

describe('gitSelectionHash', () => {
  const view = {
    branches: [{ name: 'feature/editor', tip: 'local-tip' }],
    remotes: [{ name: 'origin/test', tip: 'remote-tip' }],
    tags: [{ name: 'v1', tip: 'tag-tip' }],
    stashes: [{ name: 'stash@{2}', hash: 'stash-hash', base: 'stash-base' }],
    worktrees: [{ path: '/worktree', head: 'worktree-head' }],
  } as GitLogView

  it('resolves each sidebar entry to its own node, including the stash rather than its base', () => {
    expect(gitSelectionHash(view, { kind: 'local', name: 'feature/editor' })).toBe('local-tip')
    expect(gitSelectionHash(view, { kind: 'remote', name: 'origin/test' })).toBe('remote-tip')
    expect(gitSelectionHash(view, { kind: 'tag', name: 'v1' })).toBe('tag-tip')
    expect(gitSelectionHash(view, { kind: 'stash', name: 'stash@{2}' })).toBe('stash-hash')
    expect(gitSelectionHash(view, { kind: 'worktree', path: '/worktree' })).toBe('worktree-head')
    expect(gitSelectionHash(view, { kind: 'local', name: 'missing' })).toBe('')
    expect(gitSelectionHash(view, { kind: 'all' })).toBe('')
  })
})
