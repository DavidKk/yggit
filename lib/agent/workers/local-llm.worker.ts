import { AutoProcessor, pipeline, Qwen3_5ForConditionalGeneration, TextStreamer } from '@huggingface/transformers'

import { getLocalModelSpec, type LocalBrowserModelSpec } from '../local-models'

type WorkerInMessage =
  | { type: 'load'; requestId: string; modelId: string }
  | { type: 'generate'; requestId: string; modelId: string; messages: Array<{ role: string; content: string }>; maxNewTokens?: number }
  | { type: 'unload'; requestId: string }

interface ProgressEventPayload {
  status?: string
  file?: string
  loaded?: number
  total?: number
}

let loadedSpecId: string | null = null
let activeDevice: 'webgpu' | 'wasm' = 'wasm'
let qwenModel: any = null
let qwenProcessor: any = null
let textPipeline: any = null
let loadingPromise: Promise<void> | null = null
let loadingSpecId: string | null = null

async function detectDevice(): Promise<'webgpu' | 'wasm'> {
  try {
    const nav = self.navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown | null> } }
    if (nav?.gpu) {
      const adapter = await nav.gpu.requestAdapter()
      if (adapter) return 'webgpu'
    }
  } catch {
    // Fallback to WASM when WebGPU adapter is unavailable
  }
  return 'wasm'
}

function disposeLoadedModel(): void {
  try {
    qwenModel?.dispose?.()
  } catch {
    // Ignore dispose errors
  }
  try {
    textPipeline?.dispose?.()
  } catch {
    // Ignore dispose errors
  }
  qwenModel = null
  qwenProcessor = null
  textPipeline = null
  loadedSpecId = null
}

async function ensureLoaded(spec: LocalBrowserModelSpec, requestId: string): Promise<void> {
  if (loadedSpecId === spec.id && (qwenModel || textPipeline)) return

  if (loadingPromise && loadingSpecId === spec.id) {
    return loadingPromise
  }

  loadingSpecId = spec.id
  loadingPromise = (async () => {
    disposeLoadedModel()
    activeDevice = await detectDevice()

    const progress_callback = (event: ProgressEventPayload) => {
      self.postMessage({
        type: 'progress',
        requestId,
        modelId: spec.id,
        event,
      })
    }

    if (spec.pipelineTask === 'qwen35') {
      qwenProcessor = await AutoProcessor.from_pretrained(spec.repository, {
        revision: spec.revision,
        progress_callback,
      })
      qwenModel = await Qwen3_5ForConditionalGeneration.from_pretrained(spec.repository, {
        revision: spec.revision,
        device: activeDevice,
        dtype: spec.dtype as any,
        progress_callback,
      })
    } else {
      textPipeline = await pipeline('text-generation', spec.repository, {
        revision: spec.revision,
        device: activeDevice,
        dtype: spec.dtype as any,
        progress_callback,
      })
    }

    loadedSpecId = spec.id
  })().finally(() => {
    loadingPromise = null
    loadingSpecId = null
  })

  return loadingPromise
}

self.addEventListener('message', (ev: MessageEvent<WorkerInMessage>) => {
  const msg = ev.data
  if (!msg) return

  if (msg.type === 'unload') {
    disposeLoadedModel()
    self.postMessage({ type: 'unloaded', requestId: msg.requestId })
    return
  }

  if (msg.type === 'load') {
    const spec = getLocalModelSpec(msg.modelId)
    void ensureLoaded(spec, msg.requestId)
      .then(() => {
        self.postMessage({ type: 'ready', requestId: msg.requestId, modelId: spec.id, device: activeDevice })
      })
      .catch((err: unknown) => {
        self.postMessage({
          type: 'error',
          requestId: msg.requestId,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    return
  }

  if (msg.type === 'generate') {
    const spec = getLocalModelSpec(msg.modelId)
    const maxNewTokens = msg.maxNewTokens ?? 512
    void (async () => {
      await ensureLoaded(spec, msg.requestId)

      if (spec.pipelineTask === 'qwen35' && qwenProcessor && qwenModel) {
        const formatted = msg.messages.map((m) => ({
          role: m.role === 'system' || m.role === 'assistant' ? m.role : 'user',
          content: [{ type: 'text', text: m.content }],
        }))
        const text = qwenProcessor.apply_chat_template(formatted, { add_generation_prompt: true })
        const inputs = await qwenProcessor(text)
        const streamer = new TextStreamer(qwenProcessor.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (delta: string) => {
            if (delta) self.postMessage({ type: 'delta', requestId: msg.requestId, delta })
          },
        })
        await qwenModel.generate({
          ...inputs,
          max_new_tokens: maxNewTokens,
          streamer,
        })
      } else if (textPipeline) {
        const formatted = msg.messages.map((m) => ({
          role: m.role === 'system' || m.role === 'assistant' ? m.role : 'user',
          content: m.content,
        }))
        const streamer = new TextStreamer(textPipeline.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (delta: string) => {
            if (delta) self.postMessage({ type: 'delta', requestId: msg.requestId, delta })
          },
        })
        await textPipeline(formatted, {
          max_new_tokens: maxNewTokens,
          streamer,
        })
      }

      self.postMessage({ type: 'done', requestId: msg.requestId })
    })().catch((err: unknown) => {
      self.postMessage({
        type: 'error',
        requestId: msg.requestId,
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }
})
