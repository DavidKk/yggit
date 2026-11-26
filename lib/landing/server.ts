import { cookies } from 'next/headers'

import { isLandingScene, LANDING_SCENE_COOKIE_KEY, type LandingScene } from '@/lib/landing/scene'

/** Read the landing scene cookie on the server so SSR matches the browser's saved preference. */
export async function resolveLandingScene(): Promise<LandingScene> {
  const store = await cookies()
  const value = store.get(LANDING_SCENE_COOKIE_KEY)?.value
  return isLandingScene(value) ? value : 'night'
}
