'use client'

import React, { useEffect, useState } from 'react'

export default function McpOAuthCallbackPage() {
  const [status, setStatus] = useState<'processing' | 'done' | 'error'>('processing')
  const [message, setMessage] = useState('Completing MCP OAuth authorization…')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code') || undefined
    const state = params.get('state') || undefined
    const error = params.get('error_description') || params.get('error') || undefined

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: 'yggit-mcp-oauth-callback',
          code,
          state,
          error,
        },
        window.location.origin
      )
      setStatus(error ? 'error' : 'done')
      setMessage(error ? `Authorization failed: ${error}` : 'Authorization complete. You may close this window.')
      window.setTimeout(() => window.close(), 350)
    } else {
      setStatus('error')
      setMessage('Unable to communicate with the opener window. Please close this tab and retry.')
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6 text-center text-xs text-ink">
      <div className="max-w-sm rounded-xl border border-line bg-panel p-5 shadow-sm">
        <p className={status === 'error' ? 'font-semibold text-fail' : 'font-semibold text-ink'}>{message}</p>
      </div>
    </div>
  )
}
