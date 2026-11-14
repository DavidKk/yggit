export type ThemeMode = 'light' | 'dark'
export type ThemePreference = ThemeMode | 'auto'

export const THEMES: ThemeMode[] = ['light', 'dark']

export const THEME_STORAGE_KEY = 'yggit.themePref'
export const THEME_COOKIE_KEY = THEME_STORAGE_KEY
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'auto' || isThemeMode(value)
}

export function detectSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'dark'
  }
}

export function themeForPreference(preference: ThemePreference, systemTheme: ThemeMode): ThemeMode {
  return preference === 'auto' ? systemTheme : preference
}

export function applyDocumentTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
}

export function readStoredTheme(): ThemePreference | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(raw) ? raw : null
  } catch {
    return null
  }
}

function setCookie(key: string, value: string, maxAge: number) {
  if (typeof document === 'undefined') return
  document.cookie = `${key}=${encodeURIComponent(value)};path=/;max-age=${maxAge};samesite=lax`
}

/** `auto` 清除存储，回到跟随系统 */
export function writeStoredTheme(preference: ThemePreference) {
  if (typeof window === 'undefined') return
  try {
    if (preference === 'auto') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* ignore quota / private mode */
  }
  setCookie(THEME_COOKIE_KEY, preference === 'auto' ? '' : preference, preference === 'auto' ? 0 : THEME_COOKIE_MAX_AGE)
}

/** Inline boot: set data-theme before paint to avoid FOUC. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var p=localStorage.getItem(k);var pref=p==='light'||p==='dark'?p:'auto';var dark=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=pref==='auto'?(dark?'dark':'light'):pref;var el=document.documentElement;el.setAttribute('data-theme',t);el.style.colorScheme=t;}catch(e){try{document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.colorScheme='dark';}catch(_){}}})();`
