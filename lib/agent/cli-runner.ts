import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { AGENT_PRESETS, type AgentChatMessage, type AgentCliAdapter, type AgentProviderType } from '@/lib/agent/types'

const execFileAsync = promisify(execFile)

const CLI_CANDIDATES: Record<AgentCliAdapter, string[]> = {
  claude: [path.join(os.homedir(), '.local/bin/claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude', 'claude'],
  codex: [path.join(os.homedir(), '.local/bin/codex'), '/opt/homebrew/bin/codex', '/usr/local/bin/codex', 'codex'],
  antigravity: [path.join(os.homedir(), '.local/bin/agy'), '/opt/homebrew/bin/agy', '/usr/local/bin/agy', 'agy'],
  cursor: [path.join(os.homedir(), '.local/bin/agent'), path.join(os.homedir(), '.local/bin/cursor-agent'), '/opt/homebrew/bin/agent', '/usr/local/bin/agent', 'agent'],
  gemini: [path.join(os.homedir(), '.local/bin/gemini'), '/opt/homebrew/bin/gemini', '/usr/local/bin/gemini', 'gemini'],
}

export function getCliAdapterForProvider(provider: AgentProviderType): AgentCliAdapter | null {
  return AGENT_PRESETS[provider]?.cliAdapter ?? null
}

/** Resolves an official local CLI binary path without invoking a shell. */
export function resolveCliBinary(adapter: AgentCliAdapter, explicitCommand?: string): { command: string; detected: boolean } {
  const explicit = explicitCommand?.trim()
  if (explicit) {
    if (explicit.includes('/') || explicit.includes('\\')) {
      return { command: explicit, detected: existsSync(explicit) }
    }
    return { command: explicit, detected: true }
  }

  const candidates = CLI_CANDIDATES[adapter] || []
  for (const candidate of candidates) {
    if ((candidate.includes('/') || candidate.includes('\\')) && existsSync(candidate)) {
      return { command: candidate, detected: true }
    }
  }
  return { command: candidates[candidates.length - 1] || adapter, detected: false }
}

export async function detectInstalledClis(): Promise<Record<AgentCliAdapter, { command: string; installed: boolean }>> {
  const adapters: AgentCliAdapter[] = ['claude', 'codex', 'antigravity', 'cursor', 'gemini']
  const entries = await Promise.all(
    adapters.map(async (adapter) => {
      const resolved = resolveCliBinary(adapter)
      if (resolved.detected) {
        return [adapter, { command: resolved.command, installed: true }] as const
      }
      try {
        const { stdout } = await execFileAsync('which', [resolved.command], { timeout: 2000 })
        const found = stdout.trim().split(/\r?\n/)[0]
        if (found) {
          return [adapter, { command: found, installed: true }] as const
        }
      } catch {
        // Not in PATH
      }
      return [adapter, { command: resolved.command, installed: false }] as const
    })
  )
  return Object.fromEntries(entries) as Record<AgentCliAdapter, { command: string; installed: boolean }>
}

function buildCliEnv(adapter: AgentCliAdapter, apiKey?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NO_COLOR: '1',
  }
  if (adapter === 'antigravity') {
    env.AGY_CLI_DISABLE_AUTO_UPDATE = 'true'
  }
  if (apiKey?.trim()) {
    if (adapter === 'claude') env.ANTHROPIC_API_KEY = apiKey.trim()
    else if (adapter === 'codex') env.OPENAI_API_KEY = apiKey.trim()
    else if (adapter === 'cursor') env.CURSOR_API_KEY = apiKey.trim()
    else if (adapter === 'gemini') env.GEMINI_API_KEY = apiKey.trim()
  }
  return env
}

export async function testCliConnection(provider: AgentProviderType, cliCommand?: string): Promise<{ ok: boolean; latencyMs: number; version?: string; error?: string }> {
  const start = Date.now()
  const adapter = getCliAdapterForProvider(provider)
  if (!adapter) {
    return { ok: false, latencyMs: 0, error: `Unsupported CLI provider: ${provider}` }
  }
  const { command } = resolveCliBinary(adapter, cliCommand)
  try {
    const { stdout, stderr } = await execFileAsync(command, ['--version'], {
      timeout: 8000,
      env: buildCliEnv(adapter),
    })
    const version = (stdout || stderr).trim().split(/\r?\n/)[0]
    return { ok: true, latencyMs: Date.now() - start, version }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'CLI binary execution failed'
    return { ok: false, latencyMs: Date.now() - start, error: msg }
  }
}

