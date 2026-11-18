/** @jest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { VirtualList } from '@/components/sk/VirtualList'

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

async function render(count: number) {
  await act(async () => root.render(<VirtualList count={count} rowHeight={32} renderRow={(index) => `branch-${index}`} />))
}

it('keeps ten thousand rows bounded and replaces mounted rows when scrolling', async () => {
  await render(10000)
  const list = host.querySelector<HTMLElement>('[role="list"]')!
  Object.defineProperty(list, 'clientHeight', { value: 320 })
  expect(host.querySelectorAll('[role="listitem"]').length).toBeLessThan(40)
  await act(async () => {
    list.scrollTop = 160000
    list.dispatchEvent(new Event('scroll'))
  })
  expect(host.textContent).toContain('branch-5000')
  expect(host.textContent).not.toContain('branch-0')
  expect(host.querySelectorAll('[role="listitem"]').length).toBeLessThan(40)
})

it('does not leave a blank viewport when filtering or collapsing a scrolled list', async () => {
  await render(10000)
  const list = host.querySelector<HTMLElement>('[role="list"]')!
  Object.defineProperty(list, 'clientHeight', { value: 320 })
  await act(async () => {
    list.scrollTop = 300000
    list.dispatchEvent(new Event('scroll'))
  })
  await render(3)
  expect(list.scrollTop).toBe(0)
  expect(host.querySelectorAll('[role="listitem"]')).toHaveLength(3)
  expect(host.textContent).toContain('branch-0')
  await render(0)
  expect(host.querySelectorAll('[role="listitem"]')).toHaveLength(0)
})
