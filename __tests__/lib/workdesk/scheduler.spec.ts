import { beginForegroundWork, isForegroundBusy, runWithForegroundPriority, subscribeForegroundPause, waitForIdleWindow } from '@/lib/workdesk/scheduler'

describe('workdesk foreground-priority scheduler', () => {
  it('tracks active foreground work and notifies pause listeners', async () => {
    const onPause = jest.fn()
    const unsubscribe = subscribeForegroundPause(onPause)

    const release = beginForegroundWork()
    expect(onPause).toHaveBeenCalledTimes(1)
    expect(isForegroundBusy(0)).toBe(true)

    release()
    // Active count is zero immediately; cooldown check with 0ms reports idle
    expect(isForegroundBusy(0)).toBe(false)

    const ready = await waitForIdleWindow(undefined, 0)
    expect(ready).toBe(true)

    unsubscribe()
  })

  it('returns false when aborted while waiting for idle window', async () => {
    const release = beginForegroundWork()
    const controller = new AbortController()
    const pending = waitForIdleWindow(controller.signal, 5000)
    controller.abort()
    await expect(pending).resolves.toBe(false)
    release()
  })

  it('releases slot even if wrapped foreground work rejects', async () => {
    await expect(
      runWithForegroundPriority(async () => {
        expect(isForegroundBusy(0)).toBe(true)
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    expect(isForegroundBusy(0)).toBe(false)
  })
})
