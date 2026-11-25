import { isAllowedAgentPath } from '@/lib/security/agent-paths'
import { assertAgentRequestAllowed } from '@/lib/security/agent-request-guard'

describe('agent-request-guard', () => {
  it('allows only workspace paths with Agent UI', () => {
    expect(isAllowedAgentPath('/git')).toBe(true)
    expect(isAllowedAgentPath('/git/owner/repo')).toBe(true)
    expect(isAllowedAgentPath('/repo/owner/repo')).toBe(true)
    expect(isAllowedAgentPath('/workdesk')).toBe(true)
    expect(isAllowedAgentPath('/workdesk/tasks/123')).toBe(true)
    expect(isAllowedAgentPath('/settings/models')).toBe(true)

    expect(isAllowedAgentPath('/')).toBe(false)
    expect(isAllowedAgentPath('/privacy')).toBe(false)
    expect(isAllowedAgentPath('/import')).toBe(false)
    expect(isAllowedAgentPath('/dev/studio')).toBe(false)
    expect(isAllowedAgentPath('/github')).toBe(false)
  })

  it('rejects cross-origin, missing referer, and disallowed referer paths with 403', () => {
    // Homepage referer rejected
    const fromHome = new Request('http://localhost:3001/api/git/agent/profiles', {
      method: 'GET',
      headers: {
        host: 'localhost:3001',
        referer: 'http://localhost:3001/',
        'sec-fetch-site': 'same-origin',
      },
    })
    expect(assertAgentRequestAllowed(fromHome)?.status).toBe(403)

    // Cross-site Sec-Fetch-Site rejected
    const crossSite = new Request('http://localhost:3001/api/git/agent/gateway', {
      method: 'POST',
      headers: {
        host: 'localhost:3001',
        origin: 'https://evil.example.com',
        referer: 'http://localhost:3001/git/repo',
        'sec-fetch-site': 'cross-site',
      },
    })
    expect(assertAgentRequestAllowed(crossSite)?.status).toBe(403)

    // Different port / origin mismatch rejected
    const wrongPort = new Request('http://localhost:3001/api/git/agent/gateway', {
      method: 'POST',
      headers: {
        host: 'localhost:3001',
        origin: 'http://localhost:3002',
        referer: 'http://localhost:3002/git/repo',
        'sec-fetch-site': 'same-site',
      },
    })
    expect(assertAgentRequestAllowed(wrongPort)?.status).toBe(403)

    // Missing referer rejected
    const noReferer = new Request('http://localhost:3001/api/git/agent/profiles', {
      method: 'GET',
      headers: {
        host: 'localhost:3001',
        'sec-fetch-site': 'none',
      },
    })
    expect(assertAgentRequestAllowed(noReferer)?.status).toBe(403)

    // Valid same-origin workspace request allowed
    const valid = new Request('http://localhost:3001/api/git/agent/gateway', {
      method: 'POST',
      headers: {
        host: 'localhost:3001',
        origin: 'http://localhost:3001',
        referer: 'http://localhost:3001/git/my-repo',
        'sec-fetch-site': 'same-origin',
      },
    })
    expect(assertAgentRequestAllowed(valid)).toBeNull()
  })
})
