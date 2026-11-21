import { addStepToTask, clearAllTasks, completeTask, createTask, failTask, listTasks } from '@/lib/agent/tasks/storage'

describe('Agent Tasks Storage', () => {
  beforeEach(async () => {
    await clearAllTasks()
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
