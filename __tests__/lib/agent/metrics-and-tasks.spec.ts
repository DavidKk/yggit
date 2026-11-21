import { clearAllTokenMetrics, getTokenMetricsSummary, recordTokenUsage } from '@/lib/agent/metrics/storage'
import { addStepToTask, clearAllTasks, completeTask, createTask, failTask, listTasks } from '@/lib/agent/tasks/storage'

describe('Agent Token Metrics & Tasks Storage', () => {
  beforeEach(async () => {
    await clearAllTokenMetrics()
    await clearAllTasks()
  })

  it('records token usage and aggregates summary by model and purpose', async () => {
    await recordTokenUsage({
      model: 'gpt-4o',
      purpose: 'chat',
      promptTokens: 1000,
      completionTokens: 200,
      cachedTokens: 800,
      totalTokens: 1200,
      latencyMs: 1200,
      status: 'success',
    })

    await recordTokenUsage({
      model: 'gpt-4o',
      purpose: 'diagnostic',
      promptTokens: 500,
      completionTokens: 100,
      cachedTokens: 0,
      totalTokens: 600,
      latencyMs: 800,
      status: 'success',
    })

    const summary = await getTokenMetricsSummary(30)
    expect(summary.totalPromptTokens).toBe(1500)
    expect(summary.totalCompletionTokens).toBe(300)
    expect(summary.totalCachedTokens).toBe(800)
    expect(summary.totalTokens).toBe(1800)
    expect(summary.totalRequests).toBe(2)
    expect(summary.averageLatencyMs).toBe(1000)

    expect(summary.byModel.find((m) => m.model === 'gpt-4o')?.totalTokens).toBe(1800)
    expect(summary.byPurpose.find((p) => p.purpose === 'chat')?.totalTokens).toBe(1200)
    expect(summary.byPurpose.find((p) => p.purpose === 'diagnostic')?.totalTokens).toBe(600)
  })

  it('tracks agent task lifecycle with step timeline', async () => {
    const task = await createTask({
      title: 'Review PR #42',
      prompt: 'Please check concurrency and resource leaks',
      model: 'claude-3-7-sonnet',
      repo: 'admin',
    })

    expect(task.status).toBe('running')

    await addStepToTask(task.id, {
      type: 'skill_match',
      title: 'Matched Skill: Go Concurrency Review',
    })

    await addStepToTask(task.id, {
      type: 'tool_call',
      title: 'Execute Tool: get_file_diff',
      input: { file: 'main.go' },
      output: '+ go routine without wg.Wait()',
      status: 'success',
    })

    await completeTask(task.id, {
      tokenUsage: { promptTokens: 1200, completionTokens: 400, totalTokens: 1600 },
    })

    const list = await listTasks()
    const recorded = list.find((t) => t.id === task.id)
    expect(recorded).toBeDefined()
    expect(recorded?.status).toBe('completed')
    expect(recorded?.steps).toHaveLength(2)
    expect(recorded?.steps[0].type).toBe('skill_match')
    expect(recorded?.steps[1].type).toBe('tool_call')
    expect(recorded?.tokenUsage?.totalTokens).toBe(1600)
  })

  it('records task failure', async () => {
    const task = await createTask({
      title: 'Broken task',
      prompt: 'crash',
      model: 'test-model',
    })

    await failTask(task.id, 'API gateway timeout')
    const list = await listTasks()
    const recorded = list.find((t) => t.id === task.id)
    expect(recorded?.status).toBe('failed')
    expect(recorded?.error).toBe('API gateway timeout')
  })
})
