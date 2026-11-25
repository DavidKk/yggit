import { ensureBrowserAiSession, getBrowserAiAvailability, runBrowserAiCompletion } from '@/lib/agent/browser-ai'
import { RedactionEngine } from '@/lib/agent/redact/engine'
import { useBrowserDownloads } from '@/lib/downloads/browser-downloads'

describe('browser-ai', () => {
  const originalLanguageModel = (globalThis as { LanguageModel?: unknown }).LanguageModel

  afterEach(() => {
    if (originalLanguageModel === undefined) {
      delete (globalThis as { LanguageModel?: unknown }).LanguageModel
    } else {
      ;(globalThis as { LanguageModel?: unknown }).LanguageModel = originalLanguageModel
    }
  })

  it('reports unsupported when LanguageModel API is absent', async () => {
    delete (globalThis as { LanguageModel?: unknown }).LanguageModel
    await expect(getBrowserAiAvailability()).resolves.toEqual({ status: 'unsupported' })
  })

  it('skips download progress UI when shared browser model is already available', async () => {
    const createMock = jest.fn().mockResolvedValue({
      prompt: jest.fn().mockResolvedValue('hello'),
      destroy: jest.fn(),
    })
    ;(globalThis as { LanguageModel?: unknown }).LanguageModel = {
      availability: jest.fn().mockResolvedValue('available'),
      create: createMock,
    }

    const status = await getBrowserAiAvailability()
    expect(status).toEqual({ status: 'available' })

    const session = await ensureBrowserAiSession()
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock.mock.calls[0][0].monitor).toBeUndefined()
    session.destroy?.()
  })

  it('tracks downloadprogress and preparing phase when model is downloadable', async () => {
    const statuses: Array<{ status: string; percent?: number }> = []
    let triggerProgress: ((e: { loaded: number }) => void) | null = null

    ;(globalThis as { LanguageModel?: unknown }).LanguageModel = {
      availability: jest.fn().mockResolvedValue('downloadable'),
      create: jest.fn().mockImplementation(async (opts?: { monitor?: (m: { addEventListener: (t: string, cb: (e: { loaded: number }) => void) => void }) => void }) => {
        opts?.monitor?.({
          addEventListener: (_type, cb) => {
            triggerProgress = cb
          },
        })
        triggerProgress?.({ loaded: 0.45 })
        triggerProgress?.({ loaded: 1 })
        return {
          prompt: jest.fn().mockResolvedValue('ok'),
          destroy: jest.fn(),
        }
      }),
    }

    const session = await ensureBrowserAiSession({
      onStatusChange: (s, p) => statuses.push({ status: s, percent: p }),
    })
    expect(statuses).toEqual([
      { status: 'downloading', percent: 0 },
      { status: 'downloading', percent: 45 },
      { status: 'preparing', percent: 100 },
      { status: 'available', percent: 100 },
    ])
    expect(typeof useBrowserDownloads).toBe('function')
    session.destroy?.()
  })

  it('streams completion and unmasks redacted placeholders', async () => {
    const engine = new RedactionEngine({
      enabled: true,
      categories: { secrets: false, pii: true, network: false, custom: false },
      customWords: [],
      allowList: [],
    })
    const { sanitizedText } = engine.mask('user@example.com')

    ;(globalThis as { LanguageModel?: unknown }).LanguageModel = {
      availability: jest.fn().mockResolvedValue('available'),
      create: jest.fn().mockResolvedValue({
        promptStreaming: async function* () {
          yield 'Hello '
          yield `Hello ${sanitizedText}`
        },
        destroy: jest.fn(),
      }),
    }

    const deltas: string[] = []
    const res = await runBrowserAiCompletion({
      messages: [{ role: 'user', content: sanitizedText }],
      redactionEngine: engine,
      onDelta: (d) => deltas.push(d),
    })

    expect(res.content).toBe('Hello user@example.com')
    expect(deltas.join('')).toBe('Hello user@example.com')
  })
})
