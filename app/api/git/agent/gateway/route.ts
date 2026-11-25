import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { assertAgentRequestAllowed } from '@/lib/security/agent-request-guard'
import { resolveStoredApiKey } from '@/lib/security/credential-vault'
import { assertSafeOutboundUrl } from '@/lib/security/ssrf'

export const runtime = 'nodejs'

/**
 * Lightweight Next.js proxy route to bypass browser CORS restrictions
 * when interacting with AI Gateways (e.g., Vercel AI Gateway) or external LLMs.
 */
export const POST = defineApiRoute('post:/api/git/agent/gateway', async ({ request }) => {
  const denied = assertAgentRequestAllowed(request)
  if (denied) return denied
  try {
    const payload = await request.json()
    const { endpoint, apiKey, profileId, headers: customHeaders = {}, ...chatBody } = payload
    const resolvedApiKey =
      typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : typeof profileId === 'string' && profileId.trim() ? resolveStoredApiKey(profileId.trim()) : undefined

    const targetUrl = endpoint || 'https://ai-gateway.vercel.sh/v1/chat/completions'

    // Validate destination against SSRF
    const parsedUrl = await assertSafeOutboundUrl(targetUrl)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    }

    if (parsedUrl.hostname.endsWith('anthropic.com')) {
      if (resolvedApiKey) {
        headers['x-api-key'] = resolvedApiKey
        headers['anthropic-version'] = '2023-06-01'
      }
    } else if (resolvedApiKey) {
      headers['Authorization'] = `Bearer ${resolvedApiKey}`
    }

    const upstreamResponse = await fetch(parsedUrl.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(chatBody),
      redirect: 'error',
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
