import { parseFallbackToolCalls, stripToolCodeBlocks } from '@/lib/agent/fallback-tool-parser'

describe('parseFallbackToolCalls', () => {
  const allowed = new Set(['get_branches', 'find_commits', 'get_unmerged_branches'])

  it('extracts bare tool name from tool_code block and strips the block', () => {
    const input = '好的，我来统计当前分支数量。\n\n```tool_code\nget_branches\n```'
    const { toolCalls, cleanedContent } = parseFallbackToolCalls(input, allowed)

    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].function.name).toBe('get_branches')
    expect(toolCalls[0].function.arguments).toBe('{}')
    expect(cleanedContent).toBe('好的，我来统计当前分支数量。')
  })

  it('extracts call with keyword arguments', () => {
    const input = '```tool_code\nfind_commits(query="fix", limit=10)\n```'
    const { toolCalls, cleanedContent } = parseFallbackToolCalls(input, allowed)

    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].function.name).toBe('find_commits')
    expect(JSON.parse(toolCalls[0].function.arguments)).toEqual({ query: 'fix', limit: 10 })
    expect(cleanedContent).toBe('')
  })

  it('extracts JSON tool call blocks', () => {
    const input = '```json\n{"name": "get_unmerged_branches", "arguments": {"base": "main"}}\n```'
    const { toolCalls } = parseFallbackToolCalls(input, allowed)

    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].function.name).toBe('get_unmerged_branches')
    expect(JSON.parse(toolCalls[0].function.arguments)).toEqual({ base: 'main' })
  })

  it('ignores normal code blocks that do not match allowed tool names', () => {
    const input = 'Here is an example:\n```ts\nconst x = 1\n```'
    const { toolCalls, cleanedContent } = parseFallbackToolCalls(input, allowed)

    expect(toolCalls).toHaveLength(0)
    expect(cleanedContent).toBe(input)
  })

  it('strips closed and unclosed streaming tool_code blocks from user-facing text', () => {
    expect(stripToolCodeBlocks('总共有281个分支。\n\n```tool_code\nget_branches()\n```')).toBe('总共有281个分支。')
    expect(stripToolCodeBlocks('正在统计...\n```tool_code\nget_branches')).toBe('正在统计...')
  })
})
