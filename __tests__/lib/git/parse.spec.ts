import { parseGitBranches, parseGitLog, parseGitRemotes, parseGitStashes, parseGitSubmodules, parseGitTags, parseGitWorktrees } from '@/lib/git/parse'

describe('git log parse', () => {
  it('splits commits and decorations', () => {
    const raw = ['aaa', 'aaaaaaa', 'bbb', 'Ada', '2026-11-13T10:00:00+08:00', 'HEAD -> main, origin/main', 'init'].join('\x1f') + '\x1e'
    expect(parseGitLog(raw)).toEqual([
      {
        hash: 'aaa',
        short: 'aaaaaaa',
        parents: ['bbb'],
        author: 'Ada',
        date: '2026-11-13T10:00:00+08:00',
        refs: ['HEAD -> main', 'origin/main'],
        subject: 'init',
      },
    ])
  })

  it('reads local branches', () => {
    const raw = ['main', 'origin/main', '*', 'abc'].join('\0') + '\n' + ['feature', '', '', 'def'].join('\0') + '\n'
    expect(parseGitBranches(raw)).toEqual([
      { name: 'main', upstream: 'origin/main', current: true, tip: 'abc' },
      { name: 'feature', upstream: '', current: false, tip: 'def' },
    ])
  })

  it('skips remote HEAD and keeps the remote name', () => {
    const raw = ['origin/HEAD', 'abc'].join('\0') + '\n' + ['origin/main', 'def'].join('\0') + '\n'
    expect(parseGitRemotes(raw)).toEqual([{ name: 'origin/main', remote: 'origin', branch: 'main', tip: 'def' }])
  })

  it('prefers a peeled tag commit', () => {
    const raw = ['v1', 'commit', 'tag-object'].join('\0') + '\n'
    expect(parseGitTags(raw)).toEqual([{ name: 'v1', tip: 'commit' }])
  })

  it('reads stash entries', () => {
    const raw = ['stash@{0}', 'abc', 'parent1 parent2', '2024-01-02T03:04:05+00:00', 'wip'].join('\x1f') + '\n'
    expect(parseGitStashes(raw)).toEqual([
      { name: 'stash@{0}', hash: 'abc', base: 'parent1', date: '2024-01-02T03:04:05+00:00', subject: 'wip' },
    ])
  })

  it('reads worktrees and submodules', () => {
    const worktrees = 'worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /other\nHEAD def\ndetached\n'
    expect(parseGitWorktrees(worktrees)).toEqual([
      { path: '/repo', head: 'abc', branch: 'main', current: false },
      { path: '/other', head: 'def', branch: '', current: false },
    ])
    expect(parseGitSubmodules(' abcdef0 path/to/lib (v1)\n', '/repo')).toEqual([{ path: 'path/to/lib', repo: '/repo/path/to/lib', hash: 'abcdef0', describe: 'v1' }])
  })
})
