/** @jest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import {
  isAgentSidebarOpen,
  quoteBranchToAgent,
  quoteCommitToAgent,
  quoteFileToAgent,
  quoteFolderToAgent,
  quotePromptToAgent,
  quoteRemoteToAgent,
  quoteStashToAgent,
  quoteTagToAgent,
  quoteToAgent,
  quoteWorkdeskTaskToAgent,
  quoteWorktreeToAgent,
  useAgentQuote,
} from '@/lib/agent/agent-quote'

// @ts-expect-error global flag for react act
globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('agent-quote service', () => {
  let eventDispatched: CustomEvent | null = null
  const handleOpen = (e: Event) => {
    eventDispatched = e as CustomEvent
  }

  beforeEach(() => {
    eventDispatched = null
    delete document.documentElement.dataset.agentSidebarOpen
    delete document.documentElement.dataset.agentDockMode
    document.body.innerHTML = ''
    window.addEventListener('yggit:agent_open', handleOpen)
  })

  afterEach(() => {
    window.removeEventListener('yggit:agent_open', handleOpen)
    delete document.documentElement.dataset.agentSidebarOpen
    delete document.documentElement.dataset.agentDockMode
    document.body.innerHTML = ''
  })

  describe('isAgentSidebarOpen', () => {
    it('returns false when dataset is not set and no sidebar element exists', () => {
      expect(isAgentSidebarOpen()).toBe(false)
    })

    it('returns false when dataset.agentSidebarOpen is "false"', () => {
      document.documentElement.dataset.agentSidebarOpen = 'false'
      expect(isAgentSidebarOpen()).toBe(false)
    })

    it('returns true when dataset.agentSidebarOpen is "true"', () => {
      document.documentElement.dataset.agentSidebarOpen = 'true'
      expect(isAgentSidebarOpen()).toBe(true)
    })

    it('returns true when data-agent-sidebar element exists in DOM', () => {
      const aside = document.createElement('aside')
      aside.setAttribute('data-agent-sidebar', '')
      document.body.appendChild(aside)
      expect(isAgentSidebarOpen()).toBe(true)
    })
  })

  describe('quoteToAgent routing', () => {
    it('routes quote to bottom bar when sidebar is closed', () => {
      document.documentElement.dataset.agentSidebarOpen = 'false'

      quoteToAgent({ title: '测试提交', commit: 'abc1234' })

      expect(eventDispatched).not.toBeNull()
      expect(eventDispatched?.detail.target).toBe('bottom')
      expect(eventDispatched?.detail.reference.title).toBe('测试提交')
      expect(eventDispatched?.detail.reference.commit).toBe('abc1234')
    })

    it('routes quote to sidebar when sidebar is open', () => {
      document.documentElement.dataset.agentSidebarOpen = 'true'

      quoteToAgent({ title: '测试提交', commit: 'abc1234' })

      expect(eventDispatched).not.toBeNull()
      expect(eventDispatched?.detail.target).toBe('sidebar')
      expect(eventDispatched?.detail.reference.title).toBe('测试提交')
    })

    it('respects explicit target override regardless of sidebar state', () => {
      document.documentElement.dataset.agentSidebarOpen = 'true'

      quoteToAgent({ title: '强制底部' }, { target: 'bottom' })
      expect(eventDispatched?.detail.target).toBe('bottom')

      document.documentElement.dataset.agentSidebarOpen = 'false'
      quoteToAgent({ title: '强制侧栏' }, { target: 'sidebar' })
      expect(eventDispatched?.detail.target).toBe('sidebar')
    })

    it('handles direct string prompt', () => {
      quotePromptToAgent('帮我跳转到 feat/login 分支')

      expect(eventDispatched).not.toBeNull()
      expect(eventDispatched?.detail.prompt).toBe('帮我跳转到 feat/login 分支')
      expect(eventDispatched?.detail.target).toBe('bottom')
    })
  })

  describe('specialized quote helpers', () => {
    it('quotes branch', () => {
      quoteBranchToAgent('feature/billing', false, 'repo-1')
      expect(eventDispatched?.detail.reference.kind).toBe('branch')
      expect(eventDispatched?.detail.reference.branch).toBe('feature/billing')
      expect(eventDispatched?.detail.reference.repoId).toBe('repo-1')
    })

    it('quotes commit', () => {
      quoteCommitToAgent({ hash: '7223227abcdef', summary: '修复登录问题', author: 'Alice' }, 'repo-1')
      expect(eventDispatched?.detail.reference.kind).toBe('commit')
      expect(eventDispatched?.detail.reference.commit).toBe('7223227abcdef')
      expect(eventDispatched?.detail.reference.summary).toBe('修复登录问题')
      expect(eventDispatched?.detail.reference.title).toContain('7223227')
    })

    it('quotes file and folder', () => {
      quoteFileToAgent('src/index.ts', 'modified', 'repo-1')
      expect(eventDispatched?.detail.reference.kind).toBe('file')
      expect(eventDispatched?.detail.reference.path).toBe('src/index.ts')

      quoteFolderToAgent('src/components', 'repo-1')
      expect(eventDispatched?.detail.reference.kind).toBe('folder')
      expect(eventDispatched?.detail.reference.folder).toBe('src/components')
    })

    it('quotes tag, remote, worktree, stash', () => {
      quoteTagToAgent('v1.0.0', 'abc1234', 'repo-1')
      expect(eventDispatched?.detail.reference.kind).toBe('tag')

      quoteRemoteToAgent('origin', 'git@github.com:test/repo.git', 'repo-1')
      expect(eventDispatched?.detail.reference.kind).toBe('remote')

      quoteWorktreeToAgent('/path/to/worktree', 'fix/bug', 'repo-1')
      expect(eventDispatched?.detail.reference.kind).toBe('worktree')

      quoteStashToAgent('stash@{0}', 'WIP work', 'repo-1')
      expect(eventDispatched?.detail.reference.kind).toBe('stash')
    })

    it('quotes workdesk task with solution and scope', () => {
      quoteWorkdeskTaskToAgent({
        title: '核对分叉与待合并分支',
        taskId: 'merge-diverged-branches',
        itemId: 'admin:release',
        repoAlias: 'admin',
        branch: 'release',
        solution: '执行 git merge 或 git rebase',
        scope: '3 个项目',
      })

      expect(eventDispatched?.detail.reference.kind).toBe('task')
      expect(eventDispatched?.detail.reference.title).toBe('核对分叉与待合并分支')
      expect(eventDispatched?.detail.reference.taskId).toBe('merge-diverged-branches')
      expect(eventDispatched?.detail.reference.solution).toBe('执行 git merge 或 git rebase')
      expect(eventDispatched?.detail.prompt).toContain('核对分叉与待合并分支')
    })
  })

  describe('useAgentQuote hook', () => {
    it('returns helper methods and reflects sidebar open state', () => {
      document.documentElement.dataset.agentSidebarOpen = 'true'

      let hookResult: ReturnType<typeof useAgentQuote> | null = null
      function TestComponent() {
        hookResult = useAgentQuote()
        return null
      }

      const host = document.createElement('div')
      document.body.appendChild(host)
      const root: Root = createRoot(host)

      act(() => {
        root.render(<TestComponent />)
      })

      expect(hookResult).not.toBeNull()
      expect(hookResult!.isSidebarOpen).toBe(true)
      expect(typeof hookResult!.quote).toBe('function')
      expect(typeof hookResult!.quoteCommit).toBe('function')
      expect(typeof hookResult!.quoteBranch).toBe('function')
      expect(typeof hookResult!.quoteWorkdeskTask).toBe('function')

      act(() => {
        hookResult!.quotePrompt('测试 prompt')
      })

      expect(eventDispatched?.detail.prompt).toBe('测试 prompt')
      expect(eventDispatched?.detail.target).toBe('sidebar')

      act(() => {
        root.unmount()
      })
      host.remove()
    })
  })
})
