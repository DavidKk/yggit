/** @jest-environment jsdom */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import { ConfirmProvider } from '@/components/confirm/ConfirmProvider'
import { StorageSettingsSection } from '@/components/git/agent/settings/StorageSettingsSection'
import { clearBrowserStorage, deleteBrowserDatabase, inspectBrowserStorage } from '@/lib/storage/browser-storage'
import { CONFLICTS_DATABASE, HANDLES_DATABASE } from '@/lib/storage/databases'

jest.mock('@/components/i18n/LocaleProvider', () => ({
  useT: () => (key: string, values?: Record<string, unknown>) => `${key}${values ? ` ${JSON.stringify(values)}` : ''}`,
  useLocaleCode: () => 'en',
}))
jest.mock('@/lib/storage/browser-storage', () => ({ inspectBrowserStorage: jest.fn(), deleteBrowserDatabase: jest.fn(), clearBrowserStorage: jest.fn() }))

it('shows a compact database list and confirms individual/all deletion, including unavailable sizes', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  jest.mocked(inspectBrowserStorage).mockResolvedValue([
    { name: HANDLES_DATABASE, bytes: 2048 },
    { name: CONFLICTS_DATABASE, error: 'Size scan failed' },
  ])
  // Keep the page mounted and verify recoverable deletion errors without reloading jsdom.
  jest.mocked(deleteBrowserDatabase).mockRejectedValue(new Error('Database blocked'))
  jest.mocked(clearBrowserStorage).mockRejectedValue(new Error('Database blocked'))
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const button = (label: string) => [...document.body.querySelectorAll('button')].find((item) => item.textContent?.trim() === label)!
  const removeOne = () => host.querySelector<HTMLButtonElement>(`button[aria-label*="${CONFLICTS_DATABASE}"]`)!
  try {
    await act(async () =>
      root.render(
        <ConfirmProvider>
          <StorageSettingsSection />
        </ConfirmProvider>
      )
    )
    expect(host.querySelectorAll('li')).toHaveLength(2)
    expect(host.textContent).toContain('≈ 2.0 KB')
    expect(host.textContent).toContain('gitAgent.storageDatabaseCount {"count":2}')
    expect(host.querySelector('details, pre')).toBeNull()
    expect(removeOne().disabled).toBe(false)
    await act(async () => removeOne().click())
    expect(deleteBrowserDatabase).not.toHaveBeenCalled()
    await act(async () => button('common.cancel').click())
    expect(deleteBrowserDatabase).not.toHaveBeenCalled()
    await act(async () => removeOne().click())
    expect(document.body.textContent).toContain(`gitAgent.storageDeleteConfirm {"name":"${CONFLICTS_DATABASE}"}`)
    await act(async () => document.querySelector<HTMLButtonElement>('[data-modal-initial="confirm"]')!.click())
    expect(deleteBrowserDatabase).toHaveBeenCalledWith(CONFLICTS_DATABASE)
    expect(clearBrowserStorage).not.toHaveBeenCalled()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Database blocked')
    expect(removeOne().disabled).toBe(false)
    await act(async () => button('gitAgent.storageClear').click())
    expect(clearBrowserStorage).not.toHaveBeenCalled()
    await act(async () => button('common.cancel').click())
    expect(clearBrowserStorage).not.toHaveBeenCalled()
    await act(async () => button('gitAgent.storageClear').click())
    await act(async () => document.querySelector<HTMLButtonElement>('[data-modal-initial="confirm"]')!.click())
    expect(clearBrowserStorage).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    jest.clearAllMocks()
  }
})
