import fs from 'node:fs'
import path from 'node:path'

import { resolveGitRepo } from '@/services/git/read'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const repoInput = url.searchParams.get('repo')?.trim()
  if (!repoInput) {
    return new Response('Missing repo parameter', { status: 400 })
  }

  let repoPath: string
  try {
    repoPath = await resolveGitRepo(repoInput)
  } catch {
    return new Response('Repository not found', { status: 404 })
  }

  const encoder = new TextEncoder()
  const watchers: fs.FSWatcher[] = []
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let closed = false

  const cleanup = () => {
    if (closed) return
    closed = true
    if (debounceTimer) clearTimeout(debounceTimer)
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    for (const watcher of watchers) {
      try {
        watcher.close()
      } catch {
        // Ignore close errors
      }
    }
    watchers.length = 0
  }

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (eventName: string, payload: Record<string, unknown>) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`))
        } catch {
          cleanup()
        }
      }

      const scheduleNotify = (filename?: string | null) => {
        if (closed) return
        if (filename && filename.endsWith('.lock')) return
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          sendEvent('change', { ts: Date.now() })
        }, 500)
      }

      const watchTarget = (target: string, recursive = false) => {
        if (!fs.existsSync(target)) return
        try {
          const watcher = fs.watch(target, { recursive, persistent: false }, (_eventType, filename) => {
            scheduleNotify(typeof filename === 'string' ? filename : undefined)
          })
          watchers.push(watcher)
        } catch {
          // Ignore unsupported recursive watch or permission errors
        }
      }

      const gitDir = path.join(repoPath, '.git')
      watchTarget(path.join(gitDir, 'HEAD'))
      watchTarget(path.join(gitDir, 'index'))
      watchTarget(path.join(gitDir, 'refs'), true)
      watchTarget(repoPath, false)

      sendEvent('ready', { ts: Date.now() })
      heartbeatTimer = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          cleanup()
        }
      }, 30_000)

      request.signal.addEventListener('abort', cleanup, { once: true })
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
