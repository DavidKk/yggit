/** @jest-environment jsdom */

import React, { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { ModelChannelSection } from '@/components/git/agent/settings/ModelChannelSection'
import { AgentProvider, useAgent } from '@/lib/agent/agent-context'
import { MODEL_PROFILES_STORAGE_KEY } from '@/lib/agent/model-profiles'
import { sendAgentCompletion, testAgentConnection } from '@/lib/agent/openapi-client'

jest.mock('@/components/i18n/LocaleProvider', () => ({ useT: () => (key: string) => key }))
jest.mock('@/lib/agent/openapi-client', () => ({ testAgentConnection: jest.fn(), sendAgentCompletion: jest.fn() }))
jest.mock('@/lib/agent/spotlight-context', () => ({ useOptionalSpotlight: () => null }))
jest.mock('@/lib/agent/tools', () => ({ AGENT_GIT_TOOLS: [], executeAgentTool: jest.fn() }))
jest.mock('@/components/git/agent/settings/PrivacyNoticeCallout', () => ({ PrivacyNoticeCallout: () => null }))
jest.mock('@/components/sk', () => ({
  TextInput: (props: ComponentProps<'input'> & { fullWidth?: boolean }) => {
    const { fullWidth: _fullWidth, ...rest } = props
    return <input {...rest} />
  },
  Button: (props: ComponentProps<'button'> & { size?: string; variant?: string; loading?: boolean }) => {
    const { size: _size, variant: _variant, loading, ...rest } = props
    return <button type="button" {...rest} disabled={rest.disabled || loading} />
  },
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Select: ({ options, value, onChange, ...rest }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) => (
    <select {...rest} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  InputSuggestion: ({
    id,
    value,
    onChange,
    placeholder,
    options = [],
  }: {
    id?: string
    value: string
    onChange: (val: string) => void
    placeholder?: string
    options?: { value: string; label: string }[]
  }) => (
    <div>
      <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  ),
  TagInput: ({ id, value = [], onChange, placeholder }: { id?: string; value: string[]; onChange: (val: string[]) => void; placeholder?: string }) => (
    <input
      id={id}
      value={value.join(', ')}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(
          e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        )
      }
    />
  ),
}))

let root: Root
let host: HTMLDivElement
function CurrentConfig() {
  const { config, sendMessage } = useAgent()
  return (
    <>
      <output>{JSON.stringify(config)}</output>
      <button onClick={() => sendMessage('hello')}>Send chat</button>
    </>
  )
}
function button(text: string) {
  return Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent === text || item.getAttribute('aria-label') === text || item.querySelector('span')?.textContent === text
  )!
}
async function click(text: string) {
  await act(async () => {
    button(text).click()
  })
}
async function input(id: string, value: string) {
  await act(async () => {
    const element = host.querySelector<HTMLInputElement>(`#${id}`)!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function save() {
  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.clear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => {
    root.render(
      <AgentProvider>
        <ModelChannelSection />
        <CurrentConfig />
      </AgentProvider>
    )
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

it('allows continuous key entry, saves multiple connections, keeps saved keys on focus, and switches the active config', async () => {
  await click('gitAgent.addModel')
  await input('agent-model-name', 'Second endpoint')
  await act(async () => {
    const select = host.querySelector('select')!
    select.value = 'byop'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await input('agent-api-key', 's')
  expect(host.querySelector<HTMLInputElement>('#agent-api-key')!.readOnly).toBe(false)
  await input('agent-api-key', 'session-key')
  await input('agent-model-id', 'my-custom-model')
  jest.mocked(testAgentConnection).mockResolvedValue({ ok: true, latencyMs: 5 })
  await click('gitAgent.testConnection')
  expect(testAgentConnection).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'session-key', model: 'my-custom-model' }))
  await save()
  expect(host.querySelector('output')!.textContent).toContain('session-key')
  expect(localStorage.getItem(MODEL_PROFILES_STORAGE_KEY)).not.toContain('session-key')
  jest.mocked(sendAgentCompletion).mockResolvedValue({ id: 'test', content: 'hello' })
  await click('Send chat')
  expect(sendAgentCompletion).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ apiKey: 'session-key', model: 'my-custom-model' }) }))
  await click('Second endpoint')
  const key = host.querySelector<HTMLInputElement>('#agent-api-key')!
  expect(key.value).toBe('******')
  await act(async () => key.focus())
  await act(async () => key.blur())
  await save()
  expect(host.querySelector('output')!.textContent).toContain('session-key')
  await click('gitAgent.useModel')
  expect(host.querySelector('output')!.textContent).toContain('reflection/beam-free')
})

it('discards edits on return and validates required keys before saving', async () => {
  await click('gitAgent.addModel')
  await input('agent-model-name', 'Unsaved')
  await click('gitAgent.backToModels')
  expect(host.textContent).not.toContain('Unsaved')
  await click('gitAgent.addModel')
  await input('agent-model-name', 'Missing key')
  await act(async () => {
    const select = host.querySelector('select')!
    select.value = 'byop'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await save()
  expect(host.querySelector('[role="alert"]')!.textContent).toBe('gitAgent.keyRequired')
  expect(host.querySelector('form')).not.toBeNull()
})

it('clears or replaces saved credentials without submitting the mask', async () => {
  await click('gitAgent.editModel')
  await input('agent-api-key', 'first-key')
  await save()
  await click('gitAgent.editModel')
  await act(async () => host.querySelector<HTMLInputElement>('#agent-api-key')!.focus())
  await input('agent-api-key', 'replacement-key')
  await save()
  expect(host.querySelector('output')!.textContent).toContain('replacement-key')
  expect(host.querySelector('output')!.textContent).not.toContain('first-key')
  await click('gitAgent.editModel')
  await click('gitAgent.clearKey')
  await save()
  expect(host.querySelector('output')!.textContent).not.toContain('replacement-key')
  expect(host.querySelector('output')!.textContent).not.toContain('******')
})
