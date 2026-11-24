/** @jest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { AnimatedCounter } from '@/components/git/AnimatedCounter'

// @ts-expect-error global flag for react act
globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('AnimatedCounter', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
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

  it('renders numeric value', () => {
    act(() => {
      root.render(<AnimatedCounter value={42} />)
    })
    expect(host.textContent).toBe('42')
  })

  it('formats values exceeding max threshold as max+', () => {
    act(() => {
      root.render(<AnimatedCounter value={120} max={99} />)
    })
    expect(host.textContent).toBe('99+')
  })

  it('handles null/undefined gracefully as 0', () => {
    act(() => {
      root.render(<AnimatedCounter value={null} />)
    })
    expect(host.textContent).toBe('0')
  })

  it('supports prefix and suffix', () => {
    act(() => {
      root.render(<AnimatedCounter value={5} prefix="+" suffix=" commits" />)
    })
    expect(host.textContent).toBe('+5 commits')
  })
})
