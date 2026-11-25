import { formatCommitAgo, formatCommitDateDivider } from '@/lib/git/format-commit-ago'

describe('formatCommitAgo & formatCommitDateDivider', () => {
  it('formats relative commit time for single commits', () => {
    const now = new Date()
    const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    expect(formatCommitAgo(tenMinsAgo, 'zh')).toBe('10分钟前')
    expect(formatCommitAgo(tenMinsAgo, 'en')).toBe('10 minutes ago')
  })

  it('correctly calculates calendar day difference for date boundary dividers without duplicates', () => {
    // Simulated "now" is Nov 16, 2026, 11:00 AM (in local timezone)
    const now = new Date(2026, 10, 16, 11, 0, 0)

    // Commit 1: Nov 15 14:27 (yesterday)
    const nov15 = formatCommitDateDivider(new Date(2026, 10, 15, 14, 27, 28).toISOString(), 'zh', now)
    expect(nov15).toBe('昨天')

    // Commit 2: Nov 14 00:49 (day before yesterday / 前天)
    const nov14 = formatCommitDateDivider(new Date(2026, 10, 14, 0, 49, 41).toISOString(), 'zh', now)
    expect(nov14).toBe('前天')

    // Commit 3: Nov 13 23:55 (3 days ago / 3天前, only 54 mins after Nov 14 commit!)
    const nov13 = formatCommitDateDivider(new Date(2026, 10, 13, 23, 55, 21).toISOString(), 'zh', now)
    expect(nov13).toBe('3天前')

    // Commit 4: Nov 12 20:20 (4 days ago / 4天前)
    const nov12 = formatCommitDateDivider(new Date(2026, 10, 12, 20, 20, 50).toISOString(), 'zh', now)
    expect(nov12).toBe('4天前')

    // Guarantees that Nov 14 and Nov 13 produce distinct dividers ("前天" vs "3天前"), never repeating "前天"
    expect(nov14).not.toBe(nov13)
  })

  it('supports English locale for date dividers', () => {
    const now = new Date(2026, 10, 16, 11, 0, 0)
    expect(formatCommitDateDivider(new Date(2026, 10, 16, 8, 0, 0).toISOString(), 'en', now)).toBe('today')
    expect(formatCommitDateDivider(new Date(2026, 10, 15, 14, 0, 0).toISOString(), 'en', now)).toBe('yesterday')
    expect(formatCommitDateDivider(new Date(2026, 10, 14, 1, 0, 0).toISOString(), 'en', now)).toBe('2 days ago')
    expect(formatCommitDateDivider(new Date(2026, 10, 13, 23, 0, 0).toISOString(), 'en', now)).toBe('3 days ago')
  })
})
