/** @jest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { TagInput } from '@/components/sk/TagInput'

let root: Root
let host: HTMLDivElement

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

it('renders tags and input element with placeholder', async () => {
  await act(async () => {
    root.render(<TagInput value={['tag1', 'tag2']} onChange={jest.fn()} placeholder="Enter tag..." />)
  })

  expect(host.textContent).toContain('tag1')
  expect(host.textContent).toContain('tag2')
})

it('adds tag on Enter and comma, avoiding duplicates', async () => {
  const onChange = jest.fn()
  await act(async () => {
    root.render(<TagInput value={['alpha']} onChange={onChange} />)
  })

  const input = host.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'beta')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })

  expect(onChange).toHaveBeenCalledWith(['alpha', 'beta'])

  // Trying to add duplicate 'ALPHA'
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'ALPHA')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ',', bubbles: true }))
  })

  expect(onChange).toHaveBeenCalledTimes(1)
})

it('removes tag on click close button or backspace', async () => {
  const onChange = jest.fn()
  await act(async () => {
    root.render(<TagInput value={['item1', 'item2']} onChange={onChange} />)
  })

  const removeBtns = host.querySelectorAll('button')
  expect(removeBtns.length).toBe(2)
  await act(async () => {
    removeBtns[0].click()
  })
  expect(onChange).toHaveBeenCalledWith(['item2'])

  // Backspace on empty input removes last tag
  const input = host.querySelector('input')!
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
  })
  expect(onChange).toHaveBeenCalledWith(['item1'])
})

it('supports pasting comma or newline separated values', async () => {
  const onChange = jest.fn()
  await act(async () => {
    root.render(<TagInput value={['existing']} onChange={onChange} />)
  })

  const input = host.querySelector('input')!
  const pasteEvent = new Event('paste', { bubbles: true }) as unknown as ClipboardEvent
  Object.defineProperty(pasteEvent, 'clipboardData', {
    value: {
      getData: () => 'new1, new2\nnew3',
    },
  })

  await act(async () => {
    input.dispatchEvent(pasteEvent as unknown as Event)
  })

  expect(onChange).toHaveBeenCalledWith(['existing', 'new1', 'new2', 'new3'])
})

it('supports multiline and custom rows layout', async () => {
  await act(async () => {
    root.render(<TagInput value={['tag1']} onChange={jest.fn()} multiline rows={3} />)
  })

  const container = host.querySelector('div')!
  expect(container.className).toContain('min-h-24')
  expect(container.className).toContain('items-start')
  expect(container.className).toContain('content-start')
})
