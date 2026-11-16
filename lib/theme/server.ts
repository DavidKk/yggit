import { cookies } from 'next/headers'

import { isThemeMode, isThemePreference, THEME_COOKIE_KEY, THEME_RESOLVED_COOKIE_KEY, type ThemeMode, type ThemePreference } from '@/lib/theme'

/** Auto uses the last browser-resolved mode until the pre-paint script checks the OS. */
export async function resolveRequestTheme(): Promise<{ theme: ThemeMode; preference: ThemePreference }> {
  const store = await cookies()
  const fromCookie = store.get(THEME_COOKIE_KEY)?.value
  const preference = isThemePreference(fromCookie) ? fromCookie : 'auto'
  if (isThemeMode(preference)) return { theme: preference, preference }
  const resolved = store.get(THEME_RESOLVED_COOKIE_KEY)?.value
  return { theme: isThemeMode(resolved) ? resolved : 'dark', preference }
}
