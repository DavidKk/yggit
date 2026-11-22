import type { GitBranch, GitLogView, GitProjectView } from '@/lib/git/types'
import { detectDefaultBranchSync } from '@/lib/workdesk/detectors/branch-sync'

describe('DefaultBranchSyncDetector', () => {
  const baseProject: GitProjectView = {
    id: 'proj-1',
    name: 'test-project',
    label: 'Test Project',
    group: '',
    host: 'github',
    localPath: '/repos/test',
    httpsUrl: 'https://github.com/org/test-project.git',
    local: true,
    remote: true,
    authorized: true,
  }

  const createLogView = (branchOverride: Partial<GitBranch>, dirty = false): GitLogView => ({
    repo: '/repos/test',
    displayPath: 'test',
    head: 'c1',
    branch: 'main',
    branches: [
      {
        name: 'main',
        upstream: 'origin/main',
        current: true,
        tip: 'c1',
        ahead: 0,
        behind: 0,
        ...branchOverride,
      },
    ],
    remotes: [
      {
        name: 'origin/main',
        remote: 'origin',
        branch: 'main',
        tip: 'c2',
      },
    ],
    tags: [],
    stashes: [],
    worktrees: [],
    submodules: [],
    commits: [],
    hasMore: false,
    marks: {},
    worktree: dirty ? { files: 2, insertions: 10, deletions: 2 } : null,
  })

  it('detects safe fast-forward when remote is ahead and worktree is clean', () => {
    const logView = createLogView({ ahead: 0, behind: 3 })
    const finding = detectDefaultBranchSync({ project: baseProject, logView })

    expect(finding).not.toBeNull()
    expect(finding?.lifecycle).toBe('open')
    expect(finding?.severity).toBe('info')
    expect(finding?.evidence?.details?.stateKind).toBe('safe')
    expect(finding?.evidence?.details?.conclusion).toBe('远程领先，可安全快进')
  })

  it('marks as warning when remote is ahead but worktree has uncommitted changes', () => {
    const logView = createLogView({ ahead: 0, behind: 3 }, true)
    const finding = detectDefaultBranchSync({ project: baseProject, logView })

    expect(finding).not.toBeNull()
    expect(finding?.evidence?.details?.stateKind).toBe('warn')
    expect(finding?.evidence?.details?.conclusion).toBe('本地工作区有未提交变更')
  })

  it('detects divergence when both local and remote have diverged commits', () => {
    const logView = createLogView({ ahead: 2, behind: 3 })
    const finding = detectDefaultBranchSync({ project: baseProject, logView })

    expect(finding).not.toBeNull()
    expect(finding?.evidence?.details?.stateKind).toBe('bad')
    expect(finding?.evidence?.details?.conclusion).toBe('本地与远程分叉，需人工介入处理')
  })

  it('marks as unavailable when upstream tracking branch is missing', () => {
    const logView = createLogView({ upstream: '' })
    const finding = detectDefaultBranchSync({ project: baseProject, logView })

    expect(finding).not.toBeNull()
    expect(finding?.freshness).toBe('unavailable')
    expect(finding?.evidence?.details?.stateKind).toBe('warn')
  })

  it('marks as resolved when fully in sync and clean', () => {
    const logView = createLogView({ ahead: 0, behind: 0 })
    const finding = detectDefaultBranchSync({ project: baseProject, logView })

    expect(finding).not.toBeNull()
    expect(finding?.lifecycle).toBe('resolved')
  })
})
