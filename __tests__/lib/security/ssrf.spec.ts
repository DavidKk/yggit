import { assertSafeOutboundUrl } from '@/lib/security/ssrf'

describe('SSRF outbound URL validation', () => {
  const originalVercel = process.env.VERCEL

  afterEach(() => {
    if (originalVercel === undefined) delete process.env.VERCEL
    else process.env.VERCEL = originalVercel
  })

  it('rejects non-http protocols', async () => {
    await expect(assertSafeOutboundUrl('file:///etc/passwd')).rejects.toThrow('Disallowed URL protocol')
    await expect(assertSafeOutboundUrl('gopher://127.0.0.1:6379/_INFO')).rejects.toThrow('Disallowed URL protocol')
  })

  it('rejects URLs with embedded credentials', async () => {
    await expect(assertSafeOutboundUrl('https://user:pass@api.openai.com/v1')).rejects.toThrow('embedded credentials')
  })

  it('always blocks cloud metadata endpoints even in local mode', async () => {
    delete process.env.VERCEL
    await expect(assertSafeOutboundUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow('metadata')
    await expect(assertSafeOutboundUrl('http://100.100.100.200/latest/meta-data/')).rejects.toThrow('metadata')
    await expect(assertSafeOutboundUrl('http://metadata.google.internal/computeMetadata/v1/')).rejects.toThrow('metadata')
  })

  it('blocks localhost and private IPs in remote/Vercel mode', async () => {
    process.env.VERCEL = '1'
    await expect(assertSafeOutboundUrl('http://localhost:11434/api/tags')).rejects.toThrow('not allowed in remote mode')
    await expect(assertSafeOutboundUrl('http://127.0.0.1:8080/v1')).rejects.toThrow('private or reserved')
    await expect(assertSafeOutboundUrl('http://10.0.0.5/api')).rejects.toThrow('private or reserved')
    await expect(assertSafeOutboundUrl('http://192.168.1.10/api')).rejects.toThrow('private or reserved')
    await expect(assertSafeOutboundUrl('http://172.16.0.1/api')).rejects.toThrow('private or reserved')
  })

  it('allows public HTTPS URLs in remote/Vercel mode', async () => {
    process.env.VERCEL = '1'
    const parsed = await assertSafeOutboundUrl('https://api.openai.com/v1/models')
    expect(parsed.hostname).toBe('api.openai.com')
  })

  it('allows localhost in local mode for local LLM servers', async () => {
    delete process.env.VERCEL
    const parsed = await assertSafeOutboundUrl('http://localhost:11434/api/tags')
    expect(parsed.hostname).toBe('localhost')
  })
})
