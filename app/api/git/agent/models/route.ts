import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest, apiOk } from '@/initializer/response'
import { assertAgentRequestAllowed } from '@/lib/security/agent-request-guard'
import { resolveStoredApiKey } from '@/lib/security/credential-vault'
import { assertSafeOutboundUrl } from '@/lib/security/ssrf'

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
    let id = rawId.trim()
    if (!id) return
    // Clean Gemini 'models/' prefix if present
    if (id.startsWith('models/')) {
      id = id.slice(7)
    }
    if (seen.has(id)) return
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
      const id = obj.id ?? obj.slug ?? obj.model ?? obj.model_name ?? obj.modelId ?? obj.name
      const name = obj.display_name ?? obj.name ?? obj.model_name ?? obj.slug ?? obj.id ?? obj.model
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
  const denied = assertAgentRequestAllowed(request)
  if (denied) return denied
  try {
    const payload = await request.json()
    const { baseUrl, apiKey, profileId, provider, modelsEndpoint } = payload
    const resolvedApiKey =
      typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : typeof profileId === 'string' && profileId.trim() ? resolveStoredApiKey(profileId.trim()) : undefined

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

    const isAnthropic = cleanBaseUrl.includes('anthropic.com') || provider === 'claude'
    const isGemini = cleanBaseUrl.includes('googleapis.com') || provider === 'gemini'
    const isVercelGateway = cleanBaseUrl.includes('ai-gateway.vercel.sh') || provider === 'vercel-free'

    if (isAnthropic) {
      if (resolvedApiKey) {
        headers['x-api-key'] = resolvedApiKey
        headers['anthropic-version'] = '2023-06-01'
      }
    } else if (isGemini) {
      if (resolvedApiKey) {
        headers['x-goog-api-key'] = resolvedApiKey
      }
    } else if (isVercelGateway) {
      if (resolvedApiKey) {
        headers['x-ai-gateway-api-key'] = resolvedApiKey
        headers['Authorization'] = `Bearer ${resolvedApiKey}`
      }
    } else if (resolvedApiKey) {
      headers['Authorization'] = `Bearer ${resolvedApiKey}`
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
    } else if (isGemini) {
      targetUrl = `${cleanBaseUrl}/models${resolvedApiKey ? `?key=${encodeURIComponent(resolvedApiKey)}` : ''}`
    } else {
      targetUrl = `${cleanBaseUrl}/models`
    }

    // Validate target URL against SSRF before making outbound request
    const safeTargetUrl = await assertSafeOutboundUrl(targetUrl)

    let models: ModelItem[] = []
    let lastError: string | null = null
    let lastStatus: number | null = null

    // Attempt 1: primary models catalog endpoint
    try {
      const response = await fetch(safeTargetUrl.toString(), {
        method: 'GET',
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(6000),
      })
      if (response.ok) {
        const json = await response.json().catch(() => null)
        models = extractModelsFromResponse(json)
      } else {
        lastStatus = response.status
        if (response.status === 401) {
          lastError = 'API Key 未填写或无效 (HTTP 401 Unauthorized)'
        } else if (response.status === 403) {
          lastError = '端点拒绝访问或缺少权限 (HTTP 403 Forbidden)'
        } else if (response.status === 404) {
          lastError = '端点未提供 /models 模型目录 (HTTP 404)'
        } else if (response.status === 429) {
          lastError = '请求频次受限或账户额度不足 (HTTP 429)'
        } else {
          lastError = `服务端返回异常状态 (HTTP ${response.status})`
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
          lastError = '连接超时，无法访问上游服务 (请检查网络或代理)'
        } else if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
          lastError = '网络连接失败，无法连接到端点 (请检查地址或网络代理)'
        } else {
          lastError = err.message
        }
      }
    }

    // Attempt 1.5: If primary returned 401/403 or failed when auth headers were attached,
    // retry WITHOUT auth headers (e.g. Vercel AI Gateway public /models catalog rejects unknown bearer tokens)
    if (models.length === 0 && apiKey) {
      try {
        const publicHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }
        const publicRes = await fetch(targetUrl, {
          method: 'GET',
          headers: publicHeaders,
          signal: AbortSignal.timeout(4000),
        })
        if (publicRes.ok) {
          const json = await publicRes.json().catch(() => null)
          models = extractModelsFromResponse(json)
        }
      } catch {
        // Fallback below
      }
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
          } else if (res.status === 401 || res.status === 403) {
            // Try without auth headers on /v1/models as well
            const noAuthRes = await fetch(v1Url, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              signal: AbortSignal.timeout(4000),
            })
            if (noAuthRes.ok) {
              const json = await noAuthRes.json().catch(() => null)
              models = extractModelsFromResponse(json)
            }
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
      status: lastStatus,
      message: models.length === 0 ? lastError || '未能从服务端读取到模型列表，使用预设清单' : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve models'
    return apiBadRequest(message)
  }
})
