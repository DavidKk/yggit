import { NextResponse } from 'next/server'

import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import { readGitBlob } from '@/services/git/blob'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/blob', async ({ request }) => {
  const url = new URL(request.url)
  try {
    const { buffer, contentType, binary } = await readGitBlob({
      repo: url.searchParams.get('repo') || undefined,
      hash: url.searchParams.get('hash') || '',
      path: url.searchParams.get('path') || '',
    })
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'Content-Length': String(buffer.length),
        'X-Git-Binary': binary ? '1' : '0',
      },
    })
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : 'git 失败')
  }
})
