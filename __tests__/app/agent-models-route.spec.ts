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

  it('supports custom modelsEndpoint for gateways like Magpie', async () => {
    let calledUrl = ''
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      calledUrl = url
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [
            { id: 'codex/gpt-6.1-sol', name: 'codex/gpt-6.1-sol' },
            { id: 'workbuddy/deepseek-v4-pro', name: 'workbuddy/deepseek-v4-pro' },
            { id: 'workbuddy/hy4flash-free', name: 'workbuddy/hy4flash-free' },
          ],
        }),
      })
    }) as any

    const req = new Request('http://localhost/api/git/agent/models', {
      method: 'POST',
      body: JSON.stringify({
        baseUrl: 'https://magpie.corp.com/v1',
        modelsEndpoint: '/codex/models',
        apiKey: 'magpie-token',
      }),
    })
    const res = await POST(req as any, {} as any)
    expect(res.status).toBe(200)
    expect(calledUrl).toBe('https://magpie.corp.com/codex/models')
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.models).toHaveLength(3)
    expect(json.models.map((m: any) => m.id)).toContain('codex/gpt-6.1-sol')
    expect(json.models.map((m: any) => m.id)).toContain('workbuddy/deepseek-v4-pro')
  })

  it('parses diverse gateway response formats (raw arrays, models field, routing groups)', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routing_groups: [{ name: 'workbuddy-ai/hy4flash-free' }, { id: 'workbuddy/deepseek-v4.1-flash' }],
      }),
    }) as any

    const req = new Request('http://localhost/api/git/agent/models', {
      method: 'POST',
      body: JSON.stringify({
        baseUrl: 'https://magpie.corp.com/v1',
        modelsEndpoint: 'https://magpie.corp.com/v1/models',
      }),
    })
    const res = await POST(req as any, {} as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.models).toHaveLength(2)
    expect(json.models[0].id).toBe('workbuddy-ai/hy4flash-free')
    expect(json.models[1].id).toBe('workbuddy/deepseek-v4.1-flash')
  })
})
