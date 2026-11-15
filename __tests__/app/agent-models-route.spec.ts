import { POST } from '@/app/api/git/agent/models/route'

describe('Agent models API route', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('rejects missing or invalid baseUrl', async () => {
    const req = new Request('http://localhost/api/git/agent/models', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req as any, {} as any)
    expect(res.status).toBe(400)
  })

  it('fetches OpenAI-compatible models successfully', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
      }),
    }) as any

    const req = new Request('http://localhost/api/git/agent/models', {
      method: 'POST',
      body: JSON.stringify({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
      }),
    })
    const res = await POST(req as any, {} as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.models).toHaveLength(2)
    expect(json.models[0].id).toBe('gpt-4o')
  })
})
