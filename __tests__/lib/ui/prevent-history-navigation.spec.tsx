/** @jest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { usePreventHistoryNavigation } from '@/lib/ui/prevent-history-navigation'

function TestComponent() {
  usePreventHistoryNavigation()
  return <div>test</div>
}

describe('usePreventHistoryNavigation', () => {
  let root: Root
  let container: HTMLDivElement
  let addEventListenerSpy: jest.SpyInstance
  let removeEventListenerSpy: jest.SpyInstance
  let wheelHandler: ((e: WheelEvent) => void) | null = null

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    wheelHandler = null
    addEventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'wheel') {
        wheelHandler = handler as (e: WheelEvent) => void
      }
    })
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('registers non-passive wheel listener and unregisters on unmount', async () => {
    await act(async () => {
      root.render(<TestComponent />)
    })
    expect(addEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false })

    await act(async () => {
      root.unmount()
    })
    expect(removeEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function))
  })

  it('ignores vertical wheel scrolls (deltaY >= deltaX)', async () => {
    await act(async () => {
      root.render(<TestComponent />)
    })
    expect(wheelHandler).not.toBeNull()

    const event = {
      deltaX: 10,
      deltaY: 50,
      preventDefault: jest.fn(),
      composedPath: () => [],
    } as unknown as WheelEvent

    wheelHandler!(event)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('prevents default when horizontal swipe cannot scroll anywhere in path', async () => {
    await act(async () => {
      root.render(<TestComponent />)
    })

    const div = document.createElement('div')
    Object.defineProperty(div, 'scrollWidth', { value: 200 })
    Object.defineProperty(div, 'clientWidth', { value: 200 })
    Object.defineProperty(div, 'scrollLeft', { value: 0 })

    const event = {
      deltaX: -40,
      deltaY: 0,
      preventDefault: jest.fn(),
      composedPath: () => [div, document.body, document.documentElement],
    } as unknown as WheelEvent

    wheelHandler!(event)
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('allows horizontal scroll when element can still scroll in swipe direction', async () => {
    await act(async () => {
      root.render(<TestComponent />)
    })

    const scrollable = document.createElement('div')
    scrollable.style.overflowX = 'auto'
    Object.defineProperty(scrollable, 'scrollWidth', { value: 500 })
    Object.defineProperty(scrollable, 'clientWidth', { value: 200 })
    Object.defineProperty(scrollable, 'scrollLeft', { value: 100 })

    const event = {
      deltaX: -30,
      deltaY: 2,
      preventDefault: jest.fn(),
      composedPath: () => [scrollable, document.body, document.documentElement],
    } as unknown as WheelEvent

    wheelHandler!(event)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
