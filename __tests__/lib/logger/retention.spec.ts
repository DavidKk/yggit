import { clearAllLogs, createScopedLogger, getMemoryLogs, recordLog } from '@/lib/logger'
import { getLogRetentionPolicy, retainRecentEntries } from '@/lib/logger/retention'
import { createTraceId, getActiveTraceId, normalizeLegacyTraceId, runWithTrace } from '@/lib/logger/trace-context'

describe('log retention policy, filtering, and trace correlation', () => {
  afterEach(async () => {
    await clearAllLogs()
  })

  it('defines smaller retention caps and shorter TTL for edge mode than local mode', () => {
    const edge = getLogRetentionPolicy('edge')
    const local = getLogRetentionPolicy('local')

    expect(edge.maxLogs).toBe(500)
    expect(edge.logRetentionDays).toBe(7)
    expect(edge.maxTraces).toBe(100)
    expect(edge.traceRetentionDays).toBe(7)

    expect(local.maxLogs).toBe(2000)
    expect(local.logRetentionDays).toBe(30)
    expect(local.maxTraces).toBe(300)
    expect(local.traceRetentionDays).toBe(30)

    expect(local.maxLogs).toBeGreaterThan(edge.maxLogs)
    expect(local.maxLogAgeMs).toBeGreaterThan(edge.maxLogAgeMs)
  })

  it('drops expired entries and truncates newest-first to maxCount', () => {
    const now = 1_700_000_000_000
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000
    const entries = [
      { id: 'expired', timestamp: now - maxAgeMs - 1 },
      { id: 'oldest-valid', timestamp: now - 5_000 },
      { id: 'newest', timestamp: now - 100 },
      { id: 'middle', timestamp: now - 1_000 },
    ]

    const result = retainRecentEntries(entries, 2, maxAgeMs, now)
    expect(result.map((e) => e.id)).toEqual(['newest', 'middle'])
  })

  it('caps in-memory service logs recorded in edge mode', () => {
    const { maxLogs } = getLogRetentionPolicy('edge')
    for (let i = 0; i < maxLogs + 15; i += 1) {
      recordLog('info', 'system', `event-${i}`)
    }
    expect(getMemoryLogs()).toHaveLength(maxLogs)
  })

  it('assigns traceId automatically and preserves shared traceId across scoped child loggers', () => {
    const standalone = recordLog('info', 'git', 'standalone event')
    expect(standalone.traceId).toMatch(/^tr_[a-z0-9]+$/i)

    const scoped = createScopedLogger('agent')
    const first = scoped.info('Started agent task')
    const child = scoped.child('skill')
    const second = child.info('Matched skill')

    expect(first.traceId).toBe(scoped.traceId)
    expect(second.traceId).toBe(scoped.traceId)

    const customTrace = createTraceId()
    const nested = runWithTrace(customTrace, () => {
      expect(getActiveTraceId()).toBe(customTrace)
      return recordLog('warn', 'mcp', 'nested log')
    })
    expect(getActiveTraceId()).toBeUndefined()
    expect(nested.traceId).toBe(customTrace)

    expect(normalizeLegacyTraceId(undefined, 'trace_1700000000_ab12')).toBe('tr_00000000ab12')
    expect(normalizeLegacyTraceId('tr_existing1234', 'trace_1')).toBe('tr_existing1234')
  })
})
