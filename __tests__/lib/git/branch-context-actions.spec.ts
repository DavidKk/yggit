import { buildBranchContextActions } from '@/lib/git/branch-context-actions'
import type { BuildBranchMenuOptions } from '@/lib/git/branch-context-menu'
import { DEFAULT_CONTEXT_MENU_CONFIG } from '@/lib/git/context-menu-config'

describe('branch-context-actions', () => {
  it('builds action items correctly for a local branch', () => {
    const mockOptions: BuildBranchMenuOptions = {
      branchName: 'feature/login',
      commit: {
        hash: 'abc1234567890abcdef',
        short: 'abc1234',
        parents: [],
        author: 'Tester',
        date: new Date().toISOString(),
        subject: 'Initial commit',
        refs: ['feature/login'],
      },
      repo: '/path/to/repo',
      config: DEFAULT_CONTEXT_MENU_CONFIG,
      onCheckoutBranch: jest.fn(),
      onCreateBranch: jest.fn(),
      onDeleteBranch: jest.fn(),
      onRenameBranch: jest.fn(),
    }

    const tr = jest.fn((_key: string, fallback: string) => fallback)
    const copyVal = jest.fn().mockResolvedValue(undefined)

    const actions = buildBranchContextActions({
      options: mockOptions,
      tr,
      shortHash: 'abc1234',
      copyVal,
      cleanBranch: 'feature/login',
      fullBranch: 'refs/heads/feature/login',
    })

    expect(actions).toBeDefined()
    expect(actions['checkout-branch']).toBeDefined()
    expect(actions['copy-branch']).toBeDefined()
    expect(actions['new-branch']).toBeDefined()
    expect(actions['rename-branch']).toBeDefined()
    expect(actions['delete-branch']).toBeDefined()
  })

  it('builds action items correctly for a remote branch', () => {
    const mockOptions: BuildBranchMenuOptions = {
      branchName: 'origin/feature/login',
      commit: {
        hash: 'abc1234567890abcdef',
        short: 'abc1234',
        parents: [],
        author: 'Tester',
        date: new Date().toISOString(),
        subject: 'Initial commit',
        refs: ['origin/feature/login'],
      },
      repo: '/path/to/repo',
      isRemote: true,
      remoteUrl: 'https://github.com/org/repo.git',
      config: DEFAULT_CONTEXT_MENU_CONFIG,
    }

    const tr = jest.fn((_key: string, fallback: string) => fallback)
    const copyVal = jest.fn().mockResolvedValue(undefined)

    const actions = buildBranchContextActions({
      options: mockOptions,
      tr,
      shortHash: 'abc1234',
      copyVal,
      cleanBranch: 'feature/login',
      fullBranch: 'refs/remotes/origin/feature/login',
    })

    expect(actions).toBeDefined()
    expect(actions['checkout-branch']).toBeDefined()
    expect(actions['open-remote']).toBeDefined()
  })
})
