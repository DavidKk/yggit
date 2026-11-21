import { buildMcpToolDefinitions } from '@/lib/agent/tools'
import { callMcpTool } from '@/lib/mcp/client'
import type { McpServerConfig } from '@/lib/mcp/types'
import { getWebMcpSupportReport } from '@/lib/mcp/webmcp'

describe('MCP Client & Tool Adapter', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('builds AgentToolDefinitions from enabled MCP servers', () => {
    const servers: McpServerConfig[] = [
      {
        id: 'srv-1',
        name: 'GitHub MCP',
        url: 'https://example.com/mcp',
        transport: 'streamable-http',
        auth: { type: 'bearer', token: 'secret' },
        enabled: true,
        tools: [
          {
            name: 'create_issue',
            description: 'Create a GitHub issue',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                body: { type: 'string' },
              },
              required: ['title'],
            },
            enabled: true,
            serverId: 'srv-1',
          },
          {
            name: 'delete_repo',
            description: 'Dangerous operation',
            enabled: false,
            serverId: 'srv-1',
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'srv-disabled',
        name: 'Disabled Server',
        url: 'https://example.com/disabled',
        transport: 'streamable-http',
        auth: { type: 'none' },
        enabled: false,
        tools: [
          {
            name: 'dummy_tool',
            enabled: true,
            serverId: 'srv-disabled',
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const definitions = buildMcpToolDefinitions(servers)
    expect(definitions).toHaveLength(1)
    expect(definitions[0].function.name).toBe('mcp__srv-1__create_issue')
    expect(definitions[0].function.description).toContain('[MCP: GitHub MCP] Create a GitHub issue')
    expect(definitions[0].function.parameters.required).toContain('title')
  })

  it('executes JSON-RPC tools/call and unpacks text content', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: '2.0',
        id: 'mcp_test',
        result: {
          content: [{ type: 'text', text: 'Issue #101 created successfully' }],
        },
      }),
    })

    const server: McpServerConfig = {
      id: 'srv-test',
      name: 'Test Server',
      url: 'https://example.com/mcp',
      transport: 'streamable-http',
      auth: { type: 'none' },
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
    }

    const res = await callMcpTool(server, 'create_issue', { title: 'Bug report' })
    expect(res.ok).toBe(true)
    expect(res.result).toBe('Issue #101 created successfully')
  })

  it('reports webmcp environment status safely', () => {
    const report = getWebMcpSupportReport()
    expect(report).toBeDefined()
    expect(typeof report.supported).toBe('boolean')
    expect(Array.isArray(report.hints)).toBe(true)
  })
})
