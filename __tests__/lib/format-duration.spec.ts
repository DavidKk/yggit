import { formatDuration } from '@/lib/format-duration'

describe('formatDuration', () => {
  it('scales cleanly across ms, s, m, and h units', () => {
    expect(formatDuration(0)).toBe('0ms')
    expect(formatDuration(153)).toBe('153ms')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(25483)).toBe('25.48s')
    expect(formatDuration(60_000)).toBe('1m')
    expect(formatDuration(125_400)).toBe('2m 5s')
    expect(formatDuration(3_600_000)).toBe('1h')
    expect(formatDuration(3_912_000)).toBe('1h 5m 12s')
  })
})
