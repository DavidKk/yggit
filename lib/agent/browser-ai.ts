'use client'

import { removeBrowserDownload, requestOpenDownloadCenter, upsertBrowserDownload } from '@/lib/downloads/browser-downloads'

import { getBrowserAiDebugOverride, setBrowserAiDebugOverride } from './browser-ai-debug'
import { markLocalRuntimeWarmedUp } from './local-warmup'
import { RedactionEngine } from './redact/engine'
import { StreamingUnmasker, unmaskText } from './redact/unmask'
import type { AgentChatMessage, AgentCompletionResponse } from './types'

export type BrowserAiStatus = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'preparing' | 'available'

interface DownloadProgressEvent extends Event {
  loaded?: number
}

interface LanguageModelMonitor {
  addEventListener: (type: 'downloadprogress', listener: (event: DownloadProgressEvent) => void) => void
}

interface LanguageModelCreateOptions {
  signal?: AbortSignal
  initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  systemPrompt?: string
  temperature?: number
  monitor?: (monitor: LanguageModelMonitor) => void
}

interface LanguageModelSession {
  prompt: (input: string, options?: { signal?: AbortSignal }) => Promise<string>
  promptStreaming?: (input: string, options?: { signal?: AbortSignal }) => AsyncIterable<string>
  destroy?: () => void
}

interface LanguageModelApi {
  availability?: (options?: Record<string, unknown>) => Promise<string>
  capabilities?: () => Promise<{ available?: string }>
  create: (options?: LanguageModelCreateOptions) => Promise<LanguageModelSession>
}

const BROWSER_AI_DOWNLOAD_ID = 'browser-ai:gemini-nano'

const COMPACT_BROWSER_AI_SYSTEM_PROMPT = `You are Yggi, a Git assistant in Yggdrasil.
When repository data or UI action is needed, output ONLY a fenced \`\`\`tool_code block with the tool call, e.g.:
\`\`\`tool_code
get_branches()
\`\`\`
Available tools: get_branches, get_repo_summary, get_unmerged_branches, check_branch_containment, get_today_merges, find_commits, get_commit_details, focus_branch, sync_branch, open_project, list_projects, navigate_ui, set_ui_theme.
Answer very concisely in the user's language (2-5 short lines, cite concrete branch names, file paths, or counts directly; no verbose tutorials).`

function buildCompactBrowserAiInput(
  messages: Array<Pick<AgentChatMessage, 'role' | 'content'>>,
  maxMessages = 6,
  maxTotalChars = 2400
): { systemPrompt: string; promptText: string } {
  const extraSystem = messages
    .filter((m) => m.role === 'system' && m.content && !m.content.includes('You are Git Agent, an expert Git diagnostic'))
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 600)

  const systemPrompt = extraSystem ? `${COMPACT_BROWSER_AI_SYSTEM_PROMPT}\n\n${extraSystem}` : COMPACT_BROWSER_AI_SYSTEM_PROMPT

  const nonSystem = messages.filter((m) => m.role !== 'system').slice(-maxMessages)
  const formatted: string[] = []
  let total = 0

  // Keep most recent messages first within character budget
  for (let i = nonSystem.length - 1; i >= 0; i--) {
    const m = nonSystem[i]
    const label = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'Tool'
    const raw = (m.content || '').trim()
    const clipped = raw.length > 1200 ? `${raw.slice(0, 1200)}...` : raw
    const line = `${label}: ${clipped}`
    if (formatted.length > 0 && total + line.length > maxTotalChars) break
    formatted.unshift(line)
    total += line.length
  }

  return { systemPrompt, promptText: formatted.join('\n\n') }
}

function isInputTooLargeError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  return /too large|quota|context length|token limit/i.test(msg)
}

let activeSessionPromise: Promise<LanguageModelSession> | null = null
let activePhase: 'downloading' | 'preparing' | null = null
let activePercent: number | undefined

function getLanguageModelApi(): LanguageModelApi | null {
  if (typeof globalThis === 'undefined') return null
  const win = globalThis as unknown as {
    LanguageModel?: LanguageModelApi
    ai?: { languageModel?: LanguageModelApi }
  }
  if (win.LanguageModel && typeof win.LanguageModel.create === 'function') {
    return win.LanguageModel
  }
  if (win.ai?.languageModel && typeof win.ai.languageModel.create === 'function') {
    return win.ai.languageModel
  }
  return null
}

function mapRawAvailability(raw: string | undefined): BrowserAiStatus {
  switch (raw) {
    case 'available':
    case 'readily':
      return 'available'
    case 'downloadable':
    case 'after-download':
      return 'downloadable'
    case 'downloading':
      return 'downloading'
    case 'unavailable':
    case 'no':
    default:
      return 'unavailable'
  }
}

