import { AGENT_GIT_TOOLS, executeAgentTool } from '@/lib/agent/tools'

describe('Agent Git Tools', () => {
  it('exports expected git tools schemas for LLM function calling', () => {
    const toolNames = AGENT_GIT_TOOLS.map((t) => t.function.name)
    expect(toolNames).toContain('get_unmerged_branches')
    expect(toolNames).toContain('get_branches')
    expect(toolNames).toContain('get_repo_summary')
    expect(toolNames).toContain('check_branch_containment')
    expect(toolNames).toContain('get_today_merges')
    expect(toolNames).toContain('find_commits')
    expect(toolNames).toContain('get_commit_details')
    expect(toolNames).toContain('spotlight_commits')

    const containmentTool = AGENT_GIT_TOOLS.find((t) => t.function.name === 'check_branch_containment')
    expect(containmentTool?.function.parameters.required).toEqual(['sourceBranch', 'targetBranch'])
  })

  it('handles client-side spotlight_commits execution directly', async () => {
    const targets = [
      {
        hash: 'abcdef1234567890abcdef1234567890abcdef12',
        role: 'primary' as const,
        evidenceGrade: 'Fact' as const,
        reason: 'Contaminating commit',
      },
    ]

    const response = await executeAgentTool('spotlight_commits', { targets })
    expect(response.ok).toBe(true)
    expect(response.spotlightTargets).toHaveLength(1)
    expect(response.spotlightTargets?.[0].hash).toBe('abcdef1234567890abcdef1234567890abcdef12')
  })
})
