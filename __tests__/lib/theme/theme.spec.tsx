/** @jest-environment jsdom */
import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

import { ThemeProvider, useTheme } from '@/components/theme/ThemeProvider'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { readStoredTheme, THEME_BOOT_SCRIPT, THEME_COOKIE_KEY, THEME_RESOLVED_COOKIE_KEY, THEME_STORAGE_KEY, writeStoredTheme } from '@/lib/theme'

function ThemeProbe() {
  const { theme, preference } = useTheme()
  return <span>{`${preference}:${theme}`}</span>
}

let root: Root | undefined
let systemDark = false
let change: (() => void) | undefined

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  window.localStorage.clear()
  for (const key of [THEME_COOKIE_KEY, THEME_RESOLVED_COOKIE_KEY]) document.cookie = `${key}=;path=/;max-age=0`
  document.documentElement.setAttribute('data-theme', 'dark')
  document.body.innerHTML = ''
  systemDark = false
  change = undefined
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn(() => ({
      get matches() {
        return systemDark
      },
      addEventListener: (_: string, callback: () => void) => {
        change = callback
      },
      removeEventListener: jest.fn(),
    })),
  })
})

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  root = undefined
})

function boot() {
  window.eval(THEME_BOOT_SCRIPT)
}

it.each(['light', 'dark', 'auto'] as const)('renders a visible %s theme switcher in the SSR snapshot', (preference) => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(
    <ThemeProvider initialTheme="light" initialPreference={preference}>
      <ThemeSwitcher />
    </ThemeProvider>
  )
  const trigger = container.querySelector('button')
  expect(trigger).not.toBeNull()
  expect(trigger?.textContent?.trim()).toBe(preference === 'auto' ? 'System' : preference === 'light' ? 'Light' : 'Dark')
  expect(trigger?.closest('.invisible, [hidden]')).toBeNull()
})

it('keeps explicit light on reload even with a dark OS and blocked localStorage', () => {
  systemDark = true
  writeStoredTheme('light')
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  boot()
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(readStoredTheme()).toBe('light')
})

it('migrates a legacy localStorage-only preference to the SSR cookie', () => {
  systemDark = true
  window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
  boot()
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(document.cookie).toContain(`${THEME_COOKIE_KEY}=light`)
  expect(document.cookie).toContain(`${THEME_RESOLVED_COOKIE_KEY}=light`)
})

it('uses cookie auto over stale localStorage and records the current system mode', () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
  document.cookie = `${THEME_COOKIE_KEY}=auto;path=/`
  boot()
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(readStoredTheme()).toBe('auto')
  expect(document.cookie).toContain(`${THEME_RESOLVED_COOKIE_KEY}=light`)
})

it('does not replace a known light theme with dark when browser APIs fail', () => {
  document.documentElement.dataset.theme = 'light'
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  window.matchMedia = () => {
    throw new Error('unavailable')
  }
  boot()
  expect(document.documentElement.dataset.theme).toBe('light')
})

it.each(['auto', 'light'] as const)('hydrates %s with the SSR snapshot and never overwrites the pre-paint light theme', async (preference) => {
  if (preference === 'light') window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
  const app = (
    <ThemeProvider initialTheme="dark" initialPreference="auto">
      <ThemeProbe />
    </ThemeProvider>
  )
  const container = document.createElement('div')
  container.innerHTML = renderToString(app)
  document.body.append(container)
  boot()
  const setAttribute = jest.spyOn(document.documentElement, 'setAttribute')
  const onRecoverableError = jest.fn()
  await act(async () => {
    root = hydrateRoot(container, app, { onRecoverableError })
  })
  expect(onRecoverableError).not.toHaveBeenCalled()
  expect(container.textContent).toBe(`${preference}:light`)
  expect(setAttribute.mock.calls.filter(([key]) => key === 'data-theme').map(([, value]) => value)).not.toContain('dark')
  expect(document.documentElement.dataset.theme).toBe('light')
  await act(async () => {
    systemDark = true
    change?.()
  })
  expect(document.documentElement.dataset.theme).toBe(preference === 'auto' ? 'dark' : 'light')
})
