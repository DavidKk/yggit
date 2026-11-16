import { cookies } from 'next/headers'

import { THEME_COOKIE_KEY, THEME_RESOLVED_COOKIE_KEY } from '@/lib/theme'
import { resolveRequestTheme } from '@/lib/theme/server'

jest.mock('next/headers', () => ({ cookies: jest.fn() }))

it.each([
  ['light', 'dark', 'light', 'light'],
  ['dark', 'light', 'dark', 'dark'],
  ['auto', 'light', 'light', 'auto'],
  [undefined, undefined, 'dark', 'auto'],
  ['invalid', 'invalid', 'dark', 'auto'],
])('resolves request preference %s and last mode %s', async (preference, resolved, theme, expectedPreference) => {
  const values: Record<string, string | undefined> = { [THEME_COOKIE_KEY]: preference, [THEME_RESOLVED_COOKIE_KEY]: resolved }
  jest.mocked(cookies).mockResolvedValue({ get: (key: string) => ({ value: values[key] }) } as Awaited<ReturnType<typeof cookies>>)
  await expect(resolveRequestTheme()).resolves.toEqual({ theme, preference: expectedPreference })
})
