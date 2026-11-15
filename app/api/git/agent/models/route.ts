import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest, apiOk } from '@/initializer/response'

export const runtime = 'nodejs'

interface ModelItem {
  id: string
  name: string
}

/**
 * Server-side route to fetch available models from an upstream LLM endpoint.
 * Protects client from CORS boundaries and adheres to zero-storage for API keys.
 */
export const POST = defineApiRoute('post:/api/git/agent/models', async ({ request }) => {
  try {
    const payload = await request.json()
    const { baseUrl, apiKey, provider } = payload

    if (!baseUrl || typeof baseUrl !== 'string') {
      return apiBadRequest('Missing baseUrl')
    }

    const cleanBaseUrl = baseUrl.trim().replace(/\/+$/, '')
    const parsed = new URL(cleanBaseUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return apiBadRequest('Invalid protocol')
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (cleanBaseUrl.includes('anthropic.com')) {
      if (apiKey) {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
      }
    } else if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    // Attempt 1: Standard OpenAI-compatible /models
    const targetUrl = `${cleanBaseUrl}/models`
    let models: ModelItem[] = []

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        const json = await response.json().catch(() => null)
        if (json && Array.isArray(json.data)) {
          models = json.data
            .filter((item: unknown): item is { id: string } => typeof item === 'object' && item !== null && typeof (item as { id: string }).id === 'string')
            .map((item: { id: string }) => ({ id: item.id, name: item.id }))
        } else if (json && Array.isArray(json.models)) {
          models = json.models
            .filter((item: unknown): item is { name?: string; id?: string } => typeof item === 'object' && item !== null)
            .map((item: { name?: string; id?: string }) => ({ id: item.name || item.id || '', name: item.name || item.id || '' }))
            .filter((item: ModelItem) => Boolean(item.id))
        }
      }
    } catch {
      // Fallback below
    }

    // Attempt 2: If Ollama and /models didn't yield anything, try /api/tags
    if (models.length === 0 && (provider === 'ollama' || cleanBaseUrl.includes(':11434'))) {
      const ollamaTagsUrl = `${cleanBaseUrl.replace(/\/v1$/, '')}/api/tags`
      try {
        const ollamaRes = await fetch(ollamaTagsUrl, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(4000),
        })
        if (ollamaRes.ok) {
          const ollamaJson = await ollamaRes.json().catch(() => null)
          if (ollamaJson && Array.isArray(ollamaJson.models)) {
            models = ollamaJson.models
              .filter((item: unknown): item is { name: string } => typeof item === 'object' && item !== null && typeof (item as { name: string }).name === 'string')
              .map((item: { name: string }) => ({ id: item.name, name: item.name }))
          }
        }
      } catch {
        // Ignore fallback error
      }
    }

    return apiOk({
      models,
      total: models.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve models'
    return apiBadRequest(message)
  }
})
