import { NextResponse } from 'next/server'

import { isAllowedAgentPath } from '@/lib/security/agent-paths'

function resolveExpectedOrigin(request: Request): string {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host')?.trim()
  if (!host) return url.origin
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const proto = forwardedProto || url.protocol.replace(/:$/, '') || 'http'
  return `${proto}://${host}`
}

function forbidden(message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: { code: 'FORBIDDEN', message },
    },
    { status: 403 }
  )
}

/**
 * Enforces strict same-origin and allowed workspace Referer path checks on Agent endpoints.
 * Rejects cross-origin requests, direct non-same-origin requests, and calls from disallowed pages (e.g. homepage "/").
 */
export function assertAgentRequestAllowed(request: Request): NextResponse | null {
  const expectedOrigin = resolveExpectedOrigin(request)

  const secFetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase()
  if (secFetchSite && secFetchSite !== 'same-origin') {
    return forbidden('Cross-origin or non-same-origin Agent request rejected')
  }

  const originHeader = request.headers.get('origin')?.trim()
  if (originHeader) {
    if (originHeader !== expectedOrigin) {
      return forbidden('Origin mismatch on Agent request')
    }
  } else if (request.method.toUpperCase() !== 'GET') {
    return forbidden('Missing Origin header on Agent request')
  }

  const refererHeader = request.headers.get('referer')?.trim()
  if (!refererHeader) {
    return forbidden('Missing Referer header on Agent request')
  }

  let refererUrl: URL
  try {
    refererUrl = new URL(refererHeader)
  } catch {
    return forbidden('Invalid Referer header on Agent request')
  }

  if (refererUrl.origin !== expectedOrigin) {
    return forbidden('Referer origin mismatch on Agent request')
  }

  if (!isAllowedAgentPath(refererUrl.pathname)) {
    return forbidden(`Agent access is not permitted from path "${refererUrl.pathname}"`)
  }

  return null
}
