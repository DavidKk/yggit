/** @jest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { getPillDistance, GitAgentBar, SNAP_DISTANCE } from '@/components/git/agent/GitAgentBar'
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
    localStorage.clear()
    jest.useFakeTimers()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    localStorage.clear()
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

  it('supports dragging in collapsed mini state and double-click to reset', () => {
    act(() => {
      root.render(
        <AgentProvider>
          <GitAgentBar />
        </AgentProvider>
      )
    })

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    const form = host.querySelector('form')!
    expect(form).not.toBeNull()

    const iconBtn = host.querySelector('button')!
    expect(iconBtn).not.toBeNull()

    // Mock getBoundingClientRect
    jest.spyOn(form, 'getBoundingClientRect').mockReturnValue({
      left: 200,
      top: 500,
      right: 332,
      bottom: 540,
      width: 132,
      height: 40,
      x: 200,
      y: 500,
      toJSON: () => {},
    })

    // Simulate pointerdown on the icon handle
    act(() => {
      const downEvent = new Event('pointerdown', { bubbles: true }) as unknown as PointerEvent
      Object.assign(downEvent, { pointerId: 1, button: 0, clientX: 220, clientY: 520 })
      iconBtn.dispatchEvent(downEvent as unknown as Event)
    })

    // Simulate pointermove dragging by dx = 50, dy = -100
    act(() => {
      const moveEvent = new Event('pointermove', { bubbles: true }) as unknown as PointerEvent
      Object.assign(moveEvent, { pointerId: 1, clientX: 270, clientY: 420 })
      iconBtn.dispatchEvent(moveEvent as unknown as Event)
    })
    act(() => {
      const upEvent = new Event('pointerup', { bubbles: true }) as unknown as PointerEvent
      Object.assign(upEvent, { pointerId: 1 })
      iconBtn.dispatchEvent(upEvent as unknown as Event)
    })

    // Position style should update
    expect(form.style.left).toBe('250px')
    expect(form.style.top).toBe('400px')

    // Double-click on icon resets to center with smooth snap animation
    act(() => {
      iconBtn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })

    // During snapping: smoothly glides toward default center (446px) with duration-350
    expect(form.className).toContain('duration-350')
    expect(form.style.left).toBe('446px')

    // Advance past 350ms snap animation
    act(() => {
      jest.advanceTimersByTime(350)
    })

    expect(form.style.left).toBe('50%')
    expect(form.style.transform).toBe('translateX(-50%)')
  })

  it('independently slides icon from center translateX(46px) to left translateX(0px) with 5px padding', () => {
    act(() => {
      root.render(
        <AgentProvider>
          <GitAgentBar />
        </AgentProvider>
      )
    })

    const form = host.querySelector('form')!
    expect(form).not.toBeNull()
    expect(form.className).toContain('pl-[5px]')

    const iconBtn = host.querySelector('button')!
    // Initially centered before typewriter timer fires
    expect(iconBtn.style.transform).toBe('translateX(46px)')

    // Advance past initTimer (350ms)
    act(() => {
      jest.advanceTimersByTime(500)
    })

    // Now slid to left margin (0px relative to pl-[5px] -> 5px left margin matching top & bottom 5px)
    expect(iconBtn.style.transform).toBe('translateX(0px)')
  })

  it('expands at bottom-center with zero cross-screen motion and triggers remote vanish ghost when dragged', () => {
    act(() => {
      root.render(
        <AgentProvider>
          <GitAgentBar />
        </AgentProvider>
      )
    })

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    const form = host.querySelector('form')!
    const iconBtn = host.querySelector('button')!

    jest.spyOn(form, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 200,
      right: 232,
      bottom: 240,
      width: 132,
      height: 40,
      x: 100,
      y: 200,
      toJSON: () => {},
    })

    // Drag to (150, 300)
    act(() => {
      const downEvent = new Event('pointerdown', { bubbles: true }) as unknown as PointerEvent
      Object.assign(downEvent, { pointerId: 1, button: 0, clientX: 120, clientY: 220 })
      iconBtn.dispatchEvent(downEvent as unknown as Event)
    })
    act(() => {
      const moveEvent = new Event('pointermove', { bubbles: true }) as unknown as PointerEvent
      Object.assign(moveEvent, { pointerId: 1, clientX: 170, clientY: 320 })
      iconBtn.dispatchEvent(moveEvent as unknown as Event)
    })
    act(() => {
      const upEvent = new Event('pointerup', { bubbles: true }) as unknown as PointerEvent
      Object.assign(upEvent, { pointerId: 1 })
      iconBtn.dispatchEvent(upEvent as unknown as Event)
    })

    // Advance past drag release timeout
    act(() => {
      jest.advanceTimersByTime(150)
    })

    expect(form.style.left).toBe('150px')
    expect(form.style.top).toBe('300px')

    // Click form to open
    act(() => {
      form.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Expanded form is immediately at bottom center with zero cross-screen translation!
    expect(form.style.left).toBe('50%')
    expect(form.style.transform).toBe('translateX(-50%)')
  })

  it('correctly calculates distance and snaps back smoothly when dropped within SNAP_DISTANCE (64px)', () => {
    // With window dimensions 1024x768:
    // defaultX = (1024 - 132) / 2 = 446
    // defaultY = 768 - 20 - 40 = 708
    window.innerWidth = 1024
    window.innerHeight = 768

    expect(SNAP_DISTANCE).toBe(64)

    // Point near bottom center (e.g. offset by 30px)
    const nearDist = getPillDistance({ x: 446 + 30, y: 708 })
    expect(nearDist).toBe(30)
    expect(nearDist < SNAP_DISTANCE).toBe(true)

    // Point outside snap range (e.g. offset by 80px)
    const farDist = getPillDistance({ x: 446 + 80, y: 708 })
    expect(farDist).toBe(80)
    expect(farDist >= SNAP_DISTANCE).toBe(true)

    act(() => {
      root.render(
        <AgentProvider>
          <GitAgentBar />
        </AgentProvider>
      )
    })

    const form = host.querySelector('form')!
    const iconBtn = host.querySelector('button')!

    jest.spyOn(form, 'getBoundingClientRect').mockReturnValue({
      left: 446,
      top: 708,
      right: 578,
      bottom: 748,
      width: 132,
      height: 40,
      x: 446,
      y: 708,
      toJSON: () => {},
    })

    // Drag slightly within snap distance (dx = 30, dy = 10 -> dist ~ 31.6px < 64px)
    act(() => {
      const downEvent = new Event('pointerdown', { bubbles: true }) as unknown as PointerEvent
      Object.assign(downEvent, { pointerId: 1, button: 0, clientX: 450, clientY: 710 })
      iconBtn.dispatchEvent(downEvent as unknown as Event)
    })
    act(() => {
      const moveEvent = new Event('pointermove', { bubbles: true }) as unknown as PointerEvent
      Object.assign(moveEvent, { pointerId: 1, clientX: 480, clientY: 720 })
      iconBtn.dispatchEvent(moveEvent as unknown as Event)
    })
    act(() => {
      const upEvent = new Event('pointerup', { bubbles: true }) as unknown as PointerEvent
      Object.assign(upEvent, { pointerId: 1 })
      iconBtn.dispatchEvent(upEvent as unknown as Event)
    })

    // Triggers smooth snap animation
    expect(form.className).toContain('duration-350')
    expect(form.style.left).toBe('446px')

    // After 350ms snap completes, position resets to null (bottom center)
    act(() => {
      jest.advanceTimersByTime(350)
    })

    expect(form.style.left).toBe('50%')
    expect(form.style.transform).toBe('translateX(-50%)')
  })

  it('default position (not moved) expands and collapses in-place without remote ghosts', () => {
    act(() => {
      root.render(
        <AgentProvider>
          <GitAgentBar />
        </AgentProvider>
      )
    })

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    const form = host.querySelector('form')!
    expect(form.style.left).toBe('50%')
    expect(form.className).toContain('w-[132px]')

    // Open bar in-place at original position
    act(() => {
      form.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(form.className).toContain('w-[min(90vw,500px)]')
    // No remote vanish ghost rendered
    const vanishGhost = Array.from(host.querySelectorAll('div')).find((d) => d.style.animation?.includes('pill-vanish'))
    expect(vanishGhost).toBeUndefined()

    // Press Escape to collapse
    act(() => {
      form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    // Collapses back in-place to 132px
    expect(form.className).toContain('w-[132px]')
    // No remote reappear ghost rendered
    const reappearGhost = Array.from(host.querySelectorAll('div')).find((d) => d.style.animation?.includes('pill-reappear'))
    expect(reappearGhost).toBeUndefined()
  })

  it('any custom moved position (regardless of distance) uses dual-pill vanish and reappear animations', () => {
    act(() => {
      root.render(
        <AgentProvider>
          <GitAgentBar />
        </AgentProvider>
      )
    })

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    const form = host.querySelector('form')!
    const iconBtn = host.querySelector('button')!

    jest.spyOn(form, 'getBoundingClientRect').mockReturnValue({
      left: 40,
      top: 90,
      right: 172,
      bottom: 130,
      width: 132,
      height: 40,
      x: 40,
      y: 90,
      toJSON: () => {},
    })

    // Drag to custom position (50, 100)
    act(() => {
      const downEvent = new Event('pointerdown', { bubbles: true }) as unknown as PointerEvent
      Object.assign(downEvent, { pointerId: 1, button: 0, clientX: 50, clientY: 100 })
      iconBtn.dispatchEvent(downEvent as unknown as Event)
    })
    act(() => {
      const moveEvent = new Event('pointermove', { bubbles: true }) as unknown as PointerEvent
      Object.assign(moveEvent, { pointerId: 1, clientX: 60, clientY: 110 })
      iconBtn.dispatchEvent(moveEvent as unknown as Event)
    })
    act(() => {
      const upEvent = new Event('pointerup', { bubbles: true }) as unknown as PointerEvent
      Object.assign(upEvent, { pointerId: 1 })
      iconBtn.dispatchEvent(upEvent as unknown as Event)
    })

    act(() => {
      jest.advanceTimersByTime(150)
    })

    // Remote pill is mini at (50, 100)
    expect(form.style.left).toBe('50px')
    expect(form.style.top).toBe('100px')
    expect(form.className).toContain('w-[132px]')

    // Click to open -> triggers dual-pill animation (vanish at remote, expand at bottom)
    act(() => {
      form.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Bottom bar expands at bottom-center
    expect(form.style.left).toBe('50%')
    expect(form.style.transform).toBe('translateX(-50%)')
    expect(form.className).toContain('w-[min(90vw,500px)]')

    // Remote vanish ghost is playing pill-vanish at (50, 100)
    const remoteVanishGhost = Array.from(host.querySelectorAll('div')).find((d) => d.style.animation?.includes('pill-vanish'))
    expect(remoteVanishGhost).not.toBeUndefined()
    expect(remoteVanishGhost?.style.top).toBe('100px')

    // Advance to let open settle
    act(() => {
      jest.advanceTimersByTime(400)
    })

    // Simulate BLUR / click outside to close
    act(() => {
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })

    // 1. Bottom bar retreats strictly in-place at bottom-center with bottom-bar-vanish
    expect(form.style.left).toBe('50%')
    expect(form.style.transform).toBe('translateX(-50%)')
    expect(form.style.animation).toContain('bottom-bar-vanish')
    expect(form.className).toContain('w-[min(90vw,500px)]')

    // 2. Input container is hidden (opacity-0)
    const inputContainer = form.querySelector('div')
    expect(inputContainer?.className).toContain('opacity-0')

    // 3. Remote reappear ghost is playing pill-reappear at (50, 100)
    const remoteReappearGhost = Array.from(host.querySelectorAll('div')).find((d) => d.style.animation?.includes('pill-reappear'))
    expect(remoteReappearGhost).not.toBeUndefined()
    expect(remoteReappearGhost?.style.top).toBe('100px')

    // 4. Advance past 400ms close animation
    act(() => {
      jest.advanceTimersByTime(450)
    })

    // Now live pill is restored at (50, 100) in mini initialization state
    expect(form.style.left).toBe('50px')
    expect(form.style.top).toBe('100px')
    expect(form.className).toContain('w-[132px]')
  })
})
