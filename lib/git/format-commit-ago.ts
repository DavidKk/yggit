import { type Locale, LOCALE_HTML_LANG } from '@/lib/i18n/locales'

export function formatCommitAgo(iso: string, locale: Locale): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso.slice(0, 10)
  const rtf = new Intl.RelativeTimeFormat(LOCALE_HTML_LANG[locale], { numeric: 'auto' })
  const minutes = Math.round((Date.now() - then) / 60000)
  if (minutes < 1) return rtf.format(0, 'second')
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (days < 30) return rtf.format(-days, 'day')
  const months = Math.round(days / 30)
  if (months < 12) return rtf.format(-months, 'month')
  const years = Math.round(months / 12)
  return rtf.format(-years, 'year')
}

/**
 * Format date divider badge between different calendar dates.
 * Uses calendar day boundaries (midnight to midnight) rather than raw hours elapsed,
 * preventing duplicate labels like "前天" appearing on consecutive calendar days.
 */
export function formatCommitDateDivider(iso: string, locale: Locale, now = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return iso.slice(0, 10)

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const thenDayStart = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()
  const dayDiff = Math.round((todayStart - thenDayStart) / (24 * 60 * 60 * 1000))

  const rtf = new Intl.RelativeTimeFormat(LOCALE_HTML_LANG[locale], { numeric: 'auto' })

  if (dayDiff <= 0) return rtf.format(0, 'day')
  if (dayDiff < 30) return rtf.format(-dayDiff, 'day')

  const months = Math.round(dayDiff / 30)
  if (months < 12) return rtf.format(-months, 'month')
  const years = Math.round(months / 12)
  return rtf.format(-years, 'year')
}
