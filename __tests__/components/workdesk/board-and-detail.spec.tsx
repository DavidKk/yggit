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
  useLocale: () => ({ locale: 'en', preference: 'en', ready: true, setLocale: jest.fn(), t: (k: string) => k }),
  useT: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), key)
    }
    return key
  },
}))

jest.mock('@/components/sk', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button type="button" {...props} />,
  Badge: ({ children, dot: _d, tone: _t, size: _s, loading: _l, ...rest }: any) => <span {...rest}>{children}</span>,
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

  it('renders WorkdeskCard with title, scope, target link, and stacked deck layers for multiple projects', () => {
    act(() => {
      root.render(<WorkdeskCard card={sampleCard} />)
    })

    expect(host.textContent).toContain('同步默认分支')
    expect(host.textContent).toContain('5 个项目')
    const link = host.querySelector('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/workdesk/tasks/sync-default-branches')

    // Multiple projects: stacked card deck
    const wrapper = host.querySelector('[data-testid="workdesk-card-wrapper-sync-default-branches"]')
    expect(wrapper?.getAttribute('data-stacked')).toBe('true')
    expect(host.querySelector('[data-testid="card-stack-layer-bottom"]')).not.toBeNull()
    expect(host.querySelector('[data-testid="card-stack-layer-middle"]')).not.toBeNull()

    // No right chevron arrow
    expect(host.querySelector('svg.lucide-chevron-right')).toBeNull()
  })

  it('formats large project counts and branch counts as 99+ on WorkdeskCard', () => {
    const hugeCard: WorkCard = {
      ...sampleCard,
      id: 'huge-task',
      scope: '140 个项目 · 120 Worktrees',
      projectCount: 140,
    }

    act(() => {
      root.render(<WorkdeskCard card={hugeCard} />)
    })

    expect(host.textContent).toContain('99+')
  })

  it('renders WorkdeskCard as a single flat card when only 1 project is affected', () => {
    const singleProjectCard: WorkCard = {
      ...sampleCard,
      id: 'single-repo-task',
      scope: '1 个项目',
      projectCount: 1,
    }

    act(() => {
      root.render(<WorkdeskCard card={singleProjectCard} />)
    })

    expect(host.textContent).toContain('1 个项目')
    const wrapper = host.querySelector('[data-testid="workdesk-card-wrapper-single-repo-task"]')
    expect(wrapper?.getAttribute('data-stacked')).toBe('false')
    expect(host.querySelector('[data-testid="card-stack-layer-bottom"]')).toBeNull()
    expect(host.querySelector('[data-testid="card-stack-layer-middle"]')).toBeNull()
  })

  it('renders WorkdeskBoard with 4 lanes and 99+ badge for large task counts', () => {
    const largeCard: WorkCard = {
      ...sampleCard,
      itemIds: Array.from({ length: 120 }, (_, i) => `item_${i}`),
    }
    act(() => {
      root.render(<WorkdeskBoard initialCards={[largeCard]} initialLastChecked={Date.now()} />)
    })

    // Check lane headings
    expect(host.textContent).toContain('workdesk.lane.branch')
    expect(host.textContent).toContain('workdesk.lane.merge')
    expect(host.textContent).toContain('workdesk.lane.standard')
    expect(host.textContent).toContain('workdesk.lane.review')

    // 4 equal-width horizontal columns
    expect(host.querySelector('.lg\\:grid-cols-4')).not.toBeNull()

    // 99+ badge for large tasks
    expect(host.textContent).toContain('99+')

    // Check presence of the card
    expect(host.textContent).toContain('同步默认分支')
  })

  it('renders WorkdeskTaskDetailView with left task list and right resolution diagnostics', () => {
    act(() => {
      root.render(<WorkdeskTaskDetailView taskId="sync-default-branches" initialCard={sampleCard} initialItems={[sampleItem]} initialItemId="item1" />)
    })

    // Topline close button for task set
    expect(host.querySelector('[data-testid="workdesk-detail-close-btn"]')).not.toBeNull()

    // Redundant top header strip removed
    expect(host.textContent).not.toContain('Git Workdesk')

    // Middle strip removed: no redundant "taskList" header strip
    expect(host.textContent).not.toContain('workdesk.detail.taskList')

    // Left List
    expect(host.textContent).toContain('Main App')
    expect(host.textContent).toContain('main')

    // Task items are draggable
    const itemEl = host.querySelector('[draggable="true"]')
    expect(itemEl).not.toBeNull()

    // Right Evidence Card: Non-repetitive problem title, direct project & branch links
    expect(host.textContent).toContain('workdesk.problemTitles.sync')
    expect(host.textContent).toContain('远程领先，可安全快进')
    expect(host.textContent).toContain('workdesk.detail.targetProject')
    expect(host.textContent).toContain('workdesk.detail.problemBranch')
    expect(host.textContent).toContain('workdesk.detail.problemDesc')
    expect(host.textContent).toContain('workdesk.detail.causeTitle')
    expect(host.textContent).toContain('workdesk.detail.riskTitle')
    expect(host.textContent).toContain('workdesk.detail.solutionTitle')

    // Direct Project and Branch navigation links (no redundant "openRepo" button)
    expect(host.querySelector('a[href*="/git/repo-1"]')).not.toBeNull()
    expect(host.querySelector('a[href*="/git/repo-1/branch/main"]')).not.toBeNull()
    expect(host.textContent).not.toContain('workdesk.detail.openRepo')

    // Verified removed prompt
    expect(host.textContent).not.toContain('workdesk.agent.prompt')

    // Git evidence links removed as requested
    expect(host.querySelector('a[href*="/git/repo-1/commit/a1b2c3d4e5f6"]')).toBeNull()
    expect(host.querySelector('a[href*="file=src%2Findex.ts"]')).toBeNull()
  })

  it('switches items in WorkdeskTaskDetailView updating browser URL via replaceState without router navigation', () => {
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState')
    const item2: WorkItem = {
      ...sampleItem,
      id: 'item2',
      name: 'feature/login',
      summary: '需要合并到默认分支',
    }
    const cardWith2Items: WorkCard = {
      ...sampleCard,
      itemIds: ['item1', 'item2'],
    }

    act(() => {
      root.render(<WorkdeskTaskDetailView taskId="sync-default-branches" initialCard={cardWith2Items} initialItems={[sampleItem, item2]} initialItemId="item1" />)
    })

    const buttons = host.querySelectorAll('div[role="button"]')
    const targetItem = Array.from(buttons).find((btn) => btn.textContent?.includes('feature/login')) as HTMLElement | undefined
    expect(targetItem).toBeDefined()

    act(() => {
      targetItem?.click()
    })

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', expect.stringContaining('/workdesk/tasks/sync-default-branches/items/item2'))
    expect(mockReplace).not.toHaveBeenCalled()
    expect(host.textContent).toContain('需要合并到默认分支')
    replaceStateSpy.mockRestore()
  })

  it('supports dragging cards on WorkdeskBoard', () => {
    act(() => {
      root.render(<WorkdeskBoard initialCards={[sampleCard]} initialLastChecked={Date.now()} />)
    })

    const draggableCard = host.querySelector('[draggable="true"]')
    expect(draggableCard).not.toBeNull()
  })

  it('supports onCollapse callback when top-left card is clicked in WorkdeskTaskDetailView', () => {
    const handleCollapse = jest.fn()
    act(() => {
      root.render(<WorkdeskTaskDetailView taskId="sync-default-branches" initialCard={sampleCard} initialItems={[sampleItem]} initialItemId="item1" onCollapse={handleCollapse} />)
    })

    const collapseBtn = host.querySelector('[data-testid="workdesk-detail-close-btn"]') as HTMLButtonElement | null
    expect(collapseBtn).not.toBeNull()
    act(() => {
      collapseBtn?.click()
    })
    expect(handleCollapse).toHaveBeenCalledTimes(1)
  })

  it('preserves stacked card deck layers during initial dealing in WorkdeskTaskDetailView when multiple items exist', () => {
    const multiItemCard: WorkCard = {
      ...sampleCard,
      itemIds: ['item1', 'item2', 'item3'],
    }
    const item2: WorkItem = { ...sampleItem, id: 'item2', name: 'feat/2' }
    const item3: WorkItem = { ...sampleItem, id: 'item3', name: 'feat/3' }

    act(() => {
      root.render(<WorkdeskTaskDetailView taskId="sync-default-branches" initialCard={multiItemCard} initialItems={[sampleItem, item2, item3]} initialItemId="item1" />)
    })

    // During dealing, card 0 has stacked deck underlayers
    expect(host.querySelector('[data-testid="card-stack-layer-bottom"]')).not.toBeNull()
    expect(host.querySelector('[data-testid="card-stack-layer-middle"]')).not.toBeNull()
  })

  it('does not render stacked card deck layers in WorkdeskTaskDetailView when only 1 item exists', () => {
    const singleItemCard: WorkCard = {
      ...sampleCard,
      scope: '1 个项目',
      projectCount: 1,
      itemIds: ['item1'],
    }

    act(() => {
      root.render(<WorkdeskTaskDetailView taskId="sync-default-branches" initialCard={singleItemCard} initialItems={[sampleItem]} initialItemId="item1" />)
    })

    // Single item: no stacked layers
    expect(host.querySelector('[data-testid="card-stack-layer-bottom"]')).toBeNull()
    expect(host.querySelector('[data-testid="card-stack-layer-middle"]')).toBeNull()
  })

  it('renders expanded task detail inside WorkdeskBoard when initialActiveTaskId is provided', () => {
    act(() => {
      root.render(<WorkdeskBoard initialCards={[sampleCard]} initialActiveTaskId="sync-default-branches" />)
    })

    expect(host.textContent).toContain('同步默认分支')
    expect(host.querySelector('[data-testid="workdesk-detail-close-btn"]')).not.toBeNull()
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
    // During lifting transition, proxy floating card renders stack underlayers
    const middleLayer = host.querySelector('[data-testid="card-stack-layer-middle"]') as HTMLElement | null
    expect(middleLayer).not.toBeNull()
  })

  it('dispatches yggit:agent_open with reference structure when Git Agent button is clicked', () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent')
    act(() => {
      root.render(<WorkdeskCard card={sampleCard} />)
    })

    const agentBtn = host.querySelector('[data-testid="workdesk-card-agent-btn"]') as HTMLButtonElement | null
    expect(agentBtn).not.toBeNull()

    act(() => {
      agentBtn?.click()
    })

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'yggit:agent_open',
        detail: expect.objectContaining({
          reference: expect.objectContaining({
            title: '同步默认分支',
          }),
        }),
      })
    )
    dispatchSpy.mockRestore()
  })

  it('shows trash dropzone on card drag and supports discarding and undoing cards', () => {
    act(() => {
      root.render(<WorkdeskBoard initialCards={[sampleCard]} />)
    })

    // Initially no trash dropzone
    expect(host.querySelector('[data-testid="workdesk-trash-dropzone"]')).toBeNull()

    // Start drag on card
    const draggableCard = host.querySelector('[draggable="true"]') as HTMLElement | null
    expect(draggableCard).not.toBeNull()

    const dataTransfer = {
      setData: jest.fn(),
      getData: jest.fn().mockReturnValue('sync-default-branches'),
      effectAllowed: '',
      dropEffect: '',
    }

    act(() => {
      const event = new Event('dragstart', { bubbles: true })
      Object.defineProperty(event, 'dataTransfer', {
        value: dataTransfer,
      })
      draggableCard?.dispatchEvent(event)
    })

    // Trash dropzone appears
    const trashZone = host.querySelector('[data-testid="workdesk-trash-dropzone"]') as HTMLElement | null
    expect(trashZone).not.toBeNull()
    expect(trashZone?.textContent).toContain('workdesk.trashDrop')

    // Drop onto trash zone
    act(() => {
      const dropEvent = new Event('drop', { bubbles: true })
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: dataTransfer,
      })
      trashZone?.dispatchEvent(dropEvent)
    })

    // Undo toast appears
    expect(host.textContent).toContain('已丢弃任务')
    expect(host.textContent).toContain('workdesk.action.undoDismiss')

    // Click undo
    const undoBtn = host.querySelector('button') as HTMLButtonElement | null
    act(() => {
      undoBtn?.click()
    })
  })
})
