import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest, apiOk } from '@/initializer/response'
import { detectInstalledClis, discoverCliModels, runCliCompletion, testCliConnection } from '@/lib/agent/cli-runner'
import type { AgentChatMessage, AgentProviderType } from '@/lib/agent/types'
import { assertAgentRequestAllowed } from '@/lib/security/agent-request-guard'
import { resolveStoredApiKey } from '@/lib/security/credential-vault'

export const runtime = 'nodejs'

export const POST = defineApiRoute('post:/api/git/agent/cli', async ({ request }) => {
  const denied = assertAgentRequestAllowed(request)
  if (denied) return denied

  try {
    const body = (await request.json()) as {
      action?: 'detect' | 'test' | 'models' | 'chat'
      provider?: AgentProviderType
      cliCommand?: string
      model?: string
      apiKey?: string
      profileId?: string
      messages?: AgentChatMessage[]
      cwd?: string
    }

    const action = body?.action || 'detect'

    if (action === 'detect') {
      const installed = await detectInstalledClis()
      return apiOk({ installed })
    }

    const provider = body?.provider
    if (!provider) {
      return apiBadRequest('Missing CLI provider')
    }

    if (action === 'test') {
      const result = await testCliConnection(provider, body.cliCommand)
      if (!result.ok) {
        return apiBadRequest(result.error || 'CLI connection test failed')
      }
      return apiOk(result)
    }

    if (action === 'models') {
      const models = await discoverCliModels(provider, body.cliCommand)
      return apiOk({ models })
    }

    if (action === 'chat') {
      const messages = Array.isArray(body.messages) ? body.messages : []
      const resolvedApiKey =
        typeof body.apiKey === 'string' && body.apiKey.trim()
          ? body.apiKey.trim()
          : typeof body.profileId === 'string' && body.profileId.trim()
            ? resolveStoredApiKey(body.profileId.trim())
            : undefined

      const result = await runCliCompletion({
        provider,
        model: body.model,
        cliCommand: body.cliCommand,
        apiKey: resolvedApiKey,
        messages,
        cwd: body.cwd,
      })
      return apiOk(result)
    }

    return apiBadRequest(`Unsupported CLI action: ${action}`)
  } catch (err) {
    return apiBadRequest(err instanceof Error ? err.message : 'CLI execution failed')
  }
})
