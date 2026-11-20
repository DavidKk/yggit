/** @jest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { AgentSpotlightNavigator } from '@/components/git/agent/spotlight/AgentSpotlightNavigator'
import { SpotlightContext, type SpotlightContextValue } from '@/lib/agent/spotlight-context'
import type { SpotlightTarget } from '@/services/git/agent-impact'

// @ts-expect-error global flag for react act
globalThis.IS_REACT_ACT_ENVIRONMENT = true

jest.mock('@/components/i18n/LocaleProvider', () => ({ useT: () => (key: string) => key }))
jest.mock('@/components/sk', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockNextTarget = jest.fn()
const mockPrevTarget = jest.fn()
const mockClearSpotlight = jest.fn()

describe('AgentSpotlightNavigator', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
    jest.useRealTimers()
  })

  function renderNavigator(contextOverrides: Partial<SpotlightContextValue> = {}) {
    const mockTargets: SpotlightTarget[] = [
      { hash: '1111111', shortHash: '1111111', role: 'primary', evidenceGrade: 'Fact', reason: 'Commit 1', subject: 'feat: commit 1' },
      { hash: '2222222', shortHash: '2222222', role: 'primary', evidenceGrade: 'Fact', reason: 'Commit 2', subject: 'feat: commit 2' },
    ]
    const defaultContext: SpotlightContextValue = {
      active: true,
      targets: mockTargets,
      targetsMap: new Map(mockTargets.map((t) => [t.hash, t])),
      currentIndex: 0,
      currentTarget: mockTargets[0],
      focusedHash: '1111111',
      codeAnnotation: null,
      setSpotlightTargets: jest.fn(),
      clearSpotlight: mockClearSpotlight,
      nextTarget: mockNextTarget,
      prevTarget: mockPrevTarget,
      focusTarget: jest.fn(),
      setFocusedHash: jest.fn(),
      setCodeAnnotation: jest.fn(),
      clearCodeAnnotation: jest.fn(),
      registerNavigateHandler: jest.fn(() => () => {}),
      ...contextOverrides,
    }

    act(() => {
      root.render(
        <SpotlightContext.Provider value={defaultContext}>
          <AgentSpotlightNavigator />
        </SpotlightContext.Provider>
      )
    })
  }

  it('renders with fixed consistent width class w-[580px]', () => {
    renderNavigator()
    const region = host.querySelector('[role="region"]')
    expect(region).not.toBeNull()
    expect(region?.className).toContain('w-[580px]')
  })

  it('renders compact stepper with cursor: pointer', () => {
    renderNavigator()
    const buttons = host.querySelectorAll('button')
    const prevBtn = buttons[0]
    const nextBtn = buttons[1]

    expect(prevBtn).not.toBeNull()
    expect(nextBtn).not.toBeNull()
    expect(prevBtn.style.cursor).toBe('pointer')
    expect(nextBtn.style.cursor).toBe('pointer')
    expect(prevBtn.className).toContain('cursor-pointer')
    expect(nextBtn.className).toContain('cursor-pointer')
  })

  it('renders exit button with only icon and animates out on exit', () => {
    renderNavigator()
    // Exit button should not contain text "退出"
    expect(host.textContent).not.toContain('退出')
    const buttons = host.querySelectorAll('button')
    // Last button is the exit button
    const exitButton = buttons[buttons.length - 1]
    expect(exitButton).not.toBeNull()
    expect(exitButton.style.cursor).toBe('pointer')

    act(() => {
      exitButton?.click()
    })

    // Immediately after click, vanish animation style is applied
    const region = host.querySelector('[role="region"]') as HTMLElement
    expect(region?.style.animation).toContain('spotlight-pill-vanish')
    expect(mockClearSpotlight).not.toHaveBeenCalled()

    // After 400ms vanish duration, clearSpotlight is invoked
    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(mockClearSpotlight).toHaveBeenCalled()
  })

  it('triggers next and prev stepper controls', () => {
    renderNavigator()
    const buttons = host.querySelectorAll('button')
    const prevBtn = buttons[0]
    const nextBtn = buttons[1]

    act(() => {
      prevBtn.click()
    })
    expect(mockPrevTarget).toHaveBeenCalled()

    act(() => {
      nextBtn.click()
    })
    expect(mockNextTarget).toHaveBeenCalled()
  })

  it('renders clickable commit hash badge that triggers jump', () => {
    const mockFocusTarget = jest.fn()
    renderNavigator({ focusTarget: mockFocusTarget })

    const hashBadge = host.querySelector('button[aria-label="Jump to commit 1111111"]') as HTMLButtonElement
    expect(hashBadge).not.toBeNull()
    expect(hashBadge.textContent).toBe('1111111')
    expect(hashBadge.className).toContain('cursor-pointer')

    act(() => {
      hashBadge.click()
    })
    expect(mockFocusTarget).toHaveBeenCalledWith('1111111')
  })
})
