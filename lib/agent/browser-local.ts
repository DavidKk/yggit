'use client'

import { removeBrowserDownload, requestOpenDownloadCenter, upsertBrowserDownload } from '@/lib/downloads/browser-downloads'

import { clearLocalModelCache, getLocalModelSpec, markLocalModelReady } from './local-models'
import { clearLocalRuntimeWarmup, markLocalRuntimeWarmedUp } from './local-warmup'
import { RedactionEngine } from './redact/engine'
import { StreamingUnmasker, unmaskText } from './redact/unmask'
import type { AgentChatMessage, AgentCompletionResponse } from './types'

export type BrowserLocalPhase = 'idle' | 'downloading' | 'preparing' | 'ready' | 'failed'

interface WorkerProgressPayload {
  status?: string
  file?: string
  loaded?: number
  total?: number
}

interface WorkerOutMessage {
  type: 'progress' | 'ready' | 'delta' | 'done' | 'unloaded' | 'error'
  requestId: string
  modelId?: string
  device?: string
  delta?: string
  error?: string
  event?: WorkerProgressPayload
}

const LOCAL_DOWNLOAD_ID_PREFIX = 'browser-local:'

let workerInstance: Worker | null = null
let activeLoadPromise: Promise<void> | null = null

function getOrCreateWorker(): Worker {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    throw new Error('Web Workers are not supported in this environment.')
  }
  if (!workerInstance) {
    workerInstance = new Worker(new URL('./workers/local-llm.worker.ts', import.meta.url), { type: 'module' })
  }
  return workerInstance
}

function makeRequestId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  return `${value >= 100 || idx === 0 ? Math.round(value) : value.toFixed(1)} ${units[idx]}`
}

function createProgressAggregator(modelId: string, onProgress?: (phase: BrowserLocalPhase, percent?: number) => void) {
  const spec = getLocalModelSpec(modelId)
  const downloadId = `${LOCAL_DOWNLOAD_ID_PREFIX}${spec.id}`
  const startedAt = Date.now()
  const fileProgress = new Map<string, { loaded: number; total: number }>()
  let isPreparing = false
  let maxPercent = 0
  let lastSampleAt = startedAt
  let lastSampleLoaded = 0
  let smoothedSpeedBps = 0

  return {
    handle(event: WorkerProgressPayload | undefined) {
      if (!event || !event.file) return
      const prev = fileProgress.get(event.file)
      const rawLoaded = typeof event.loaded === 'number' && Number.isFinite(event.loaded) ? event.loaded : 0
      const rawTotal = typeof event.total === 'number' && Number.isFinite(event.total) ? event.total : 0
      const total = Math.max(prev?.total ?? 0, rawTotal)

      if (event.status === 'done') {
        if (total > 0) {
          fileProgress.set(event.file, { loaded: total, total })
        }
      } else if (total > 0) {
        const loaded = Math.min(total, Math.max(prev?.loaded ?? 0, rawLoaded))
        fileProgress.set(event.file, { loaded, total })
      }

      let sumLoaded = 0
      let sumTotal = 0
      for (const item of fileProgress.values()) {
        sumLoaded += item.loaded
        sumTotal += item.total
      }

      // Sample smoothed download speed over >= 400ms intervals to avoid noisy jumps
      const now = Date.now()
      const dtMs = now - lastSampleAt
      if (dtMs >= 400 && sumLoaded >= lastSampleLoaded) {
        const deltaBytes = sumLoaded - lastSampleLoaded
        const instantBps = (deltaBytes * 1000) / dtMs
        smoothedSpeedBps = smoothedSpeedBps > 0 ? smoothedSpeedBps * 0.65 + instantBps * 0.35 : instantBps
        lastSampleAt = now
        lastSampleLoaded = sumLoaded
      }

      // Use estimatedBytes as floor denominator until all ONNX weight shards register
      const denom = Math.max(sumTotal, spec.estimatedBytes)
      const computed = denom > 0 ? Math.min(99, Math.max(0, Math.round((sumLoaded / denom) * 100))) : undefined
      if (computed != null) {
        maxPercent = Math.max(maxPercent, computed)
      }
      const percent = computed != null ? maxPercent : undefined

      if (event.status === 'ready' || (sumTotal > 0 && sumLoaded >= sumTotal && sumTotal >= spec.estimatedBytes * 0.5)) {
        isPreparing = true
        maxPercent = 100
        onProgress?.('preparing', 100)
        upsertBrowserDownload({
          id: downloadId,
          kind: 'browser-local',
          title: spec.name,
          subtitle: 'Local Model · WebGPU / WASM',
          status: 'running',
          phase: 'prepare',
          percent: undefined,
          detail: '100%',
          startedAt,
        })
      } else if (!isPreparing) {
        const detailParts: string[] = []
        if (percent != null) detailParts.push(`${percent}%`)
        if (smoothedSpeedBps > 0) detailParts.push(`${formatBytes(smoothedSpeedBps)}/s`)
        if (sumLoaded > 0 && denom > 0) detailParts.push(`${formatBytes(sumLoaded)} / ${formatBytes(denom)}`)

        onProgress?.('downloading', percent ?? maxPercent)
        upsertBrowserDownload({
          id: downloadId,
          kind: 'browser-local',
          title: spec.name,
          subtitle: 'Local Model · Hugging Face',
          status: 'running',
          phase: 'download',
          percent,
          detail: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
          startedAt,
        })
      }
    },
    finish() {
      removeBrowserDownload(downloadId)
      onProgress?.('ready', 100)
    },
    fail() {
      removeBrowserDownload(downloadId)
      onProgress?.('failed')
    },
  }
}

