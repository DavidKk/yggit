export type ThemeMode = 'light' | 'dark'
export type ThemePreference = ThemeMode | 'auto'

export const THEMES: ThemeMode[] = ['light', 'dark']

export const THEME_STORAGE_KEY = 'yggit.themePref'
export const THEME_COOKIE_KEY = THEME_STORAGE_KEY
export const THEME_RESOLVED_COOKIE_KEY = 'yggit.themeMode'
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'auto' || isThemeMode(value)
}

export function detectSystemTheme(fallback: ThemeMode = 'dark'): ThemeMode {
  if (typeof window === 'undefined') return fallback
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return fallback
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
    const cookie = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${THEME_COOKIE_KEY}=`))
    const value = cookie?.slice(THEME_COOKIE_KEY.length + 1)
    if (isThemePreference(value)) return value
  } catch {
    // Storage may still be available when cookies are blocked.
  }
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(raw) ? raw : null
  } catch {
    return null
  }
}

function setCookie(key: string, value: string) {
  if (typeof document === 'undefined') return
  try {
    document.cookie = `${key}=${encodeURIComponent(value)};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`
  } catch {
    // Theme changes must work even when persistence is blocked.
  }
}

export function writeResolvedTheme(theme: ThemeMode) {
  setCookie(THEME_RESOLVED_COOKIE_KEY, theme)
}

/** Persist auto explicitly so an older localStorage value cannot override it. */
export function writeStoredTheme(preference: ThemePreference) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Cookies can still persist the preference when localStorage is blocked.
  }
  setCookie(THEME_COOKIE_KEY, preference)
}

/** Resolve before paint; use the same cookie-first order as client hydration. */
export const THEME_BOOT_SCRIPT = `(function(){
var el=document.documentElement,k=${JSON.stringify(THEME_STORAGE_KEY)},c=${JSON.stringify(THEME_COOKIE_KEY)},r=${JSON.stringify(THEME_RESOLVED_COOKIE_KEY)},age=${THEME_COOKIE_MAX_AGE};
function valid(p){return p==='light'||p==='dark'||p==='auto';}
var pref=null;
try{var parts=document.cookie.split(';');for(var i=0;i<parts.length;i++){var part=parts[i].trim();if(part.indexOf(c+'=')===0){var value=part.slice(c.length+1);if(valid(value))pref=value;}}}catch(e){}
if(!pref){try{var stored=localStorage.getItem(k);if(valid(stored))pref=stored;}catch(e){}}
pref=pref||'auto';
var t=el.getAttribute('data-theme')==='light'?'light':'dark';
if(pref!=='auto')t=pref;
else{try{t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch(e){}}
el.setAttribute('data-theme',t);el.style.colorScheme=t;
try{document.cookie=c+'='+pref+';path=/;max-age='+age+';samesite=lax';document.cookie=r+'='+t+';path=/;max-age='+age+';samesite=lax';}catch(e){}
})();`
