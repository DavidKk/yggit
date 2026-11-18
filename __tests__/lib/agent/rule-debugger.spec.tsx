/** @jest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { RuleDebugger } from '@/components/git/agent/settings/RuleDebugger'
import type { ModelFilterOptions } from '@/lib/agent/model-filter'

jest.mock('@/components/i18n/LocaleProvider', () => ({ useT: () => (key: string) => key }))
jest.mock('@/lib/agent/agent-context', () => ({
  useAgent: () => ({
    redactionOptions: {
      enabled: true,
      categories: { pii: true, secrets: true, network: true, custom: true },
      customWords: [{ word: 'a-*' }],
      allowList: ['a-public'],
    },
  }),
}))

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

async function render(filter: ModelFilterOptions) {
  await act(async () => root.render(<RuleDebugger filter={filter} modelId="a-demo" />))
}

it('reflects draft filter changes and applies blacklist priority without an agent request', async () => {
  await render({ whitelist: ['a-*'], blacklist: [] })
  expect(host.querySelector('[role="status"]')?.textContent).toContain('gitAgent.modelAllowed')
  expect(host.querySelector('[role="status"]')?.textContent).toContain('a-*')
  await render({ whitelist: ['a-*'], blacklist: ['a-*'] })
  expect(host.querySelector('pre')?.textContent).toBe('gitAgent.modelDenied')
})

it('previews wildcard redaction, allowlist exemptions, and replacement mappings', async () => {
  await render({ whitelist: [], blacklist: [] })
  const input = host.querySelector('textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Inspect a-private and a-public; demo@example.com')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const preview = host.querySelector('pre')!.textContent!
  expect(preview).not.toContain('a-private')
  expect(preview).not.toContain('demo@example.com')
  expect(preview).toContain('a-public')
  expect(host.querySelector('dl')!.textContent).toContain('a-private')
  expect(host.querySelector('dl')!.textContent).toContain('demo@example.com')
})
