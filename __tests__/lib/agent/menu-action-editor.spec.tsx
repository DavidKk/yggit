/** @jest-environment jsdom */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import { ConfirmProvider } from '@/components/confirm/ConfirmProvider'
import { AgentMenuActionEditor } from '@/components/git/agent/settings/AgentMenuActionEditor'
import { CONTEXT_MENU_STORAGE_KEY, DEFAULT_CONTEXT_MENU_CONFIG } from '@/lib/git/context-menu-config'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/components/i18n/LocaleProvider', () => ({ useT: () => (key: string) => key, useLocaleCode: () => 'en' }))

it('saves edited description and prompt while preserving the disabled state', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.setItem(
    CONTEXT_MENU_STORAGE_KEY,
    JSON.stringify({
      ...DEFAULT_CONTEXT_MENU_CONFIG,
      agentActions: [{ id: 'custom-test', label: 'Review', description: 'Old description', prompt: 'Review this branch', enabled: false }],
    })
  )
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () =>
      root.render(
        <ConfirmProvider>
          <AgentMenuActionEditor actionId="custom-test" />
        </ConfirmProvider>
      )
    )
    const description = host.querySelectorAll('input')[1]
    expect(description.value).toBe('Old description')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(description, 'Concise description')
      description.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    const saved = JSON.parse(localStorage.getItem(CONTEXT_MENU_STORAGE_KEY)!)
    expect(saved.agentActions).toEqual([{ id: 'custom-test', label: 'Review', description: 'Concise description', prompt: 'Review this branch', enabled: false }])
    expect(mockPush).toHaveBeenCalledWith('/settings/menus')
  } finally {
    await act(async () => root.unmount())
    host.remove()
    localStorage.clear()
  }
})

it('keeps an action on cancel and removes it only after editor confirmation', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  mockPush.mockClear()
  const action = { id: 'custom-delete', label: 'Review', description: '', prompt: 'Review changes', enabled: true }
  localStorage.setItem(CONTEXT_MENU_STORAGE_KEY, JSON.stringify({ ...DEFAULT_CONTEXT_MENU_CONFIG, agentActions: [action] }))
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const button = (label: string) => [...document.body.querySelectorAll('button')].find((item) => item.textContent?.trim() === label)!
  try {
    await act(async () =>
      root.render(
        <ConfirmProvider>
          <AgentMenuActionEditor actionId={action.id} />
        </ConfirmProvider>
      )
    )
    await act(async () => button('gitAgent.deleteAction').click())
    expect(JSON.parse(localStorage.getItem(CONTEXT_MENU_STORAGE_KEY)!).agentActions).toEqual([action])
    await act(async () => button('common.cancel').click())
    expect(JSON.parse(localStorage.getItem(CONTEXT_MENU_STORAGE_KEY)!).agentActions).toEqual([action])
    expect(mockPush).not.toHaveBeenCalled()
    await act(async () => button('gitAgent.deleteAction').click())
    await act(async () => document.querySelector<HTMLButtonElement>('[data-modal-initial="confirm"]')!.click())
    expect(JSON.parse(localStorage.getItem(CONTEXT_MENU_STORAGE_KEY)!).agentActions).toEqual([])
    expect(mockPush).toHaveBeenCalledWith('/settings/menus')
  } finally {
    await act(async () => root.unmount())
    host.remove()
    localStorage.clear()
  }
})
