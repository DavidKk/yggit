export interface LocalBrowserModelSpec {
  id: string
  name: string
  repository: string
  revision: string
  dtype: string | Record<string, string>
  estimatedBytes: number
  recommended?: boolean
  pipelineTask: 'qwen35' | 'text-generation'
}

export const TRANSFORMERS_CACHE_NAME = 'transformers-cache'

export const LOCAL_BROWSER_MODELS: LocalBrowserModelSpec[] = [
  {
    id: 'qwen3.5-0.8b-q4',
    name: 'Qwen3.5 0.8B (Q4 · ~635MB, 推荐)',
    repository: 'onnx-community/Qwen3.5-0.8B-ONNX-OPT',
    revision: 'main',
    dtype: {
      embed_tokens: 'q4',
      decoder_model_merged: 'q4',
      vision_encoder: 'q4',
    },
    estimatedBytes: 665_845_760,
    recommended: true,
    pipelineTask: 'qwen35',
  },
  {
    id: 'lfm2.5-350m-q4',
    name: 'LFM2.5 350M (Q4 · ~283MB)',
    repository: 'onnx-community/LFM2.5-350M-ONNX',
    revision: 'main',
    dtype: 'q4',
    estimatedBytes: 296_747_008,
    pipelineTask: 'text-generation',
  },
]

export function getLocalModelSpec(modelId?: string): LocalBrowserModelSpec {
  return LOCAL_BROWSER_MODELS.find((m) => m.id === modelId) || LOCAL_BROWSER_MODELS[0]
}

export interface LocalModelCacheInfo {
  supported: boolean
  fileCount: number
  bytes: number
}

/**
 * Inspects current-origin CacheStorage (`transformers-cache`) for cached Hugging Face model files.
 */
export async function inspectLocalModelCache(repository?: string): Promise<LocalModelCacheInfo> {
  if (typeof globalThis === 'undefined' || typeof globalThis.caches === 'undefined') {
    return { supported: false, fileCount: 0, bytes: 0 }
  }
  try {
    const cache = await globalThis.caches.open(TRANSFORMERS_CACHE_NAME)
    const keys = await cache.keys()
    const matching = repository ? keys.filter((req) => req.url.includes(`/${repository}/`)) : keys

    let bytes = 0
    for (const req of matching) {
      const res = await cache.match(req)
      const len = res?.headers.get('content-length')
      if (len) {
        const parsed = Number.parseInt(len, 10)
        if (Number.isFinite(parsed) && parsed > 0) bytes += parsed
      }
    }
    return { supported: true, fileCount: matching.length, bytes }
  } catch {
    return { supported: false, fileCount: 0, bytes: 0 }
  }
}

/**
 * Clears cached model files from current-origin CacheStorage (`transformers-cache`).
 * When `repository` is omitted, clears all cached Transformers.js model weights for this origin.
 */
export async function clearLocalModelCache(repository?: string): Promise<number> {
  if (typeof globalThis === 'undefined' || typeof globalThis.caches === 'undefined') {
    return 0
  }
  try {
    const cache = await globalThis.caches.open(TRANSFORMERS_CACHE_NAME)
    const keys = await cache.keys()
    const targets = repository ? keys.filter((req) => req.url.includes(`/${repository}/`)) : keys
    let removed = 0
    for (const req of targets) {
      if (await cache.delete(req)) removed += 1
    }
    return removed
  } catch {
    return 0
  }
}
