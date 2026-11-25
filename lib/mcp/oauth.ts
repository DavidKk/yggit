'use client'

import type { McpOAuthConfig } from './types'

export interface DiscoveredOAuthMetadata {
  authorizationEndpoint?: string
  tokenEndpoint?: string
  registrationEndpoint?: string
  scopesSupported?: string[]
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateRandomString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

async function computePkceChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return base64UrlEncode(new Uint8Array(digest))
}

async function fetchJsonWithProxyFallback(url: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
  try {
    const direct = await fetch(url, init)
    if (direct.ok) {
      return (await direct.json()) as Record<string, unknown>
    }
  } catch {
    // Fall back to local server proxy when CORS blocks browser discovery
  }

  try {
    const proxied = await fetch('/api/mcp/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'fetch',
        targetUrl: url,
        method: init?.method || 'GET',
        headers: init?.headers || {},
        body: typeof init?.body === 'string' ? init.body : undefined,
      }),
    })
    if (proxied.ok) {
      return (await proxied.json()) as Record<string, unknown>
    }
  } catch {
    // Ignore proxy failure
  }
  return null
}

/**
 * Discovers OAuth 2.0 / 2.1 authorization metadata for an MCP server URL
 * following RFC 9728 (Protected Resource Metadata) and RFC 8414 (Authorization Server Metadata).
 */
export async function discoverMcpOAuthMetadata(serverUrl: string): Promise<DiscoveredOAuthMetadata> {
  const parsed = new URL(serverUrl)
  const origin = parsed.origin
  let authOrigin = origin

  const resourceMeta = await fetchJsonWithProxyFallback(`${origin}/.well-known/oauth-protected-resource`)
  if (resourceMeta && Array.isArray(resourceMeta.authorization_servers) && typeof resourceMeta.authorization_servers[0] === 'string') {
    try {
      authOrigin = new URL(resourceMeta.authorization_servers[0]).origin
    } catch {
      authOrigin = origin
    }
  }

  const authMeta =
    (await fetchJsonWithProxyFallback(`${authOrigin}/.well-known/oauth-authorization-server`)) ||
    (await fetchJsonWithProxyFallback(`${authOrigin}/.well-known/openid-configuration`))

  if (!authMeta) {
    return {}
  }

  return {
    authorizationEndpoint: typeof authMeta.authorization_endpoint === 'string' ? authMeta.authorization_endpoint : undefined,
    tokenEndpoint: typeof authMeta.token_endpoint === 'string' ? authMeta.token_endpoint : undefined,
    registrationEndpoint: typeof authMeta.registration_endpoint === 'string' ? authMeta.registration_endpoint : undefined,
    scopesSupported: Array.isArray(authMeta.scopes_supported) ? authMeta.scopes_supported.filter((s): s is string => typeof s === 'string') : undefined,
  }
}

/**
 * Attempts Dynamic Client Registration (RFC 7591) when a registration endpoint is available and no clientId is set.
 */
async function registerDynamicClient(registrationEndpoint: string, redirectUri: string): Promise<{ clientId: string; clientSecret?: string } | null> {
  const payload = JSON.stringify({
    client_name: 'Yggit MCP Client',
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  })

  const data = await fetchJsonWithProxyFallback(registrationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  })

  if (data && typeof data.client_id === 'string') {
    return {
      clientId: data.client_id,
      clientSecret: typeof data.client_secret === 'string' ? data.client_secret : undefined,
    }
  }
  return null
}

/**
 * Runs a complete generic MCP OAuth 2.1 Authorization Code + PKCE popup flow.
 */
export async function startMcpOAuthFlow(serverUrl: string, currentConfig?: McpOAuthConfig): Promise<McpOAuthConfig> {
  if (typeof window === 'undefined') {
    throw new Error('OAuth flow can only be initiated in a browser context.')
  }

  const redirectUri = `${window.location.origin}/settings/mcp/oauth/callback`
  const discovered = await discoverMcpOAuthMetadata(serverUrl)

  const authorizationEndpoint = currentConfig?.authorizationEndpoint?.trim() || discovered.authorizationEndpoint
  const tokenEndpoint = currentConfig?.tokenEndpoint?.trim() || discovered.tokenEndpoint
  const registrationEndpoint = currentConfig?.registrationEndpoint?.trim() || discovered.registrationEndpoint

  if (!authorizationEndpoint || !tokenEndpoint) {
    throw new Error('Unable to discover OAuth authorization/token endpoints. Please provide them manually.')
  }

  let clientId = currentConfig?.clientId?.trim()
  let clientSecret = currentConfig?.clientSecret?.trim()

  if (!clientId && registrationEndpoint) {
    const registered = await registerDynamicClient(registrationEndpoint, redirectUri)
    if (registered) {
      clientId = registered.clientId
      clientSecret = registered.clientSecret || clientSecret
    }
  }

  if (!clientId) {
    throw new Error('OAuth Client ID is required (server did not support Dynamic Client Registration).')
  }

  const state = generateRandomString(24)
  const codeVerifier = generateRandomString(48)
  const codeChallenge = await computePkceChallenge(codeVerifier)

  const authUrl = new URL(authorizationEndpoint)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  const scope = currentConfig?.scope?.trim() || discovered.scopesSupported?.join(' ')
  if (scope) {
    authUrl.searchParams.set('scope', scope)
  }

  const popup = window.open(authUrl.toString(), 'yggit_mcp_oauth', 'width=560,height=700,menubar=no,toolbar=no,status=no')
  if (!popup) {
    throw new Error('OAuth popup was blocked by the browser. Please allow popups for this site.')
  }

  const authCode = await new Promise<string>((resolve, reject) => {
    let settled = false
    const timer = window.setInterval(() => {
      if (popup.closed && !settled) {
        settled = true
        cleanup()
        reject(new Error('OAuth authorization window was closed before completing.'))
      }
    }, 400)

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const msg = event.data as { type?: string; code?: string; state?: string; error?: string } | null
      if (!msg || msg.type !== 'yggit-mcp-oauth-callback') return
      if (msg.state !== state) return

      settled = true
      cleanup()
      if (msg.error) {
        reject(new Error(`OAuth authorization failed: ${msg.error}`))
      } else if (msg.code) {
        resolve(msg.code)
      } else {
        reject(new Error('OAuth callback did not include an authorization code.'))
      }
    }

    const cleanup = () => {
      window.clearInterval(timer)
      window.removeEventListener('message', handleMessage)
    }

    window.addEventListener('message', handleMessage)
  })

  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  })
  if (clientSecret) {
    tokenParams.set('client_secret', clientSecret)
  }

  const tokenResponse = await fetchJsonWithProxyFallback(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: tokenParams.toString(),
  })

  if (!tokenResponse || typeof tokenResponse.access_token !== 'string') {
    const errDesc =
      tokenResponse && typeof tokenResponse.error_description === 'string'
        ? tokenResponse.error_description
        : tokenResponse && typeof tokenResponse.error === 'string'
          ? tokenResponse.error
          : 'Failed to exchange authorization code for access token.'
    throw new Error(errDesc)
  }

  const expiresIn = typeof tokenResponse.expires_in === 'number' ? tokenResponse.expires_in : undefined

  return {
    clientId,
    clientSecret,
    authorizationEndpoint,
    tokenEndpoint,
    registrationEndpoint,
    scope,
    accessToken: tokenResponse.access_token,
    refreshToken: typeof tokenResponse.refresh_token === 'string' ? tokenResponse.refresh_token : currentConfig?.refreshToken,
    tokenType: typeof tokenResponse.token_type === 'string' ? tokenResponse.token_type : 'Bearer',
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
  }
}
