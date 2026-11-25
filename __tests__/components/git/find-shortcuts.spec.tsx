/** @jest-environment jsdom */
import { act, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'

import { useGitFindPanel, useGitFindShortcut } from '@/components/git/gitFind'

function Panel({ name, children }: { name: string; children?: React.ReactNode }) {
  const panel = useRef<HTMLElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  useGitFindPanel(panel, input, () => setOpen(true))
  return (
    <section ref={panel} data-git-find={name} tabIndex={0}>
      {open && <input ref={input} aria-label={name} defaultValue="query" />}
      {children}
    </section>
  )
}

function Harness() {
  const root = useRef<HTMLDivElement>(null)
  useGitFindShortcut(root)
  return (
    <div ref={root}>
      <Panel name="file">
        <Panel name="left" />
        <Panel name="right" />
      </Panel>
      {createPortal(
        <div data-git-search-dropdown="">
          <input aria-label="dropdown" defaultValue="branch" />
        </div>,
        document.body
      )}
      {createPortal(<Panel name="project-menu" />, document.body)}
    </div>
  )
}

let host: HTMLDivElement
let root: Root
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  jest.useFakeTimers()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<Harness />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  jest.useRealTimers()
})

async function find(target: HTMLElement, modifier: 'metaKey' | 'ctrlKey') {
  target.focus()
  const event = new KeyboardEvent('keydown', { key: 'f', [modifier]: true, bubbles: true, cancelable: true })
  await act(async () => target.dispatchEvent(event))
  await act(async () => jest.advanceTimersByTime(20))
  expect(event.defaultPrevented).toBe(true)
}

it.each(['metaKey', 'ctrlKey'] as const)('opens and refocuses the focused file search with %s on any platform', async (modifier) => {
  await find(host.querySelector<HTMLElement>('[data-git-find="file"]')!, modifier)
  const input = host.querySelector<HTMLInputElement>('input[aria-label="file"]')!
  expect(document.activeElement).toBe(input)
  input.setSelectionRange(0, 0)
  await find(input, modifier)
  expect(input.selectionEnd).toBe(input.value.length)
})

it('opens only the focused pane in a split view', async () => {
  await find(host.querySelector<HTMLElement>('[data-git-find="right"]')!, 'metaKey')
  expect(document.activeElement?.getAttribute('aria-label')).toBe('right')
  expect(host.querySelector('input[aria-label="left"]')).toBeNull()
  expect(host.querySelector('input[aria-label="file"]')).toBeNull()
})

it('selects an already open portaled search without switching panels', async () => {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="dropdown"]')!
  await find(input, 'metaKey')
  expect(document.activeElement).toBe(input)
  expect(input.selectionStart).toBe(0)
  expect(input.selectionEnd).toBe(input.value.length)
})

it('opens search on portaled project-menu outside root', async () => {
  const menu = document.querySelector<HTMLElement>('[data-git-find="project-menu"]')!
  await find(menu, 'metaKey')
  const input = document.querySelector<HTMLInputElement>('input[aria-label="project-menu"]')!
  expect(document.activeElement).toBe(input)
})
