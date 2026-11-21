'use client'

import React, { useEffect, useState } from 'react'
import { LuFolderGit2, LuLayers, LuListTodo, LuRefreshCw, LuSparkles, LuTrash2, LuWrench } from 'react-icons/lu'

import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button } from '@/components/sk'
import { clearAllTasks, listTasks, subscribeTasks } from '@/lib/agent/tasks/storage'
import type { AgentTask, AgentTaskStatus } from '@/lib/agent/tasks/types'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

export function TasksSettingsSection() {
  const notify = useNotification()
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | AgentTaskStatus>('all')
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    setLoading(true)
    const list = await listTasks(100)
    setTasks(list)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    return subscribeTasks(() => {
      void reload()
    })
  }, [])

  const handleClear = async () => {
    if (typeof window !== 'undefined' && !window.confirm('确定要清空全部 Agent 任务执行历史吗？')) return
    await clearAllTasks()
    notify.success('任务历史已清空')
  }

  const filteredTasks = tasks.filter((task) => (statusFilter === 'all' ? true : task.status === statusFilter))

  return (
    <div className="flex flex-col gap-3">
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuListTodo className="size-4 text-accent" />
            <span>Agent 任务执行链路 (Task Execution Traces)</span>
          </div>
        }
        description="追溯 Agent 接受用户任务、匹配技能、调用 MCP 工具、多轮推理与生成产物的全流程执行记录。"
        titleAction={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded border border-line bg-paper-2 p-0.5 text-xs">
              {[
                { label: '全部', value: 'all' as const },
                { label: '进行中', value: 'running' as const },
                { label: '已完成', value: 'completed' as const },
                { label: '失败', value: 'failed' as const },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStatusFilter(item.value)}
                  className={cn(
                    'px-2 py-1 rounded font-medium transition-colors cursor-pointer',
                    statusFilter === item.value ? 'bg-panel text-accent font-semibold shadow-xs' : 'text-ink-soft hover:text-ink'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="mini" onClick={() => void reload()} title="刷新">
              <LuRefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="mini" onClick={() => void handleClear()} title="清空任务记录">
              <LuTrash2 className="size-3.5 text-fail" />
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2.5">
          {filteredTasks.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-line rounded-lg bg-paper-2">
              <LuListTodo className="size-8 text-ink-soft/40 mb-2" />
              <div className="text-xs font-semibold text-ink">暂无任务记录</div>
              <p className="text-[11px] text-ink-soft max-w-sm mt-1">当您在工作区右侧 Agent 对话框提问或分配任务时，系统会自动记录完整的步骤与工具调用链路。</p>
            </div>
          )}

          {filteredTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id
            const isRunning = task.status === 'running'
            const isCompleted = task.status === 'completed'

            return (
              <div
                key={task.id}
                className={cn(
                  'flex flex-col rounded-lg border transition-all overflow-hidden',
                  isExpanded ? 'border-accent shadow-sm' : 'border-line hover:border-line-solid bg-panel'
                )}
              >
                {/* Task Header */}
                <div
                  className="flex items-center justify-between gap-3 p-3 bg-paper-2/40 cursor-pointer select-none"
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge tone={isRunning ? 'accent' : isCompleted ? 'ok' : 'fail'} size="mini" className={isRunning ? 'animate-pulse' : ''}>
                        {isRunning ? '执行中' : isCompleted ? '成功' : '失败'}
                      </Badge>
                      <span className="text-xs font-bold text-ink truncate">{task.title}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[11px] text-ink-soft font-mono">
                      <span>模型: {task.model}</span>
                      {task.repo && (
                        <span className="flex items-center gap-1">
                          <LuFolderGit2 className="size-3" />
                          <span>{task.repo}</span>
                        </span>
                      )}
                      <span>步骤: {task.steps.length} 步</span>
                      {task.durationMs && <span>耗时: {(task.durationMs / 1000).toFixed(1)}s</span>}
                      {task.tokenUsage && <span>Tokens: {task.tokenUsage.totalTokens.toLocaleString()}</span>}
                    </div>

                    {task.error && <p className="mt-1 text-[11px] text-fail font-mono line-clamp-1">错误: {task.error}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-ink-soft/70">{new Date(task.createdAt).toLocaleTimeString()}</span>
                    <Button variant="ghost" size="mini">
                      {isExpanded ? '收起' : '查看执行步骤'}
                    </Button>
                  </div>
                </div>

                {/* Expanded Steps Timeline */}
                {isExpanded && (
                  <div className="p-3 bg-panel border-t border-line/60 flex flex-col gap-2">
                    <div className="text-[11px] font-semibold text-ink-soft">执行步骤与调用明细 (Trace Steps)</div>

                    {task.steps.length === 0 ? (
                      <div className="py-2 text-xs text-ink-soft">任务初始化中，等待下一步…</div>
                    ) : (
                      <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
                        {task.steps.map((step) => {
                          const isSkill = step.type === 'skill_match'
                          const isTool = step.type === 'tool_call'
                          const isTurn = step.type === 'llm_turn'

                          return (
                            <div key={step.id} className="relative flex flex-col gap-1">
                              {/* Step dot */}
                              <div
                                className={cn(
                                  'absolute -left-6 top-1 size-2.5 rounded-full border-2 border-panel',
                                  isSkill ? 'bg-amber-500' : isTool ? 'bg-accent' : isTurn ? 'bg-sky-500' : 'bg-ink-soft'
                                )}
                              />

                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-ink">
                                  {isSkill ? (
                                    <LuSparkles className="size-3 text-amber-500" />
                                  ) : isTool ? (
                                    <LuWrench className="size-3 text-accent" />
                                  ) : (
                                    <LuLayers className="size-3 text-sky-500" />
                                  )}
                                  <span>{step.title}</span>
                                </div>
                                <span className="text-[10px] text-ink-soft font-mono">{new Date(step.timestamp).toLocaleTimeString()}</span>
                              </div>

                              {step.detail && <p className="text-[11px] text-ink-soft leading-relaxed">{step.detail}</p>}

                              {step.input !== undefined && (
                                <details className="text-[10px] text-ink-soft">
                                  <summary className="cursor-pointer hover:text-ink">查看入参 (Input)</summary>
                                  <pre className="mt-1 p-2 rounded bg-paper-2 font-mono overflow-x-auto text-ink">
                                    {typeof step.input === 'string' ? step.input : JSON.stringify(step.input, null, 2)}
                                  </pre>
                                </details>
                              )}

                              {step.output !== undefined && (
                                <details className="text-[10px] text-ink-soft">
                                  <summary className="cursor-pointer hover:text-ink">查看输出 (Output)</summary>
                                  <pre className="mt-1 p-2 rounded bg-paper-2 font-mono overflow-x-auto text-ink">
                                    {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                                  </pre>
                                </details>
                              )}

                              {step.tokenUsage && (
                                <div className="text-[10px] font-mono text-ink-soft">
                                  消耗 Tokens: {step.tokenUsage.totalTokens.toLocaleString()} (Prompt: {step.tokenUsage.promptTokens}, Completion:{' '}
                                  {step.tokenUsage.completionTokens})
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </SettingsSectionCard>
    </div>
  )
}
