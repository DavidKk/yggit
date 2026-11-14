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
