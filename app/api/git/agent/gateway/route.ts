import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'

export const runtime = 'nodejs'

/**
 * Lightweight Next.js proxy route to bypass browser CORS restrictions
 * when interacting with AI Gateways (e.g., Vercel AI Gateway) or external LLMs.
 */
export const POST = defineApiRoute('post:/api/git/agent/gateway', async ({ request }) => {
  try {
    const payload = await request.json()
    const { endpoint, apiKey, headers: customHeaders = {}, ...chatBody } = payload

    const targetUrl = endpoint || 'https://ai-gateway.vercel.sh/v1/chat/completions'

    // Validate destination scheme
    const parsedUrl = new URL(targetUrl)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return apiBadRequest('Invalid gateway protocol')
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    }

    if (targetUrl.includes('anthropic.com')) {
      if (apiKey) {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
      }
    } else if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(chatBody),
    })

    const contentType = upstreamResponse.headers.get('content-type') || ''

    // Pass through SSE stream
    if (contentType.includes('text/event-stream') && upstreamResponse.body) {
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    }

    const data = await upstreamResponse.json().catch(() => null)
    if (!upstreamResponse.ok) {
      const errorMsg = data?.error?.message || data?.message || `Upstream returned ${upstreamResponse.status}`
      return apiBadRequest(errorMsg)
    }

    return data
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown gateway forwarding error'
    return apiBadRequest(message)
  }
})
