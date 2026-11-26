/** @jest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { ConfirmProvider } from '@/components/confirm/ConfirmProvider'
import { MenuSettingsSection } from '@/components/git/agent/settings/MenuSettingsSection'
import { formatCompactCount, GitFindBox } from '@/components/git/GitFindBox'
import { LocaleProvider } from '@/components/i18n/LocaleProvider'
import { CONTEXT_MENU_STORAGE_KEY } from '@/lib/git/context-menu-config'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.clear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('formatCompactCount', () => {
  it('formats small and large numbers compactly', () => {
    expect(formatCompactCount(0)).toBe('0')
    expect(formatCompactCount(99)).toBe('99')
    expect(formatCompactCount(999)).toBe('999')
    expect(formatCompactCount(1000)).toBe('1K')
    expect(formatCompactCount(1234)).toBe('1.2K')
    expect(formatCompactCount(12900)).toBe('12.9K')
    expect(formatCompactCount(1500000)).toBe('1.5M')
    expect(formatCompactCount(2000000000)).toBe('2B')
  })
})

describe('GitFindBox component', () => {
  it('renders input and fires navigation events on keyboard shortcut', async () => {
    const onPrev = jest.fn()
    const onNext = jest.fn()
    const onClose = jest.fn()
    const onChange = jest.fn()

    await act(async () => {
      root.render(<GitFindBox value="master" current={1} total={18} onChange={onChange} onPrev={onPrev} onNext={onNext} onClose={onClose} size="medium" />)
    })

    const input = host.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.value).toBe('master')

    // Press Enter -> onNext
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onNext).toHaveBeenCalledTimes(1)

    // Press Shift+Enter -> onPrev
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }))
    })
    expect(onPrev).toHaveBeenCalledTimes(1)

    // Press Escape -> onClose
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders compact count when total is greater than 999', async () => {
    await act(async () => {
      root.render(<GitFindBox value="test" current={0} total={1500} onChange={jest.fn()} onClose={jest.fn()} />)
    })

    expect(host.textContent).toContain('1.5K 条')
  })
})

describe('MenuSettingsSection component', () => {
  it('renders all three setting zones and allows toggling quick actions', async () => {
    await act(async () => {
      root.render(
        <LocaleProvider initialLocale="zh" initialPreference="zh">
          <ConfirmProvider>
            <MenuSettingsSection />
          </ConfirmProvider>
        </LocaleProvider>
      )
    })

    // Zone 1: Quick Actions
    expect(host.textContent).toContain('Quick Actions (Pinned to Top)')
    expect(host.textContent).toContain('Copy Branch Name')
    expect(host.textContent).toContain('Copy Commit Hash')

    // Zone 2: Grouped Submenus
    expect(host.textContent).toContain('Grouped Submenus')
    expect(host.textContent).toContain('"Copy ›" Submenu')
    expect(host.textContent).toContain('"Branch Actions ›" Submenu')
    expect(host.textContent).toContain('"Worktree ›" Submenu')
    expect(host.textContent).toContain('"Open in Remote ›" Submenu')

    // Zone 3: Safety & Adaptive Filtering
    expect(host.textContent).toContain('Safety & Adaptive Filtering')
    expect(host.textContent).toContain('Two-Step Confirmation for Destructive Actions')
    expect(host.textContent).toContain('Adaptive Repository Capability Filtering')

    // Zone 4: Agent 扩展
    expect(host.textContent).toContain('Agent 智能菜单扩展')
    expect(host.textContent).toContain('AI 审查分支改动')
  })
})

it('requires confirmation for deleting a menu action from the list', async () => {
  await act(async () =>
    root.render(
      <LocaleProvider initialLocale="zh" initialPreference="zh">
        <ConfirmProvider>
          <MenuSettingsSection />
        </ConfirmProvider>
      </LocaleProvider>
    )
  )
  const title = 'AI 审查分支改动'
  const deleteButton = () =>
    [...host.querySelectorAll('button')].find((item) => item.getAttribute('aria-label')?.includes(title) && item.querySelector('svg') && !item.hasAttribute('role'))!
  const readActions = () => JSON.parse(localStorage.getItem(CONTEXT_MENU_STORAGE_KEY)!).agentActions
  await act(async () => deleteButton().click())
  expect(host.textContent).toContain(title)
  const cancel = [...document.body.querySelectorAll('button')].find((item) => item.textContent?.trim() === '取消')!
  await act(async () => cancel.click())
  expect(host.textContent).toContain(title)
  await act(async () => deleteButton().click())
  await act(async () => document.querySelector<HTMLButtonElement>('[data-modal-initial="confirm"]')!.click())
  expect(readActions().some((item: { label: string }) => item.label === title)).toBe(false)
  expect([...host.querySelectorAll('li a')].some((item) => item.textContent?.includes(title))).toBe(false)
})
