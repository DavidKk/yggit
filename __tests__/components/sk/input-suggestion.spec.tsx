/** @jest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { InputSuggestion } from '@/components/sk/InputSuggestion'

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

it('renders input with value and placeholder', async () => {
  const onChange = jest.fn()
  await act(async () => {
    root.render(
      <InputSuggestion
        id="test-model"
        value="gpt-4o"
        onChange={onChange}
        options={[
          { value: 'gpt-4o', label: 'GPT-4o' },
          { value: 'deepseek-chat', label: 'DeepSeek Chat' },
        ]}
      />
    )
  })

  const input = host.querySelector('input') as HTMLInputElement
  expect(input).not.toBeNull()
  expect(input.value).toBe('gpt-4o')
})

it('allows typing to filter and triggers onChange', async () => {
  const onChange = jest.fn()
  await act(async () => {
    root.render(
      <InputSuggestion
        id="test-model"
        value=""
        onChange={onChange}
        options={[
          { value: 'gpt-4o', label: 'GPT-4o' },
          { value: 'deepseek-chat', label: 'DeepSeek Chat' },
        ]}
      />
    )
  })

  const input = host.querySelector('input') as HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'deep')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  expect(onChange).toHaveBeenCalledWith('deep')
})

it('picks an option from dropdown on click', async () => {
  const onChange = jest.fn()
  await act(async () => {
    root.render(
      <InputSuggestion
        id="test-model"
        value=""
        onChange={onChange}
        options={[
          { value: 'gpt-4o', label: 'GPT-4o' },
          { value: 'deepseek-chat', label: 'DeepSeek Chat' },
        ]}
      />
    )
  })

  const input = host.querySelector('input') as HTMLInputElement
  await act(async () => {
    input.focus()
  })

  const options = document.body.querySelectorAll('[role="option"]')
  expect(options.length).toBeGreaterThanOrEqual(2)

  await act(async () => {
    ;(options[1] as HTMLElement).click()
  })

  expect(onChange).toHaveBeenCalledWith('deepseek-chat')
})

it('renders integrated action button and triggers onClick', async () => {
  const onClick = jest.fn()
  await act(async () => {
    root.render(
      <InputSuggestion
        id="test-model"
        value="qwen"
        onChange={jest.fn()}
        options={[{ value: 'qwen', label: 'Qwen' }]}
        action={{
          label: '读取列表',
          onClick,
        }}
      />
    )
  })

  const actionButton = host.querySelector('button[title], button:not([aria-label="Toggle suggestions"])') as HTMLButtonElement
  expect(actionButton).not.toBeNull()
  expect(actionButton.textContent).toContain('读取列表')

  await act(async () => {
    actionButton.click()
  })

  expect(onClick).toHaveBeenCalledTimes(1)
})

it('has autocomplete and credential ignore attributes to prevent username autofill', async () => {
  await act(async () => {
    root.render(<InputSuggestion id="test-model" name="test_model_name" value="" onChange={jest.fn()} options={[]} />)
  })

  const input = host.querySelector('input') as HTMLInputElement
  expect(input.getAttribute('autoComplete')).toBe('off')
  expect(input.getAttribute('data-1p-ignore')).toBe('true')
  expect(input.getAttribute('data-lpignore')).toBe('true')
  expect(input.getAttribute('role')).toBe('combobox')
})
