import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest, apiOk } from '@/initializer/response'

export const runtime = 'nodejs'

interface ModelItem {
  id: string
  name: string
}

/**
 * Parses diverse model catalogue payloads from OpenAI, Anthropic, Magpie, Ollama, LiteLLM, vLLM, etc.
 */
function extractModelsFromResponse(json: unknown): ModelItem[] {
  if (!json) return []
  const results: ModelItem[] = []
  const seen = new Set<string>()

  function addModel(rawId: unknown, rawName?: unknown) {
    if (typeof rawId !== 'string') return
    const id = rawId.trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : id
    results.push({ id, name })
  }

  function processItem(item: unknown) {
    if (typeof item === 'string') {
      addModel(item)
      return
    }
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>
      const id = obj.id ?? obj.model ?? obj.model_name ?? obj.modelId ?? obj.name
      const name = obj.name ?? obj.model_name ?? obj.id ?? obj.model
      if (id) {
        addModel(id, name)
      } else if (obj.provider && obj.model) {
        addModel(`${obj.provider}/${obj.model}`)
      }
    }
  }

  if (Array.isArray(json)) {
    for (const item of json) processItem(item)
  } else if (typeof json === 'object') {
    const obj = json as Record<string, unknown>
    const candidates = [obj.data, obj.models, obj.result, obj.list, obj.items]
    for (const cand of candidates) {
      if (Array.isArray(cand)) {
        for (const item of cand) processItem(item)
      }
    }
    // Gateway routing groups or providers catalog (Magpie / LiteLLM)
    if (results.length === 0 && Array.isArray(obj.routing_groups)) {
      for (const rg of obj.routing_groups) {
        processItem(rg)
      }
    }
  }

  return results
}

/**
 * Server-side route to fetch available models from an upstream LLM endpoint.
 * Supports custom models catalog endpoints (e.g. for Magpie, Ollama, custom gateways).
 * Protects client from CORS boundaries and adheres to zero-storage for API keys.
 */
export const POST = defineApiRoute('post:/api/git/agent/models', async ({ request }) => {
  try {
    const payload = await request.json()
    const { baseUrl, apiKey, provider, modelsEndpoint } = payload

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
      Accept: 'application/json',
    }

    if (cleanBaseUrl.includes('anthropic.com')) {
      if (apiKey) {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
      }
    } else if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    // Determine target URL for models catalogue
    let targetUrl: string
    const ep = typeof modelsEndpoint === 'string' ? modelsEndpoint.trim() : ''
    if (ep) {
      if (ep.startsWith('http://') || ep.startsWith('https://')) {
        targetUrl = ep
      } else if (ep.startsWith('/')) {
        targetUrl = `${parsed.origin}${ep}`
      } else {
        targetUrl = `${cleanBaseUrl}/${ep}`
      }
    } else {
      targetUrl = `${cleanBaseUrl}/models`
    }

    let models: ModelItem[] = []

    // Attempt 1: primary models catalog endpoint
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(6000),
      })

      if (response.ok) {
        const json = await response.json().catch(() => null)
        models = extractModelsFromResponse(json)
      }
    } catch {
      // Fallback below
    }

    // Attempt 2: if primary failed and no custom endpoint was given, try /v1/models
    if (models.length === 0 && !ep) {
      const v1Url = cleanBaseUrl.endsWith('/v1') ? `${cleanBaseUrl}/models` : `${cleanBaseUrl}/v1/models`
      if (v1Url !== targetUrl) {
        try {
          const res = await fetch(v1Url, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(4000),
          })
          if (res.ok) {
            const json = await res.json().catch(() => null)
            models = extractModelsFromResponse(json)
          }
        } catch {
          // Ignore fallback error
        }
      }
    }

    // Attempt 3: If Ollama and /models didn't yield anything, try /api/tags
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
          models = extractModelsFromResponse(ollamaJson)
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
