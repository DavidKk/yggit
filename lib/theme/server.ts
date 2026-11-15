import { cookies } from 'next/headers'

import { isThemeMode, THEME_COOKIE_KEY, type ThemeMode, type ThemePreference } from '@/lib/theme'

/** Resolve theme preference from cookie; default `auto` (follow system on client / dark on SSR). */
export async function resolveRequestTheme(): Promise<{ theme: ThemeMode; preference: ThemePreference }> {
  const fromCookie = (await cookies()).get(THEME_COOKIE_KEY)?.value
  if (isThemeMode(fromCookie)) return { theme: fromCookie, preference: fromCookie }
  // SSR has no reliable system preference; dark matches historic default until client boot/hydration.
  return { theme: 'dark', preference: 'auto' }
}
