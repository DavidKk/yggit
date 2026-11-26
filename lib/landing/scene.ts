export type LandingScene = 'day' | 'night'

export const LANDING_SCENE_STORAGE_KEY = 'yggit.landing.timePreset'
export const LANDING_SCENE_COOKIE_KEY = 'yggit_landing_scene'
const LANDING_SCENE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isLandingScene(value: unknown): value is LandingScene {
  return value === 'day' || value === 'night'
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  try {
    const parts = document.cookie.split(';')
    for (const raw of parts) {
      const part = raw.trim()
      if (part.startsWith(`${name}=`)) {
        return part.slice(name.length + 1)
      }
    }
  } catch {
    // Ignore cookie read failures
  }
  return null
}

/** Resolve the preferred landing scene in the browser from cookie, localStorage, or local clock. */
export function resolveBrowserLandingScene(): LandingScene {
  if (typeof window === 'undefined') return 'night'

  const fromCookie = readCookie(LANDING_SCENE_COOKIE_KEY)
  if (isLandingScene(fromCookie)) return fromCookie

  try {
    const saved = window.localStorage.getItem(LANDING_SCENE_STORAGE_KEY)
    if (isLandingScene(saved)) return saved
  } catch {
    // Ignore localStorage access errors
  }

  const hour = new Date().getHours()
  if (hour >= 6 && hour < 18) {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'night'
    }
    return 'day'
  }
  return 'night'
}

/** Persist the landing scene to both localStorage and cookie so SSR matches the next visit. */
export function writeLandingScene(scene: LandingScene): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LANDING_SCENE_STORAGE_KEY, scene)
  } catch {
    // Ignore localStorage write errors
  }
  try {
    document.cookie = `${LANDING_SCENE_COOKIE_KEY}=${scene};path=/;max-age=${LANDING_SCENE_COOKIE_MAX_AGE};samesite=lax`
  } catch {
    // Ignore cookie write errors
  }
}
