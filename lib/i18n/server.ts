import { cookies, headers } from 'next/headers'

import { isLocale, type Locale, LOCALE_COOKIE_KEY, localeFromAcceptLanguage, type LocalePreference } from '@/lib/i18n/locales'

/** Resolve the request locale from a public locale subpath, explicit cookie, then Accept-Language. */
export async function resolveRequestLocale(): Promise<{ locale: Locale; preference: LocalePreference }> {
  const requestHeaders = await headers()
  const pathname = requestHeaders.get('x-yggit-pathname') || ''
  if (pathname === '/') {
    return { locale: 'en', preference: 'en' }
  }
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  if (firstSegment && pathname === `/${firstSegment}` && isLocale(firstSegment)) {
    return { locale: firstSegment, preference: firstSegment }
  }

  const fromCookie = (await cookies()).get(LOCALE_COOKIE_KEY)?.value
  if (isLocale(fromCookie)) return { locale: fromCookie, preference: fromCookie }
  return { locale: localeFromAcceptLanguage(requestHeaders.get('accept-language')), preference: 'auto' }
}