export async function discoverCliModels(provider: AgentProviderType, cliCommand?: string): Promise<Array<{ id: string; name: string }>> {
  const adapter = getCliAdapterForProvider(provider)
  if (!adapter) return []
  const preset = AGENT_PRESETS[provider]

  if (adapter === 'antigravity') {
    const { command } = resolveCliBinary(adapter, cliCommand)
    try {
      const { stdout } = await execFileAsync(command, ['models'], {
        timeout: 15_000,
        env: buildCliEnv(adapter),
      })
      const parsed = stdout
        .split(/\r?\n/u)
        .map((line) => {
          const [id, ...rest] = line.trim().split('\t')
          if (!id || !/^[a-z0-9][a-z0-9._-]+$/iu.test(id)) return null
          return { id, name: rest.join(' ').trim() || id }
        })
        .filter((item): item is { id: string; name: string } => Boolean(item))
      if (parsed.length > 0) return parsed
    } catch {
      // Fall back to preset list when agy models fails
    }
  }

  return preset.models
}

function formatMessagesPrompt(messages: AgentChatMessage[]): string {
  const parts: string[] = []
  for (const msg of messages) {
    if (!msg.content?.trim()) continue
    if (msg.role === 'system') {
      parts.push(`[System Instructions]\n${msg.content.trim()}`)
    } else if (msg.role === 'user') {
      parts.push(`[User]\n${msg.content.trim()}`)
    } else if (msg.role === 'assistant') {
      parts.push(`[Assistant]\n${msg.content.trim()}`)
    }
  }
  return parts.join('\n\n')
}

function buildCliInvocation(adapter: AgentCliAdapter, prompt: string, model?: string): string[] {
  const m = model?.trim()
  switch (adapter) {
    case 'claude':
      return ['-p', prompt, ...(m ? ['--model', m] : []), '--output-format', 'text']
    case 'codex':
      return ['exec', '--skip-git-repo-check', ...(m ? ['-m', m] : []), prompt]
    case 'antigravity':
      return ['-p', prompt, ...(m ? ['--model', m] : []), '--output-format', 'json']
    case 'cursor':
      return ['-p', prompt, ...(m && m !== 'auto' ? ['--model', m] : []), '--output-format', 'text']
    case 'gemini':
      return ['-p', prompt, ...(m ? ['--model', m] : [])]
  }
}

export async function runCliCompletion(options: {
  provider: AgentProviderType
  model?: string
  cliCommand?: string
  apiKey?: string
  messages: AgentChatMessage[]
  cwd?: string
}): Promise<{ content: string; latencyMs: number }> {
  const start = Date.now()
  const adapter = getCliAdapterForProvider(options.provider)
  if (!adapter) {
    throw new Error(`Unsupported CLI provider: ${options.provider}`)
  }

  const { command } = resolveCliBinary(adapter, options.cliCommand)
  const prompt = formatMessagesPrompt(options.messages)
  const args = buildCliInvocation(adapter, prompt, options.model)
  const env = buildCliEnv(adapter, options.apiKey)
  const cwd = options.cwd && existsSync(options.cwd) ? options.cwd : process.cwd()

  const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${options.provider} CLI execution timed out after 120s`))
    }, 120_000)

    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString('utf8')
    })
    child.on('error', (spawnErr) => {
      clearTimeout(timer)
      reject(spawnErr)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && !out.trim()) {
        reject(new Error(err.trim() || `${options.provider} CLI exited with code ${code}`))
      } else {
        resolve({ stdout: out, stderr: err })
      }
    })
  })

  let content = stdout.trim()
  if (adapter === 'antigravity' && content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content) as { response?: string; error?: string }
      if (parsed.error && !parsed.response) {
        throw new Error(parsed.error)
      }
      if (typeof parsed.response === 'string') {
        content = parsed.response
      }
    } catch (e) {
      if (e instanceof Error && !e.message.includes('JSON')) throw e
    }
  }

  if (!content && stderr.trim()) {
    content = stderr.trim()
  }

  return {
    content,
    latencyMs: Date.now() - start,
  }
}
