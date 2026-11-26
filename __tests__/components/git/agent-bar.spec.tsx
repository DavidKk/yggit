/** @jest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { getPillDistance, GitAgentBar, SNAP_DISTANCE } from '@/components/git/agent/GitAgentBar'
import { AgentContext, type AgentContextValue, AgentProvider, DEFAULT_REDACTION_OPTIONS } from '@/lib/agent/agent-context'
import { DEFAULT_MODEL_FILTER } from '@/lib/agent/model-filter'
import { DEFAULT_MODEL_PROFILE } from '@/lib/agent/model-profiles'

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
    expect(host.textContent).toContain('Yggi')

    // Press Escape while already collapsed
    act(() => {
      form?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    // Label should remain intact, not cleared or re-started
    expect(host.textContent).toContain('Yggi')

    // Advance partial time — text should STILL be intact
    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(host.textContent).toContain('Yggi')
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

  it('compresses Quick Answer Card downward into bottom pill on minimize and can restore recent response', () => {
    const mockContext: AgentContextValue = {
      config: {
        provider: 'ollama',
        model: 'qwen2.5:7b',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
        stream: true,
      },
      profiles: [DEFAULT_MODEL_PROFILE],
      activeProfileId: 'default',
      saveProfile: jest.fn(),
      deleteProfile: jest.fn(),
      selectProfile: jest.fn(),
      toggleProfileEnabled: jest.fn(),
      redactionOptions: DEFAULT_REDACTION_OPTIONS,
      setRedactionOptions: jest.fn(),
      dockMode: 'collapsed',
      setDockMode: jest.fn(),
      messages: [
        { id: '1', role: 'user', content: '查看最近提交' },
        { id: '2', role: 'assistant', content: '主分支最近一次提交内容: feat:b' },
      ],
      isProcessing: false,
      sendMessage: jest.fn(),
      retryMessage: jest.fn(),
      clearMessages: jest.fn(),
      activeResultSummary: null,
      activeRepo: '',
      setActiveRepo: jest.fn(),
      modelFilter: DEFAULT_MODEL_FILTER,
      setModelFilter: jest.fn(),
    }

    act(() => {
      root.render(
        <AgentContext.Provider value={mockContext}>
          <GitAgentBar />
        </AgentContext.Provider>
      )
    })

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Initially in collapsed mini pill state with notification indicator
    const miniForm = host.querySelector('form')!
    expect(miniForm).not.toBeNull()
    expect(host.querySelector('.bg-accent.animate-pulse')).not.toBeNull()

    // Clicking mini pill restores the Quick Answer Card directly
    act(() => {
      miniForm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const card = host.querySelector('[role="dialog"]') as HTMLElement
    expect(card).not.toBeNull()
    expect(host.textContent).toContain('gitAgent.quickAnswer')
    expect(host.textContent).toContain('主分支最近一次提交内容: feat:b')

    // Find the minimize button (LuMinus) in the header controls
    const buttons = card.querySelectorAll('button')
    const minimizeBtn = Array.from(buttons).find((b) => b.getAttribute('aria-label') === 'gitAgent.minimizeToPill' || b.getAttribute('aria-label') === '收起为药丸')
    expect(minimizeBtn).not.toBeUndefined()

    // Click minimize: triggers downward compression into bottom pill
    act(() => {
      minimizeBtn?.click()
    })

    // Immediately in collapsing state: collapses downward towards bottom bar
    expect(card.className).toContain('max-h-0')
    expect(card.className).toContain('opacity-0')
    expect(card.className).toContain('w-[min(90vw,500px)]')

    // Advance 300ms for compression to complete
    act(() => {
      jest.advanceTimersByTime(300)
    })

    // Card is merged into the expanded bottom bar, with the restore button available
    const expandedForm = host.querySelector('form')!
    expect(expandedForm).not.toBeNull()
    expect(expandedForm.className).toContain('w-[min(90vw,500px)]')

    const restoreBtn = Array.from(expandedForm.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'gitAgent.restoreQuickAnswer' || b.getAttribute('aria-label') === '还原最近回答'
    )
    expect(restoreBtn).not.toBeUndefined()

    // Clicking restore button re-expands the Quick Answer Card
    act(() => {
      restoreBtn?.click()
    })

    const restoredCard = host.querySelector('[role="dialog"]') as HTMLElement
    expect(restoredCard).not.toBeNull()
    expect(host.textContent).toContain('主分支最近一次提交内容: feat:b')
  })

  it('docks to sidebar when clicking dock button in Quick Card without being intercepted by click outside', () => {
    const setDockModeMock = jest.fn()
    const mockContext: AgentContextValue = {
      config: {
        provider: 'ollama',
        model: 'qwen2.5:7b',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
        stream: true,
      },
      profiles: [DEFAULT_MODEL_PROFILE],
      activeProfileId: 'default',
      saveProfile: jest.fn(),
      deleteProfile: jest.fn(),
      selectProfile: jest.fn(),
      toggleProfileEnabled: jest.fn(),
      redactionOptions: DEFAULT_REDACTION_OPTIONS,
      setRedactionOptions: jest.fn(),
      dockMode: 'collapsed',
      setDockMode: setDockModeMock,
      messages: [
        { id: '1', role: 'user', content: '查看最近提交' },
        { id: '2', role: 'assistant', content: '主分支最近一次提交内容: feat:b' },
      ],
      isProcessing: false,
      sendMessage: jest.fn(),
      retryMessage: jest.fn(),
      clearMessages: jest.fn(),
      activeResultSummary: null,
      activeRepo: '',
      setActiveRepo: jest.fn(),
      modelFilter: DEFAULT_MODEL_FILTER,
      setModelFilter: jest.fn(),
    }

    act(() => {
      root.render(
        <AgentContext.Provider value={mockContext}>
          <GitAgentBar />
        </AgentContext.Provider>
      )
    })

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Click mini pill to open Quick Card
    const miniForm = host.querySelector('form')!
    act(() => {
      miniForm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const card = host.querySelector('[role="dialog"]') as HTMLElement
    expect(card).not.toBeNull()

    // Find the dock right button
    const buttons = card.querySelectorAll('button')
    const dockBtn = Array.from(buttons).find(
      (b) => b.getAttribute('aria-label') === 'gitAgent.deepDiscussion' || b.getAttribute('aria-label') === '停靠侧栏深入讨论' || b.getAttribute('aria-label') === '停靠深入讨论'
    )
    expect(dockBtn).not.toBeUndefined()

    // Dispatch pointerdown first (which tests that click outside does not misfire)
    act(() => {
      const PointerEventClass = typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent
      dockBtn?.dispatchEvent(new PointerEventClass('pointerdown', { bubbles: true }))
    })

    // Ensure card did not enter collapsing state
    expect(card.className).not.toContain('max-h-0')

    // Dispatch click on dockBtn
    act(() => {
      dockBtn?.click()
    })

    // Verify setDockMode was called with 'dock-right'
    expect(setDockModeMock).toHaveBeenCalledWith('dock-right')
  })

  it('opens and displays reference citation tag when yggit:agent_open event is dispatched with reference', () => {
    act(() => {
      root.render(
        <AgentProvider>
          <GitAgentBar />
        </AgentProvider>
      )
    })

    act(() => {
      window.dispatchEvent(
        new CustomEvent('yggit:agent_open', {
          detail: {
            reference: {
              title: '同步默认分支',
              prompt: '请协助处理工作台任务',
            },
          },
        })
      )
      jest.advanceTimersByTime(450)
    })

    expect(host.textContent).toContain('同步默认分支')
    const removeRefBtn = host.querySelector('span[title="同步默认分支"] button') as HTMLButtonElement | null
    expect(removeRefBtn).not.toBeNull()

    // Clicking remove clears citation
    act(() => {
      removeRefBtn?.click()
    })
    expect(host.textContent).not.toContain('同步默认分支')
  })

  it('ignores yggit:agent_open when target is sidebar or dockMode is not collapsed', () => {
    const mockContext: AgentContextValue = {
      config: {
        provider: 'ollama',
        model: 'qwen2.5:7b',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
        stream: true,
      },
      profiles: [DEFAULT_MODEL_PROFILE],
      activeProfileId: 'default',
      saveProfile: jest.fn(),
      deleteProfile: jest.fn(),
      selectProfile: jest.fn(),
      toggleProfileEnabled: jest.fn(),
      redactionOptions: DEFAULT_REDACTION_OPTIONS,
      setRedactionOptions: jest.fn(),
      dockMode: 'dock-right', // Sidebar is open
      setDockMode: jest.fn(),
      messages: [],
      isProcessing: false,
      sendMessage: jest.fn(),
      retryMessage: jest.fn(),
      clearMessages: jest.fn(),
      activeResultSummary: null,
      activeRepo: '',
      setActiveRepo: jest.fn(),
      modelFilter: DEFAULT_MODEL_FILTER,
      setModelFilter: jest.fn(),
    }

    act(() => {
      root.render(
        <AgentContext.Provider value={mockContext}>
          <GitAgentBar />
        </AgentContext.Provider>
      )
    })

    act(() => {
      window.dispatchEvent(
        new CustomEvent('yggit:agent_open', {
          detail: {
            reference: {
              title: '侧栏打开时不应该进底部栏',
            },
            target: 'sidebar',
          },
        })
      )
      jest.advanceTimersByTime(450)
    })

    // GitAgentBar should NOT open or display citation
    expect(host.textContent).not.toContain('侧栏打开时不应该进底部栏')
  })
})
