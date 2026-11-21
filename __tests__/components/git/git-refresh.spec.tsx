/** @jest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

// @ts-expect-error act flag for jest jsdom
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import { GitToolbar } from '@/components/git/GitToolbar'

jest.mock('@/lib/git/driver', () => ({
  getDriverMode: () => 'local',
  getGitDriver: jest.fn(() => ({})),
}))

jest.mock('@/components/i18n/LocaleProvider', () => {
  const t = (key: string) => key
  return { useT: () => t }
})

jest.mock('@/components/notification/useNotification', () => ({
  useNotification: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}))

describe('GitToolbar refresh', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('renders the refresh button and triggers onRefresh when clicked', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined)

    await act(async () => {
      root.render(<GitToolbar repo="/path/to/repo" currentBranch="main" onRefresh={onRefresh} />)
    })

    const buttons = Array.from(container.querySelectorAll('button'))
    const refreshBtn = buttons.find((btn) => btn.textContent?.includes('git.operations.refresh') || btn.textContent?.includes('Refresh') || btn.textContent?.includes('刷新'))

    expect(refreshBtn).toBeDefined()
    expect(refreshBtn).not.toBeNull()

    await act(async () => {
      refreshBtn?.click()
    })

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
