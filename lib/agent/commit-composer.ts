import { isModelAllowed, type ModelFilterOptions } from './model-filter'
import { sendAgentCompletion } from './openapi-client'
import { createRedactionSession, RedactionEngine } from './redact/engine'
import type { RedactionOptions } from './redact/types'
import { recordAgentTrace } from './trace-logger'
import { AGENT_PRESETS, type EphemeralAgentConfig } from './types'

export interface ComposeCommitFile {
  path: string
  status: string
}

export interface ComposeCommitOptions {
  repo: string
  files: ComposeCommitFile[]
  diffSnippets?: Array<{ path: string; diff: string }>
  config?: EphemeralAgentConfig
  profileId?: string
  profileName?: string
  redactionOptions?: RedactionOptions
  modelFilter?: ModelFilterOptions
}

export interface ComposeCommitResult {
  summary: string
  description: string
  usedAi: boolean
}

function fileName(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx >= 0 ? path.slice(idx + 1) : path
}

export function buildFallbackCommitMessage(files: ComposeCommitFile[]): { summary: string; description: string } {
  const names = files.slice(0, 3).map((f) => fileName(f.path))
  const extra = files.length > 3 ? ` and ${files.length - 3} other files` : ''
  return {
    summary: `feat(workspace): update ${names.join(', ')}${extra}`,
    description: `Contains changes to the following files:\n${files.map((f) => `- ${f.path} (${f.status})`).join('\n')}`,
  }
}

export function parseAiCommitResponse(raw: string): { summary: string; description: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const unwrapped = trimmed.replace(/^```(?:json)?\s*\n([\s\S]*?)```$/i, '$1').trim()
  if (unwrapped.startsWith('{')) {
    try {
      const parsed = JSON.parse(unwrapped) as { summary?: unknown; description?: unknown }
      if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
        return {
          summary: parsed.summary.trim().slice(0, 120),
          description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
        }
      }
    } catch {
      // Fall back to line splitting
    }
  }

  const lines = unwrapped.split('\n').map((l) => l.trimEnd())
  const summary = (lines[0] || '')
    .replace(/^[-*#>\s]+/, '')
    .trim()
    .slice(0, 120)
  if (!summary) return null
  const description = lines.slice(1).join('\n').trim()
  return { summary, description }
}

function isConfigUsableForCommitAi(config?: EphemeralAgentConfig): config is EphemeralAgentConfig {
  if (!config || !config.model?.trim()) return false
  if (config.provider === 'browser-ai' || config.provider === 'browser-local') return true
  const preset = AGENT_PRESETS[config.provider]
  if (preset?.isCli) return true
  if (config.apiKey || config.hasApiKey) return true
  return !preset?.requiresKey
}

/**
 * Generates a Conventional Commits summary & description using the configured AI channel,
 * falling back to a deterministic template if AI is unconfigured or fails.
 */
export async function composeCommitMessageWithAi(options: ComposeCommitOptions): Promise<ComposeCommitResult> {
  const { repo, files, diffSnippets = [], config, profileId, profileName, redactionOptions, modelFilter } = options
  const fallback = buildFallbackCommitMessage(files)

  if (!isConfigUsableForCommitAi(config)) {
    return { ...fallback, usedAi: false }
  }
  if (modelFilter && !isModelAllowed(config.model, modelFilter)) {
    return { ...fallback, usedAi: false }
  }

  const fileListText = files
    .slice(0, 20)
    .map((f) => `- ${f.path} (${f.status})`)
    .join('\n')

  const diffText = diffSnippets
    .filter((d) => d.diff.trim())
    .map((d) => `### ${d.path}\n${d.diff.slice(0, 650)}`)
    .join('\n\n')
    .slice(0, 1800)

  const systemPrompt =
    'You generate concise Conventional Commits messages. Return ONLY valid JSON: {"summary":"<type>(<scope>): <short imperative summary <= 72 chars>","description":"<2-4 concise bullet points>"}.'
  const userPrompt = `Changed files:\n${fileListText}${diffText ? `\n\nDiff excerpts:\n${diffText}` : ''}`

  const requestMessages = [
    { id: 'sys_commit', role: 'system' as const, content: systemPrompt },
    { id: 'usr_commit', role: 'user' as const, content: userPrompt },
  ]

  const engine = redactionOptions?.enabled ? new RedactionEngine(redactionOptions, createRedactionSession()) : undefined
  const startedAt = Date.now()

  try {
    const res = await sendAgentCompletion({
      config,
      profileId,
      messages: requestMessages,
      redactionEngine: engine,
      purpose: 'chat',
    })

    const parsed = parseAiCommitResponse(res.content || '')
    recordAgentTrace({
      durationMs: Date.now() - startedAt,
      status: parsed ? 'success' : 'error',
      provider: config.provider,
      model: config.model,
      profileName,
      repo: repo || undefined,
      userPrompt: `[AI Commit] ${files.length} file(s)`,
      requestMessages: requestMessages.map((m) => ({ role: m.role, content: m.content })),
      toolNames: [],
      matchedSkills: [],
      nativeToolCalls: [],
      fallbackToolCalls: [],
      toolExecutions: [],
      rawTurnOneContent: res.content || '',
      visibleContent: parsed ? `${parsed.summary}\n\n${parsed.description}`.trim() : '',
      ...(parsed ? {} : { error: 'Failed to parse commit message from AI response' }),
      tokenUsage: res.usage,
    })

    if (!parsed) {
      return { ...fallback, usedAi: false }
    }
    return { ...parsed, usedAi: true }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    recordAgentTrace({
      durationMs: Date.now() - startedAt,
      status: 'error',
      provider: config.provider,
      model: config.model,
      profileName,
      repo: repo || undefined,
      userPrompt: `[AI Commit] ${files.length} file(s)`,
      requestMessages: requestMessages.map((m) => ({ role: m.role, content: m.content })),
      toolNames: [],
      matchedSkills: [],
      nativeToolCalls: [],
      fallbackToolCalls: [],
      toolExecutions: [],
      rawTurnOneContent: '',
      visibleContent: '',
      error: errorMsg,
    })
    return { ...fallback, usedAi: false }
  }
}
