/** @jest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { GitAgentAssistiveReminder } from '@/components/git/agent/GitAgentAssistiveReminder'
import type { ProactiveReminder } from '@/lib/agent/useWorkdeskProactiveReminder'

// @ts-expect-error global flag for react act
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mockDismiss = jest.fn()
const mockAccept = jest.fn().mockResolvedValue(undefined)
const mockViewTask = jest.fn()

let mockReminder: ProactiveReminder | null = {
  id: 'test_sync_main',
  cardId: 'sync-default-branches',
  repoId: 'test_repo',
  repoAlias: 'admin',
  branchName: 'main',
  summary: '落后 5 个提交',
  title: '默认分支同步',
  message: '默认分支 main 检测到远端有更新，是否需要 Agent 帮忙同步？',
  actionLabel: '帮忙同步',
  agentPrompt: '请帮我同步 main 分支',
  detailsUrl: '/workdesk?card=sync-default-branches',
  dismiss: mockDismiss,
  accept: mockAccept,
  viewTask: mockViewTask,
}

let mockIsProcessing = false

jest.mock('@/lib/agent/useWorkdeskProactiveReminder', () => ({
  useWorkdeskProactiveReminder: () => ({
    reminder: mockReminder,
    isProcessing: mockIsProcessing,
  }),
}))

jest.mock('@/components/i18n/LocaleProvider', () => ({
  useT: () => (key: string) => {
    if (key === 'gitAgent.proactiveBadge') return '工作台待办提醒'
    if (key === 'gitAgent.proactiveActionView') return '查看任务'
    if (key === 'gitAgent.proactiveDismiss') return '稍后再说'
    if (key === 'common.close') return '关闭'
    return key
  },
}))

describe('GitAgentAssistiveReminder', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    jest.clearAllMocks()
    mockIsProcessing = false
    mockReminder = {
      id: 'test_sync_main',
      cardId: 'sync-default-branches',
      repoId: 'test_repo',
      repoAlias: 'admin',
      branchName: 'main',
      summary: '落后 5 个提交',
      title: '默认分支同步',
      message: '默认分支 main 检测到远端有更新，是否需要 Agent 帮忙同步？',
      actionLabel: '帮忙同步',
      agentPrompt: '请帮我同步 main 分支',
      detailsUrl: '/workdesk?card=sync-default-branches',
      dismiss: mockDismiss,
      accept: mockAccept,
      viewTask: mockViewTask,
    }
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

  describe('floating variant', () => {
    it('renders floating card with message and buttons when reminder exists', () => {
      act(() => {
        root.render(<GitAgentAssistiveReminder variant="floating" />)
      })

      expect(host.textContent).toContain('Git Agent')
      expect(host.textContent).toContain('默认分支 main 检测到远端有更新，是否需要 Agent 帮忙同步？')
      expect(host.textContent).toContain('帮忙同步')
      expect(host.textContent).toContain('查看任务')
      expect(host.textContent).toContain('稍后再说')
    })

    it('does not render when isBarExpanded is true', () => {
      act(() => {
        root.render(<GitAgentAssistiveReminder variant="floating" isBarExpanded={true} />)
      })
      expect(host.children.length).toBe(0)
    })

    it('does not render when isProcessing is true', () => {
      mockIsProcessing = true
      act(() => {
        root.render(<GitAgentAssistiveReminder variant="floating" />)
      })
      expect(host.children.length).toBe(0)
    })

    it('clicking primary action calls accept', () => {
      act(() => {
        root.render(<GitAgentAssistiveReminder variant="floating" />)
      })

      const buttons = Array.from(host.querySelectorAll('button'))
      const syncBtn = buttons.find((b) => b.textContent?.includes('帮忙同步'))
      expect(syncBtn).toBeDefined()

      act(() => {
        syncBtn?.click()
      })
      expect(mockAccept).toHaveBeenCalledTimes(1)
    })

    it('clicking view task calls viewTask', () => {
      act(() => {
        root.render(<GitAgentAssistiveReminder variant="floating" />)
      })

      const buttons = Array.from(host.querySelectorAll('button'))
      const viewBtn = buttons.find((b) => b.textContent?.includes('查看任务'))
      expect(viewBtn).toBeDefined()

      act(() => {
        viewBtn?.click()
      })
      expect(mockViewTask).toHaveBeenCalledTimes(1)
    })

    it('clicking dismiss or close button calls dismiss', () => {
      act(() => {
        root.render(<GitAgentAssistiveReminder variant="floating" />)
      })

      const buttons = Array.from(host.querySelectorAll('button'))
      const dismissBtn = buttons.find((b) => b.textContent?.includes('稍后再说'))
      expect(dismissBtn).toBeDefined()

      act(() => {
        dismissBtn?.click()
      })
      expect(mockDismiss).toHaveBeenCalledTimes(1)

      const closeBtn = buttons.find((b) => b.getAttribute('aria-label') === '关闭')
      expect(closeBtn).toBeDefined()

      act(() => {
        closeBtn?.click()
      })
      expect(mockDismiss).toHaveBeenCalledTimes(2)
    })
  })

  describe('embedded variant', () => {
    it('renders embedded banner properly inside parent container', () => {
      act(() => {
        root.render(<GitAgentAssistiveReminder variant="embedded" />)
      })

      expect(host.textContent).toContain('工作台待办提醒')
      expect(host.textContent).toContain('默认分支 main 检测到远端有更新，是否需要 Agent 帮忙同步？')
      expect(host.textContent).toContain('帮忙同步')
    })

    it('returns null when reminder is null', () => {
      mockReminder = null
      act(() => {
        root.render(<GitAgentAssistiveReminder variant="embedded" />)
      })
      expect(host.children.length).toBe(0)
    })
  })
})