export async function ensureBrowserLocalModel(
  modelId: string,
  options?: { openProgressPopover?: boolean; onProgress?: (phase: BrowserLocalPhase, percent?: number) => void }
): Promise<void> {
  if (activeLoadPromise) return activeLoadPromise

  const spec = getLocalModelSpec(modelId)
  const worker = getOrCreateWorker()
  const requestId = makeRequestId()
  const aggregator = createProgressAggregator(spec.id, options?.onProgress)

  if (options?.openProgressPopover) {
    requestOpenDownloadCenter()
  }

  activeLoadPromise = new Promise<void>((resolve, reject) => {
    const onMessage = (ev: MessageEvent<WorkerOutMessage>) => {
      const msg = ev.data
      if (!msg || msg.requestId !== requestId) return

      if (msg.type === 'progress') {
        aggregator.handle(msg.event)
      } else if (msg.type === 'ready') {
        worker.removeEventListener('message', onMessage)
        markLocalModelReady(spec.id)
        markLocalRuntimeWarmedUp(`browser-local:${spec.id}`)
        aggregator.finish()
        resolve()
      } else if (msg.type === 'error') {
        worker.removeEventListener('message', onMessage)
        aggregator.fail()
        reject(new Error(msg.error || 'Failed to load local browser model'))
      }
    }

    worker.addEventListener('message', onMessage)
    worker.postMessage({ type: 'load', requestId, modelId: spec.id })
  }).finally(() => {
    activeLoadPromise = null
  })

  return activeLoadPromise
}

export async function unloadAndClearBrowserLocalModel(repository?: string): Promise<number> {
  if (workerInstance) {
    try {
      workerInstance.terminate()
    } catch {
      // Ignore terminate errors
    }
    workerInstance = null
    activeLoadPromise = null
  }
  clearLocalRuntimeWarmup('browser-local:')
  return clearLocalModelCache(repository)
}

export async function runBrowserLocalCompletion(options: {
  modelId: string
  messages: Array<Pick<AgentChatMessage, 'role' | 'content'>>
  redactionEngine?: RedactionEngine
  onDelta?: (delta: string) => void
  signal?: AbortSignal
}): Promise<AgentCompletionResponse> {
  const { modelId, messages, redactionEngine, onDelta, signal } = options
  if (activeLoadPromise) {
    try {
      await activeLoadPromise
    } catch {
      // Proceed to let completion attempt or surface load error
    }
  }
  const start = performance.now()
  const spec = getLocalModelSpec(modelId)
  const worker = getOrCreateWorker()
  const requestId = makeRequestId()
  const aggregator = createProgressAggregator(spec.id)

  let rawFull = ''
  let emitted = ''
  const unmasker = redactionEngine ? new StreamingUnmasker(redactionEngine.getSession()) : null

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage)
      signal?.removeEventListener('abort', onAbort)
    }

    const onAbort = () => {
      cleanup()
      // Terminate worker to stop ONNX generation immediately on abort
      try {
        worker.terminate()
      } catch {}
      workerInstance = null
      aggregator.fail()
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    }

    const onMessage = (ev: MessageEvent<WorkerOutMessage>) => {
      const msg = ev.data
      if (!msg || msg.requestId !== requestId) return

      if (msg.type === 'progress') {
        aggregator.handle(msg.event)
      } else if (msg.type === 'delta' && msg.delta) {
        aggregator.finish()
        rawFull += msg.delta
        if (onDelta) {
          const outChunk = unmasker ? unmasker.feed(msg.delta) : msg.delta
          if (outChunk) {
            emitted += outChunk
            onDelta(outChunk)
          }
        }
      } else if (msg.type === 'done') {
        if (unmasker && onDelta) {
          const tail = unmasker.flush()
          if (tail) {
            emitted += tail
            onDelta(tail)
          }
        }
        cleanup()
        markLocalModelReady(spec.id)
        aggregator.finish()
        resolve()
      } else if (msg.type === 'error') {
        cleanup()
        aggregator.fail()
        reject(new Error(msg.error || 'Local model generation failed'))
      }
    }

    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    worker.addEventListener('message', onMessage)
    worker.postMessage({
      type: 'generate',
      requestId,
      modelId: spec.id,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      maxNewTokens: 512,
    })
  })

  const content = redactionEngine ? unmaskText(rawFull, redactionEngine.getSession()) : emitted || rawFull
  return {
    id: makeRequestId(),
    content,
    latencyMs: Math.round(performance.now() - start),
  }
}
