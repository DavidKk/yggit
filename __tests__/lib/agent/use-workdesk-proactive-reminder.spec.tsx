/** @jest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { matchesActiveRepo, type ProactiveReminder, useWorkdeskProactiveReminder } from '@/lib/agent/useWorkdeskProactiveReminder'
import type { GitProjectView } from '@/lib/git/types'
import { type ScanResult, workdeskEngine } from '@/lib/workdesk/engine'
import type { WorkItem } from '@/lib/workdesk/types'

// @ts-expect-error global flag for react act
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock agent context
const mockSendMessage = jest.fn().mockResolvedValue(undefined)
const mockSetDockMode = jest.fn()
let mockActiveRepo = '/Users/davidjones/Develop/backend/admin'
let mockActiveBranch = ''
let mockIsProcessing = false

jest.mock('@/lib/agent/agent-context', () => ({
  useAgent: () => ({
    activeRepo: mockActiveRepo,
    activeBranch: mockActiveBranch,
    sendMessage: mockSendMessage,
    setDockMode: mockSetDockMode,
    isProcessing: mockIsProcessing,
  }),
}))

// Mock LocaleProvider
jest.mock('@/components/i18n/LocaleProvider', () => ({
  useT: () => (key: string, params?: Record<string, string>) => {
    if (key === 'gitAgent.proactiveSyncQuestion') return `默认分支 ${params?.branch} 检测到远端有更新，是否需要 Agent 帮忙同步？`
    if (key === 'gitAgent.proactiveSyncPrompt') return `请帮我将默认分支 ${params?.branch} 同步更新至最新的远端提交。`
    if (key === 'gitAgent.proactiveActionSync') return '帮忙同步'
    if (key === 'gitAgent.proactiveMergeQuestion') return `分支 ${params?.branch} 与主分支产生分叉偏离，是否需要协助合流变基？`
    if (key === 'gitAgent.proactiveActionMerge') return '协助合流'
    if (key === 'gitAgent.proactiveReviewQuestion') return `分支 ${params?.branch} 有待推送的代码变更，是否需要 Agent 协助代码审查？`
    if (key === 'gitAgent.proactiveActionReview') return '代码审查'
    if (key === 'gitAgent.proactiveWorktreeQuestion') return '检测到当前项目存在并行独立工作树，是否需要 Agent 协助梳理？'
    if (key === 'gitAgent.proactiveActionWorktree') return '协助梳理'
    if (key === 'gitAgent.proactiveHygieneQuestion') return `分支 ${params?.branch} 命名可能不符合规范，是否需要协助重命名？`
    if (key === 'gitAgent.proactiveActionHygiene') return '协助规范'
    return key
  },
}))

describe('useWorkdeskProactiveReminder', () => {
  let root: Root
  let host: HTMLDivElement

  const sampleProjects: GitProjectView[] = [
    {
      id: 'proj_admin',
      name: 'admin',
      group: '工作项目',
      host: 'gitlab',
      localPath: '/Users/davidjones/Develop/backend/admin',
      httpsUrl: 'https://git.example.com/org/team/website/backend/admin.git',
      local: true,
      remote: true,
      authorized: true,
      remotes: [{ name: 'origin', url: 'https://git.example.com/org/team/website/backend/admin.git', isPrivate: true }],
    },
    {
      id: 'proj_yggit',
      name: 'yggdrasil',
      group: '个人项目',
      host: 'github',
      localPath: '/Users/davidjones/Develop/ops/apps/yggdrasil',
      httpsUrl: 'https://github.com/DavidKk/yggit.git',
      local: true,
      remote: true,
      authorized: true,
      remotes: [{ name: 'origin', url: 'https://github.com/DavidKk/yggit.git', isPrivate: false }],
    },
  ]

  const mockItemSync: WorkItem = {
    id: 'item_sync_admin',
    cardId: 'sync-default-branches',
    repoId: 'proj_admin',
    repoAlias: 'admin',
    name: 'main',
    summary: '落后远端 5 个提交',
    state: 'warn',
    findingIds: ['f_sync_1'],
  }

  const mockItemReview: WorkItem = {
    id: 'item_review_admin',
    cardId: 'code-review-pending-push',
    repoId: 'proj_admin',
    repoAlias: 'admin',
    name: 'feature/auth',
    summary: '领先远端 2 个提交',
    state: 'warn',
    findingIds: ['f_rev_1'],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    sessionStorage.clear()
    mockActiveRepo = '/Users/davidjones/Develop/backend/admin'
    mockIsProcessing = false
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  describe('matchesActiveRepo', () => {
    it('matches exact repoId or alias', () => {
      expect(matchesActiveRepo(mockItemSync, 'proj_admin')).toBe(true)
      expect(matchesActiveRepo(mockItemSync, 'admin')).toBe(true)
    })

    it('matches via project localPath, remoteKey, or url', () => {
      expect(matchesActiveRepo(mockItemSync, '/Users/davidjones/Develop/backend/admin', sampleProjects)).toBe(true)
      expect(matchesActiveRepo(mockItemSync, 'git.example.com/org/team/website/backend/admin', sampleProjects)).toBe(true)
      expect(matchesActiveRepo(mockItemSync, 'https://git.example.com/org/team/website/backend/admin.git', sampleProjects)).toBe(true)
    })

    it('matches via path suffix even without projects list', () => {
      expect(matchesActiveRepo(mockItemSync, '/Users/davidjones/Develop/backend/admin')).toBe(true)
      expect(matchesActiveRepo(mockItemSync, 'git.example.com/org/team/website/backend/admin')).toBe(true)
    })

    it('rejects unrelated repositories', () => {
      expect(matchesActiveRepo(mockItemSync, '/Users/davidjones/Develop/ops/apps/yggdrasil', sampleProjects)).toBe(false)
      expect(matchesActiveRepo(mockItemSync, '')).toBe(false)
    })
  })

  describe('proactive reminder hook lifecycle and priority', () => {
    let latestReminder: ProactiveReminder | null = null

    function TestComponent({ projects }: { projects?: GitProjectView[] }) {
      const { reminder } = useWorkdeskProactiveReminder(projects)
      latestReminder = reminder
      return null
    }

    it('returns null when no scanResult items exist', () => {
      act(() => {
        root.render(<TestComponent projects={sampleProjects} />)
      })
      expect(latestReminder).toBeNull()
    })

    it('picks highest priority card (sync over code-review) and formats question', () => {
      const scanData: ScanResult = {
        lastChecked: Date.now(),
        findings: [],
        cards: [],
        items: {
          rev: mockItemReview,
          sync: mockItemSync,
        },
      }

      // Trigger engine notification
      // @ts-expect-error accessing private notify for testing
      workdeskEngine.notify(scanData)

      act(() => {
        root.render(<TestComponent projects={sampleProjects} />)
      })

      expect(latestReminder).not.toBeNull()
      expect(latestReminder?.cardId).toBe('sync-default-branches')
      expect(latestReminder?.branchName).toBe('main')
      expect(latestReminder?.actionLabel).toBe('帮忙同步')
      expect(latestReminder?.message).toContain('默认分支 main 检测到远端有更新')
    })

    it('dismisses reminder and remembers dismissal in sessionStorage', () => {
      const scanData: ScanResult = {
        lastChecked: Date.now(),
        findings: [],
        cards: [],
        items: {
          sync: mockItemSync,
        },
      }

      // @ts-expect-error accessing private notify for testing
      workdeskEngine.notify(scanData)

      act(() => {
        root.render(<TestComponent projects={sampleProjects} />)
      })
      expect(latestReminder).not.toBeNull()

      act(() => {
        latestReminder?.dismiss()
      })

      expect(latestReminder).toBeNull()
      expect(sessionStorage.getItem('yggit.agent.dismissed-reminders')).toContain(mockItemSync.repoId)
      expect(sessionStorage.getItem('yggit.agent.proactive-session-snoozed')).toBe('true')
    })

    it('does not pop up subsequent reminders after user dismisses once (session snooze)', () => {
      const scanData: ScanResult = {
        lastChecked: Date.now(),
        findings: [],
        cards: [],
        items: {
          sync: mockItemSync,
          rev: mockItemReview,
        },
      }

      // @ts-expect-error accessing private notify for testing
      workdeskEngine.notify(scanData)

      act(() => {
        root.render(<TestComponent projects={sampleProjects} />)
      })
      expect(latestReminder).not.toBeNull()
      expect(latestReminder?.cardId).toBe('sync-default-branches')

      act(() => {
        latestReminder?.dismiss()
      })

      // When user dismissed, session snooze prevents the second item (mockItemReview) from popping up
      expect(latestReminder).toBeNull()
      expect(sessionStorage.getItem('yggit.agent.proactive-session-snoozed')).toBe('true')
    })

    it('accepts reminder, opens drawer and dispatches agent message', async () => {
      const scanData: ScanResult = {
        lastChecked: Date.now(),
        findings: [],
        cards: [],
        items: {
          sync: mockItemSync,
        },
      }

      // @ts-expect-error accessing private notify for testing
      workdeskEngine.notify(scanData)

      act(() => {
        root.render(<TestComponent projects={sampleProjects} />)
      })
      expect(latestReminder).not.toBeNull()

      await act(async () => {
        await latestReminder?.accept()
      })

      expect(mockSetDockMode).toHaveBeenCalledWith('dock-right')
      expect(mockSendMessage).toHaveBeenCalledWith('请帮我将默认分支 main 同步更新至最新的远端提交。', '/Users/davidjones/Develop/backend/admin')
      expect(latestReminder).toBeNull()
    })

    it('viewTask navigates to workdesk card', () => {
      const scanData: ScanResult = {
        lastChecked: Date.now(),
        findings: [],
        cards: [],
        items: {
          sync: mockItemSync,
        },
      }

      // @ts-expect-error accessing private notify for testing
      workdeskEngine.notify(scanData)

      act(() => {
        root.render(<TestComponent projects={sampleProjects} />)
      })
      act(() => {
        latestReminder?.viewTask()
      })

      expect(mockPush).toHaveBeenCalledWith('/workdesk/tasks/sync-default-branches/items/item_sync_admin')
      expect(latestReminder).toBeNull()
    })

    it('prioritizes simple tasks (hygiene/review) before complex merge-diverged-branches', () => {
      const itemMerge: WorkItem = {
        id: 'item_merge_admin',
        cardId: 'merge-diverged-branches',
        repoId: 'proj_admin',
        repoAlias: 'admin',
        name: 'feature/complex',
        summary: '与主分支分叉',
        state: 'warn',
        findingIds: ['f_merge_1'],
      }
      const itemHygiene: WorkItem = {
        id: 'item_hygiene_admin',
        cardId: 'standard-repo-hygiene',
        repoId: 'proj_admin',
        repoAlias: 'admin',
        name: 'temp-branch',
        summary: '命名规范建议',
        state: 'warn',
        findingIds: ['f_hygiene_1'],
      }
      const scanData: ScanResult = {
        lastChecked: Date.now(),
        findings: [],
        cards: [],
        items: {
          merge: itemMerge,
          hygiene: itemHygiene,
        },
      }

      // @ts-expect-error accessing private notify for testing
      workdeskEngine.notify(scanData)

      act(() => {
        root.render(<TestComponent projects={sampleProjects} />)
      })

      expect(latestReminder?.cardId).toBe('standard-repo-hygiene')
    })

    it('stops popping up after handling 2 tasks in the same session', async () => {
      const itemHygiene: WorkItem = {
        id: 'item_hygiene_admin',
        cardId: 'standard-repo-hygiene',
        repoId: 'proj_admin',
        repoAlias: 'admin',
        name: 'temp-branch',
        summary: '命名规范建议',
        state: 'warn',
        findingIds: ['f_hygiene_1'],
      }
      const scanData: ScanResult = {
        lastChecked: Date.now(),
        findings: [],
        cards: [],
        items: {
          sync: mockItemSync,
          hygiene: itemHygiene,
          rev: mockItemReview,
        },
      }

      // @ts-expect-error accessing private notify for testing
      workdeskEngine.notify(scanData)

      act(() => {
        root.render(<TestComponent projects={sampleProjects} />)
      })
      expect(latestReminder?.cardId).toBe('sync-default-branches')

      await act(async () => {
        await latestReminder?.accept()
      })
      expect(latestReminder?.cardId).toBe('standard-repo-hygiene')

      await act(async () => {
        await latestReminder?.accept()
      })
      // After 2 handled items, session limit reached -> no 3rd reminder
      expect(latestReminder).toBeNull()
      expect(sessionStorage.getItem('yggit.agent.proactive-handled-count')).toBe('2')
    })

    it('links detailsUrl directly to the single project item and prioritizes activeBranch', () => {
      mockActiveBranch = 'feature/auth'
      const scanData: ScanResult = {
        lastChecked: Date.now(),
        findings: [],
        cards: [],
        items: {
          sync: mockItemSync,
          rev: mockItemReview,
        },
      }

      // @ts-expect-error accessing private notify for testing
      workdeskEngine.notify(scanData)

      act(() => {
        root.render(<TestComponent projects={sampleProjects} />)
      })

      expect(latestReminder?.cardId).toBe('code-review-pending-push')
      expect(latestReminder?.branchName).toBe('feature/auth')
      expect(latestReminder?.detailsUrl).toBe('/workdesk/tasks/code-review-pending-push/items/item_review_admin')

      mockActiveBranch = ''
    })
  })
})
