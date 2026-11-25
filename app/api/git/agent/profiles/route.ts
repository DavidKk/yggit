import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest, apiOk } from '@/initializer/response'
import type { AgentModelProfile } from '@/lib/agent/model-profiles'
import { assertAgentRequestAllowed } from '@/lib/security/agent-request-guard'
import { deleteStoredProfile, listStoredProfiles, saveStoredProfile, setActiveStoredProfile } from '@/lib/security/credential-vault'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/agent/profiles', async ({ request }) => {
  const denied = assertAgentRequestAllowed(request)
  if (denied) return denied
  const data = listStoredProfiles()
  return apiOk({ stored: data })
})

export const POST = defineApiRoute('post:/api/git/agent/profiles', async ({ request }) => {
  const denied = assertAgentRequestAllowed(request)
  if (denied) return denied
  try {
    const body = (await request.json()) as {
      action?: string
      profileId?: string
      profile?: AgentModelProfile
      clearApiKey?: boolean
      setActive?: boolean
    }

    if (body?.action === 'select' && body.profileId) {
      setActiveStoredProfile(body.profileId)
      return apiOk({ stored: listStoredProfiles() })
    }

    if (!body?.profile || typeof body.profile.id !== 'string' || !body.profile.config) {
      return apiBadRequest('Invalid profile payload')
    }

    const stored = saveStoredProfile(body.profile, {
      clearApiKey: Boolean(body.clearApiKey),
      setActive: body.setActive !== false,
    })
    return apiOk({ stored })
  } catch (err) {
    return apiBadRequest(err instanceof Error ? err.message : 'Failed to save profile')
  }
})

export const DELETE = defineApiRoute('delete:/api/git/agent/profiles', async ({ request }) => {
  const denied = assertAgentRequestAllowed(request)
  if (denied) return denied
  const url = new URL(request.url)
  const id = url.searchParams.get('id')?.trim()
  if (!id) {
    return apiBadRequest('Missing profile id')
  }
  const stored = deleteStoredProfile(id)
  return apiOk({ stored })
})
