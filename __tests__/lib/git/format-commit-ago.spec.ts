import { formatCommitAgo, formatCommitDateDivider } from '@/lib/git/format-commit-ago'

describe('formatCommitAgo & formatCommitDateDivider', () => {
  it('formats relative commit time for single commits', () => {
    const now = new Date()
    const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    expect(formatCommitAgo(tenMinsAgo, 'zh')).toBe('10分钟前')
    expect(formatCommitAgo(tenMinsAgo, 'en')).toBe('10 minutes ago')
  })

  it('correctly calculates calendar day difference for date boundary dividers without duplicates', () => {
    // Simulated "now" is Nov 16, 2026, 11:00 AM
    const now = new Date('2026-11-16T11:00:00+08:00')

    // Commit 1: Nov 15 14:27 (yesterday)
    const nov15 = formatCommitDateDivider('2026-11-15T14:27:28+08:00', 'zh', now)
    expect(nov15).toBe('昨天')

    // Commit 2: Nov 14 00:49 (day before yesterday / 前天)
    const nov14 = formatCommitDateDivider('2026-11-14T00:49:41+08:00', 'zh', now)
    expect(nov14).toBe('前天')

    // Commit 3: Nov 13 23:55 (3 days ago / 3天前, only 54 mins after Nov 14 commit!)
    const nov13 = formatCommitDateDivider('2026-11-13T23:55:21+08:00', 'zh', now)
    expect(nov13).toBe('3天前')

    // Commit 4: Nov 12 20:20 (4 days ago / 4天前)
    const nov12 = formatCommitDateDivider('2026-11-12T20:20:50+08:00', 'zh', now)
    expect(nov12).toBe('4天前')

    // Guarantees that Nov 14 and Nov 13 produce distinct dividers ("前天" vs "3天前"), never repeating "前天"
    expect(nov14).not.toBe(nov13)
  })

  it('supports English locale for date dividers', () => {
    const now = new Date('2026-11-16T11:00:00+08:00')
    expect(formatCommitDateDivider('2026-11-16T08:00:00+08:00', 'en', now)).toBe('today')
    expect(formatCommitDateDivider('2026-11-15T14:00:00+08:00', 'en', now)).toBe('yesterday')
    expect(formatCommitDateDivider('2026-11-14T01:00:00+08:00', 'en', now)).toBe('2 days ago')
    expect(formatCommitDateDivider('2026-11-13T23:00:00+08:00', 'en', now)).toBe('3 days ago')
  })
})