export async function getBrowserAiAvailability(): Promise<{ status: BrowserAiStatus; percent?: number }> {
  const override = getBrowserAiDebugOverride()
  if (override !== 'real' && activePhase === null) {
    return { status: override }
  }

  const api = getLanguageModelApi()
  if (!api) return { status: 'unsupported' }

  if (activePhase === 'preparing') return { status: 'preparing', percent: 100 }
  if (activePhase === 'downloading') return { status: 'downloading', percent: activePercent }

  try {
    if (typeof api.availability === 'function') {
      const raw = await api.availability()
      return { status: mapRawAvailability(raw) }
    }
    if (typeof api.capabilities === 'function') {
      const caps = await api.capabilities()
      return { status: mapRawAvailability(caps?.available) }
    }
    return { status: 'unavailable' }
  } catch {
    return { status: 'unavailable' }
  }
}

export interface EnsureBrowserAiOptions {
  systemPrompt?: string
  temperature?: number
  signal?: AbortSignal
  openProgressPopover?: boolean
  onStatusChange?: (status: BrowserAiStatus, percent?: number) => void
}

/**
 * Ensures a Chrome Built-in AI (Gemini Nano) session is ready.
 * If already installed globally in Chrome, skips download UI completely.
 * If downloadable, triggers download on user gesture and reports progress to the top-right DownloadCenter.
 */
export async function ensureBrowserAiSession(options: EnsureBrowserAiOptions = {}): Promise<LanguageModelSession> {
  const override = getBrowserAiDebugOverride()
  if (override === 'unsupported') {
    throw new Error('Browser AI (Chrome Prompt API) is not supported in this browser.')
  }
  if (override === 'unavailable') {
    throw new Error('Browser AI model is unavailable on this device or Chrome Prompt API is disabled.')
  }
  if (override === 'downloadable') {
    if (activeSessionPromise) return activeSessionPromise
    const startedAt = Date.now()
    const runSimulated = async (): Promise<LanguageModelSession> => {
      try {
        for (const pct of [0, 25, 60, 90, 100]) {
          if (pct >= 100) {
            activePhase = 'preparing'
            activePercent = 100
            options.onStatusChange?.('preparing', 100)
            upsertBrowserDownload({
              id: BROWSER_AI_DOWNLOAD_ID,
              kind: 'browser-ai',
              title: 'Gemini Nano',
              subtitle: 'Browser AI · Local (Debug)',
              status: 'running',
              phase: 'prepare',
              percent: undefined,
              detail: '100%',
              startedAt,
            })
            if (options.openProgressPopover) requestOpenDownloadCenter()
          } else {
            activePhase = 'downloading'
            activePercent = pct
            options.onStatusChange?.('downloading', pct)
            upsertBrowserDownload({
              id: BROWSER_AI_DOWNLOAD_ID,
              kind: 'browser-ai',
              title: 'Gemini Nano',
              subtitle: 'Browser AI · Local (Debug)',
              status: 'running',
              phase: 'download',
              percent: pct,
              detail: `${pct}%`,
              startedAt,
            })
            if (pct === 0 && options.openProgressPopover) requestOpenDownloadCenter()
          }
          await new Promise((r) => setTimeout(r, 450))
        }
        removeBrowserDownload(BROWSER_AI_DOWNLOAD_ID)
        setBrowserAiDebugOverride('real')
        markLocalRuntimeWarmedUp('browser-ai')
        options.onStatusChange?.('available', 100)
        return {
          prompt: async (input: string) => `[Debug Browser AI] ${input}`,
          destroy: () => {},
        }
      } finally {
        activePhase = null
        activePercent = undefined
        activeSessionPromise = null
      }
    }
    activeSessionPromise = runSimulated()
    return activeSessionPromise
  }

  const api = getLanguageModelApi()
  if (!api) {
    throw new Error('Browser AI (Chrome Prompt API) is not supported in this browser.')
  }

  const { status } = await getBrowserAiAvailability()
  if (status === 'unavailable') {
    throw new Error('Browser AI model is unavailable on this device or Chrome Prompt API is disabled.')
  }

  if (activeSessionPromise) {
    return activeSessionPromise
  }

  const needsDownload = status === 'downloadable' || status === 'downloading'
  const startedAt = Date.now()

  const run = async (): Promise<LanguageModelSession> => {
    try {
      if (needsDownload) {
        activePhase = 'downloading'
        activePercent = 0
        options.onStatusChange?.('downloading', 0)
        upsertBrowserDownload({
          id: BROWSER_AI_DOWNLOAD_ID,
          kind: 'browser-ai',
          title: 'Gemini Nano',
          subtitle: 'Browser AI · Local',
          status: 'running',
          phase: 'download',
          percent: 0,
          detail: '0%',
          startedAt,
        })
        if (options.openProgressPopover) {
          requestOpenDownloadCenter()
        }
      }

      const createOptions: LanguageModelCreateOptions = {
        signal: options.signal,
      }
      if (options.systemPrompt) {
        createOptions.initialPrompts = [{ role: 'system', content: options.systemPrompt }]
        createOptions.systemPrompt = options.systemPrompt
      }
      if (typeof options.temperature === 'number') {
        createOptions.temperature = options.temperature
      }
      if (needsDownload) {
        createOptions.monitor = (monitor) => {
          monitor.addEventListener('downloadprogress', (event) => {
            const loaded = typeof event.loaded === 'number' && Number.isFinite(event.loaded) ? event.loaded : 0
            const percent = Math.min(100, Math.max(0, Math.round(loaded * 100)))
            activePercent = percent
            if (percent >= 100) {
              activePhase = 'preparing'
              options.onStatusChange?.('preparing', 100)
              upsertBrowserDownload({
                id: BROWSER_AI_DOWNLOAD_ID,
                kind: 'browser-ai',
                title: 'Gemini Nano',
                subtitle: 'Browser AI · Local',
                status: 'running',
                phase: 'prepare',
                percent: undefined,
                detail: '100%',
                startedAt,
              })
            } else {
              activePhase = 'downloading'
              options.onStatusChange?.('downloading', percent)
              upsertBrowserDownload({
                id: BROWSER_AI_DOWNLOAD_ID,
                kind: 'browser-ai',
                title: 'Gemini Nano',
                subtitle: 'Browser AI · Local',
                status: 'running',
                phase: 'download',
                percent,
                detail: `${percent}%`,
                startedAt,
              })
            }
          })
        }
      }

      const session = await api.create(createOptions)
      markLocalRuntimeWarmedUp('browser-ai')
      if (needsDownload) {
        removeBrowserDownload(BROWSER_AI_DOWNLOAD_ID)
      }
      options.onStatusChange?.('available', 100)
      return session
    } catch (err) {
      if (needsDownload) {
        removeBrowserDownload(BROWSER_AI_DOWNLOAD_ID)
      }
      throw err
    } finally {
      activePhase = null
      activePercent = undefined
      activeSessionPromise = null
    }
  }

  activeSessionPromise = run()
  return activeSessionPromise
}

