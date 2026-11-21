import { clearAllLogs, generateIssueReportMarkdown, getMemoryLogs, logError, logInfo, logWarn, subscribeLogs } from '@/lib/logger'

describe('Service Diagnostics Logger', () => {
  beforeEach(async () => {
    await clearAllLogs()
  })

  it('records logs and notifies subscribers', () => {
    const subscriber = jest.fn()
    const unsubscribe = subscribeLogs(subscriber)

    logInfo('agent', 'Agent started diagnostic run')
    logWarn('mcp', 'MCP server slow response', { latencyMs: 3200 })
    logError('git', 'Failed to resolve ref', new Error('fatal: ambiguous argument'))

    expect(subscriber).toHaveBeenCalledTimes(3)
    const logs = getMemoryLogs()
    expect(logs).toHaveLength(3)
    expect(logs[0].level).toBe('error')
    expect(logs[0].module).toBe('git')
    expect(logs[0].details).toContain('ambiguous argument')

    unsubscribe()
  })

  it('generates a sanitized GitHub issue report markdown', () => {
    logError('agent', 'Unexpected model timeout', { code: 504 })
    const logs = getMemoryLogs()
    const md = generateIssueReportMarkdown(logs)

    expect(md).toContain('### 🐛 Problem Description')
    expect(md).toContain('### 🖥️ Environment Info')
    expect(md).toContain('### 📋 Diagnostic Logs')
    expect(md).toContain('Unexpected model timeout')
  })
})
