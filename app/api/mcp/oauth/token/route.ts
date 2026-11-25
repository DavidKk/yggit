import { NextResponse } from 'next/server'

interface ProxyRequestBody {
  action?: 'fetch'
  targetUrl?: string
  method?: string
  headers?: Record<string, string>
  body?: string
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProxyRequestBody
    const targetUrl = payload.targetUrl?.trim()
    if (!targetUrl) {
      return NextResponse.json({ error: 'targetUrl is required' }, { status: 400 })
    }

    let parsed: URL
    try {
      parsed = new URL(targetUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid targetUrl' }, { status: 400 })
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Only HTTP/HTTPS targets are allowed' }, { status: 400 })
    }

    const method = payload.method === 'POST' ? 'POST' : 'GET'
    const upstream = await fetch(parsed.toString(), {
      method,
      headers: {
        Accept: 'application/json',
        ...(payload.headers || {}),
      },
      body: method === 'POST' ? payload.body : undefined,
    })

    const text = await upstream.text()
    try {
      const json = JSON.parse(text) as unknown
      return NextResponse.json(json, { status: upstream.status })
    } catch {
      return NextResponse.json({ error: text.slice(0, 400) || upstream.statusText }, { status: upstream.status })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth proxy request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
