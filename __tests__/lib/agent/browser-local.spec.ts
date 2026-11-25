import { clearLocalModelCache, getLocalModelSpec, inspectLocalModelCache, LOCAL_BROWSER_MODELS } from '@/lib/agent/local-models'
import { AGENT_PRESETS } from '@/lib/agent/types'

describe('Browser Local AI & Kilo Free presets', () => {
  const originalCaches = globalThis.caches

  afterEach(() => {
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      configurable: true,
      writable: true,
    })
  })

  it('registers browser-local and kilo-free presets with expected defaults', () => {
    expect(AGENT_PRESETS['browser-local']).toMatchObject({
      provider: 'browser-local',
      defaultModel: 'qwen3.5-0.8b-q4',
      requiresKey: false,
      isLocal: true,
    })
    expect(AGENT_PRESETS['kilo-free']).toMatchObject({
      provider: 'kilo-free',
      baseUrl: 'https://ai-gateway.kilo.ai/api/v1',
      defaultModel: 'kilo-auto/free',
      requiresKey: false,
      noZdrNotice: true,
    })
  })

  it('includes Qwen3.5 0.8B Q4 as the default recommended model and LFM2.5 350M as lightweight alternative', () => {
    expect(LOCAL_BROWSER_MODELS[0]).toMatchObject({
      id: 'qwen3.5-0.8b-q4',
      recommended: true,
      pipelineTask: 'qwen35',
    })
    expect(LOCAL_BROWSER_MODELS[1]).toMatchObject({
      id: 'lfm2.5-350m-q4',
      pipelineTask: 'text-generation',
    })
    expect(getLocalModelSpec('unknown-id').id).toBe('qwen3.5-0.8b-q4')
    expect(getLocalModelSpec('lfm2.5-350m-q4').id).toBe('lfm2.5-350m-q4')
  })

  it('inspects and clears current-origin CacheStorage entries accurately', async () => {
    const entries = new Map<string, { size: number }>([
      ['https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX-OPT/resolve/main/model_q4.onnx', { size: 1024 }],
      ['https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX-OPT/resolve/main/tokenizer.json', { size: 512 }],
      ['https://huggingface.co/onnx-community/LFM2.5-350M-ONNX/resolve/main/model_q4.onnx', { size: 256 }],
    ])

    const deleteSpy = jest.fn(async (req: { url: string }) => entries.delete(req.url))

    Object.defineProperty(globalThis, 'caches', {
      value: {
        open: jest.fn(async () => ({
          keys: async () => Array.from(entries.keys()).map((url) => ({ url })),
          match: async (req: { url: string }) => {
            const item = entries.get(req.url)
            return item ? { headers: { get: (name: string) => (name.toLowerCase() === 'content-length' ? String(item.size) : null) } } : undefined
          },
          delete: deleteSpy,
        })),
      },
      configurable: true,
      writable: true,
    })

    const qwenInfo = await inspectLocalModelCache('onnx-community/Qwen3.5-0.8B-ONNX-OPT')
    expect(qwenInfo).toEqual({ supported: true, fileCount: 2, bytes: 1536 })

    const clearedAll = await clearLocalModelCache()
    expect(clearedAll).toBe(3)
    expect(deleteSpy).toHaveBeenCalledTimes(3)

    const afterClear = await inspectLocalModelCache()
    expect(afterClear).toEqual({ supported: true, fileCount: 0, bytes: 0 })
  })
})
