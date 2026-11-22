/** @jest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { WorkdeskBoard } from '@/components/workdesk/WorkdeskBoard'
import { WorkdeskCard } from '@/components/workdesk/WorkdeskCard'
import { WorkdeskTaskDetailView } from '@/components/workdesk/WorkdeskTaskDetailView'
import type { WorkCard, WorkItem } from '@/lib/workdesk/types'

// @ts-expect-error global flag for react act
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

jest.mock('@/components/i18n/LocaleProvider', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), key)
    }
    return key
  },
}))

jest.mock('@/components/sk', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button type="button" {...props} />,
  Badge: ({ children, ...rest }: React.ComponentProps<'span'>) => <span {...rest}>{children}</span>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('Workdesk Components', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    mockPush.mockClear()
    mockReplace.mockClear()
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  const sampleCard: WorkCard = {
    id: 'sync-default-branches',
    groupKey: 'sync:default-branches',
    title: '同步默认分支',
    summary: '检查各项目默认分支与远端的同步状态',
    scope: '5 个项目',
    iconName: 'LuRefreshCw',
    categoryId: 'branch',
    categorySource: 'rule',
    state: 'prepared',
    itemIds: ['item1'],
    createdAt: 1000,
    updatedAt: 1000,
  }

  const sampleItem: WorkItem = {
    id: 'item1',
    cardId: 'sync-default-branches',
    repoId: 'repo-1',
    repoAlias: 'Main App',
    name: 'main',
    summary: '远程领先，可安全快进',
    state: 'safe',
    findingIds: ['f1'],
    commit: 'a1b2c3d4e5f6',
    paths: ['src/index.ts'],
  }

  it('renders WorkdeskCard with title, scope, and target link', () => {
    act(() => {
      root.render(<WorkdeskCard card={sampleCard} />)
    })

    expect(host.textContent).toContain('同步默认分支')
    expect(host.textContent).toContain('5 个项目')
    const link = host.querySelector('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/workdesk/tasks/sync-default-branches')
  })

  it('renders WorkdeskBoard with 4 lanes and populated cards', () => {
    act(() => {
      root.render(<WorkdeskBoard initialCards={[sampleCard]} initialLastChecked={Date.now()} />)
    })

    // Check lane headings
    expect(host.textContent).toContain('workdesk.lane.branch')
    expect(host.textContent).toContain('workdesk.lane.merge')
    expect(host.textContent).toContain('workdesk.lane.standard')
    expect(host.textContent).toContain('workdesk.lane.review')

    // Check presence of the card
    expect(host.textContent).toContain('同步默认分支')
  })

  it('renders WorkdeskTaskDetailView with left task list and right Git evidence links', () => {
    act(() => {
      root.render(<WorkdeskTaskDetailView taskId="sync-default-branches" initialCard={sampleCard} initialItems={[sampleItem]} initialItemId="item1" />)
    })

    // Topline
    expect(host.textContent).toContain('workdesk.action.back')
    expect(host.textContent).toContain('Git Workdesk')
    // Standalone dismiss button
    expect(host.textContent).toContain('workdesk.action.dismiss')

    // Left List
    expect(host.textContent).toContain('Main App')
    expect(host.textContent).toContain('main')

    // Right Evidence Cards
    expect(host.textContent).toContain('Main App · main')
    expect(host.textContent).toContain('远程领先，可安全快进')
    expect(host.textContent).toContain('workdesk.detail.targetProject')
    expect(host.textContent).toContain('workdesk.detail.targetBranch')

    // Verified removed prompt
    expect(host.textContent).not.toContain('workdesk.agent.prompt')

    // Navigable Commit link
    const commitLink = host.querySelector('a[href*="/git/repo-1/commit/a1b2c3d4e5f6"]')
    expect(commitLink).not.toBeNull()

    // Navigable File link
    const fileLink = host.querySelector('a[href*="file=src%2Findex.ts"]')
    expect(fileLink).not.toBeNull()
  })

  it('supports onCollapse callback when top-left card is clicked in WorkdeskTaskDetailView', () => {
    const handleCollapse = jest.fn()
    act(() => {
      root.render(<WorkdeskTaskDetailView taskId="sync-default-branches" initialCard={sampleCard} initialItems={[sampleItem]} initialItemId="item1" onCollapse={handleCollapse} />)
    })

    const collapseBtn = host.querySelector('button[aria-label*="workdesk.action.back"]') as HTMLButtonElement | null
    expect(collapseBtn).not.toBeNull()
    act(() => {
      collapseBtn?.click()
    })
    expect(handleCollapse).toHaveBeenCalledTimes(1)
  })

  it('renders expanded task detail inside WorkdeskBoard when initialActiveTaskId is provided', () => {
    act(() => {
      root.render(<WorkdeskBoard initialCards={[sampleCard]} initialActiveTaskId="sync-default-branches" />)
    })

    expect(host.textContent).toContain('同步默认分支')
    expect(host.textContent).toContain('workdesk.action.dismiss')
  })

  it('triggers card selection and transition when card in WorkdeskBoard is clicked', () => {
    act(() => {
      root.render(<WorkdeskBoard initialCards={[sampleCard]} />)
    })

    const cardLink = host.querySelector('a[role="button"]') as HTMLElement | null
    expect(cardLink).not.toBeNull()

    act(() => {
      cardLink?.click()
    })

    expect(host.textContent).toContain('同步默认分支')
  })
})
