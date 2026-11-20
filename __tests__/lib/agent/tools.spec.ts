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
    expect(toolNames).toContain('inspect_code_issue')
    expect(toolNames).toContain('navigate_ui')
    expect(toolNames).toContain('open_project')
    expect(toolNames).toContain('list_projects')
    expect(toolNames).toContain('set_ui_theme')

    const containmentTool = AGENT_GIT_TOOLS.find((t) => t.function.name === 'check_branch_containment')
    expect(containmentTool?.function.parameters.required).toEqual(['sourceBranch', 'targetBranch'])

    const navigateTool = AGENT_GIT_TOOLS.find((t) => t.function.name === 'navigate_ui')
    expect(navigateTool?.function.parameters.required).toEqual(['target'])

    const openProjTool = AGENT_GIT_TOOLS.find((t) => t.function.name === 'open_project')
    expect(openProjTool?.function.parameters.required).toEqual(['nameOrPath'])
  })

  it('handles client-side open_project and list_projects execution', async () => {
    // Mock getGitDriver for unit test
    const listRes = await executeAgentTool('list_projects', {})
    expect(listRes.ok).toBe(true)

    const openRes = await executeAgentTool('open_project', { nameOrPath: 'non_existent_123' })
    expect(openRes.ok).toBe(false)
  })

  it('handles client-side set_ui_theme execution', async () => {
    const themeRes = await executeAgentTool('set_ui_theme', { theme: 'dark' })
    expect(themeRes.ok).toBe(true)
    expect(themeRes.uiPreference).toEqual({ type: 'theme', value: 'dark' })
  })

  it('handles client-side navigate_ui execution', async () => {
    const res = await executeAgentTool('navigate_ui', { target: 'settings_models', reason: '打开设置' })
    expect(res.ok).toBe(true)
    expect(res.uiNavigation).toEqual({
      target: 'settings_models',
      reason: '打开设置',
    })
  })

  it('handles client-side inspect_code_issue execution', async () => {
    const res = await executeAgentTool('inspect_code_issue', {
      file: 'w.txt',
      startLine: 3,
      message: '测试问题标记',
    })
    expect(res.ok).toBe(true)
    expect(res.codeAnnotation?.file).toBe('w.txt')
    expect(res.codeAnnotation?.startLine).toBe(3)
    expect(res.codeAnnotation?.message).toBe('测试问题标记')
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
