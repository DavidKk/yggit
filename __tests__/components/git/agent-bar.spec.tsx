/** @jest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { GitAgentBar } from '@/components/git/agent/GitAgentBar'
import { AgentProvider } from '@/lib/agent/agent-context'

// @ts-expect-error global flag for react act
globalThis.IS_REACT_ACT_ENVIRONMENT = true

jest.mock('@/components/i18n/LocaleProvider', () => ({ useT: () => (key: string) => key }))
jest.mock('@/lib/agent/openapi-client', () => ({ testAgentConnection: jest.fn(), sendAgentCompletion: jest.fn() }))
jest.mock('@/lib/agent/spotlight-context', () => ({ useOptionalSpotlight: () => null }))
jest.mock('@/components/sk', () => ({
  Spinner: () => <span data-testid="spinner" />,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Button: (props: React.ComponentProps<'button'>) => <button type="button" {...props} />,
  Select: () => <select />,
}))

describe('GitAgentBar', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    jest.useFakeTimers()
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

  it('renders in collapsed mini pill state and does not reset label on Escape when already mini', () => {
    act(() => {
      root.render(
        <AgentProvider>
          <GitAgentBar />
        </AgentProvider>
      )
    })

    // Advance timer to let typewriter complete
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    const form = host.querySelector('form')
    expect(form).not.toBeNull()
    expect(host.textContent).toContain('Git Agent')

    // Press Escape while already collapsed
    act(() => {
      form?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    // Label should remain intact, not cleared or re-started
    expect(host.textContent).toContain('Git Agent')

    // Advance partial time — text should STILL be intact
    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(host.textContent).toContain('Git Agent')
  })
})