export async function runBrowserAiCompletion(options: {
  messages: Array<Pick<AgentChatMessage, 'role' | 'content'>>
  temperature?: number
  redactionEngine?: RedactionEngine
  onDelta?: (delta: string) => void
  signal?: AbortSignal
}): Promise<AgentCompletionResponse> {
  const { messages, temperature, redactionEngine, onDelta, signal } = options
  const start = performance.now()

  const runAttempt = async (maxMessages: number, maxTotalChars: number): Promise<AgentCompletionResponse> => {
    const { systemPrompt, promptText } = buildCompactBrowserAiInput(messages, maxMessages, maxTotalChars)
    const session = await ensureBrowserAiSession({
      systemPrompt,
      temperature,
      signal,
    })

    try {
      let rawFull = ''
      let emitted = ''
      const unmasker = redactionEngine ? new StreamingUnmasker(redactionEngine.getSession()) : null

      if (typeof session.promptStreaming === 'function') {
        const stream = session.promptStreaming(promptText, { signal })
        let previousText = ''
        for await (const chunk of stream) {
          // Chrome's promptStreaming can yield either incremental deltas or cumulative text depending on channel/version
          const delta = chunk.startsWith(previousText) && previousText.length > 0 ? chunk.slice(previousText.length) : chunk
          previousText = chunk.startsWith(previousText) ? chunk : previousText + chunk
          if (!delta) continue
          rawFull += delta
          if (onDelta) {
            const outChunk = unmasker ? unmasker.feed(delta) : delta
            if (outChunk) {
              emitted += outChunk
              onDelta(outChunk)
            }
          }
        }
        if (unmasker && onDelta) {
          const tail = unmasker.flush()
          if (tail) {
            emitted += tail
            onDelta(tail)
          }
        }
      } else {
        const result = await session.prompt(promptText, { signal })
        rawFull = result || ''
        const finalChunk = redactionEngine ? unmaskText(rawFull, redactionEngine.getSession()) : rawFull
        if (finalChunk && onDelta) {
          emitted = finalChunk
          onDelta(finalChunk)
        }
      }

      const content = redactionEngine ? unmaskText(rawFull, redactionEngine.getSession()) : emitted || rawFull
      return {
        id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `browser_ai_${Date.now()}`,
        content,
        latencyMs: Math.round(performance.now() - start),
      }
    } finally {
      session.destroy?.()
    }
  }

  try {
    return await runAttempt(6, 2400)
  } catch (err) {
    if (isInputTooLargeError(err)) {
      return await runAttempt(2, 1000)
    }
    throw err
  }
}
