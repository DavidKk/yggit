'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { LuActivity, LuCoins, LuCpu, LuLayers, LuRefreshCw, LuTrash2, LuZap } from 'react-icons/lu'

import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button } from '@/components/sk'
import { clearAllTokenMetrics, getTokenMetricsSummary, subscribeTokenMetrics } from '@/lib/agent/metrics/storage'
import type { TokenMetricsSummary } from '@/lib/agent/metrics/types'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`
  return num.toLocaleString()
}

export function TokenMetricsSection() {
  const notify = useNotification()
  const [days, setDays] = useState<number>(30)
  const [summary, setSummary] = useState<TokenMetricsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const data = await getTokenMetricsSummary(days)
    setSummary(data)
    setLoading(false)
  }, [days])

  useEffect(() => {
    void reload()
    return subscribeTokenMetrics(() => {
      void reload()
    })
  }, [reload])

  const handleClear = async () => {
    if (typeof window !== 'undefined' && !window.confirm('确定要清空全部 Token 消耗统计记录吗？')) return
    await clearAllTokenMetrics()
    notify.success('Token 统计历史已清空')
  }

  const totalTokens = summary?.totalTokens || 0
  const maxModelTokens = summary?.byModel?.[0]?.totalTokens || 1

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Header Toolbar & Range Filter */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuCoins className="size-4 text-accent" />
            <span>Token 使用统计与分析 (Token Observability)</span>
          </div>
        }
        description="统计 Agent 各模型 Prompt 传入、Completion 传出、上下文缓存命中及延迟消耗。Edge 模式存储于 IndexedDB，Local 模式存储于本地。"
        titleAction={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded border border-line bg-paper-2 p-0.5 text-xs">
              {[
                { label: '近 7 天', value: 7 },
                { label: '近 30 天', value: 30 },
                { label: '近 90 天', value: 90 },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDays(item.value)}
                  className={cn(
                    'px-2 py-1 rounded font-medium transition-colors cursor-pointer',
                    days === item.value ? 'bg-panel text-accent font-semibold shadow-xs' : 'text-ink-soft hover:text-ink'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="mini" onClick={() => void reload()} title="刷新统计">
              <LuRefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="mini" onClick={() => void handleClear()} title="清空统计">
              <LuTrash2 className="size-3.5 text-fail" />
            </Button>
          </div>
        }
      >
        {/* KPI Volume Cards - Inspired by ticket-janitor MetricsVolumeCards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Total Tokens */}
          <div className="flex flex-col gap-1 p-3 rounded-lg border border-line bg-paper-2/60">
            <div className="flex items-center justify-between text-[11px] font-semibold text-ink-soft">
              <span>总 Token 消耗</span>
              <LuCoins className="size-3.5 text-accent" />
            </div>
            <div className="text-xl font-bold font-mono text-ink mt-0.5">{formatNumber(summary?.totalTokens || 0)}</div>
            <span className="text-[10px] text-ink-soft/80">包含输入与输出完整计费单位</span>
          </div>

          {/* Card 2: Prompt Tokens */}
          <div className="flex flex-col gap-1 p-3 rounded-lg border border-line bg-paper-2/60">
            <div className="flex items-center justify-between text-[11px] font-semibold text-ink-soft">
              <span>输入 Tokens (Prompt)</span>
              <LuLayers className="size-3.5 text-sky-500" />
            </div>
            <div className="text-xl font-bold font-mono text-sky-500 mt-0.5">{formatNumber(summary?.totalPromptTokens || 0)}</div>
            <span className="text-[10px] text-ink-soft/80">占比 {totalTokens > 0 ? Math.round(((summary?.totalPromptTokens || 0) / totalTokens) * 100) : 0}%</span>
          </div>

          {/* Card 3: Completion Tokens */}
          <div className="flex flex-col gap-1 p-3 rounded-lg border border-line bg-paper-2/60">
            <div className="flex items-center justify-between text-[11px] font-semibold text-ink-soft">
              <span>输出 Tokens (Completion)</span>
              <LuZap className="size-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-500 mt-0.5">{formatNumber(summary?.totalCompletionTokens || 0)}</div>
            <span className="text-[10px] text-ink-soft/80">占比 {totalTokens > 0 ? Math.round(((summary?.totalCompletionTokens || 0) / totalTokens) * 100) : 0}%</span>
          </div>

          {/* Card 4: Cached Tokens & Hit Rate */}
          <div className="flex flex-col gap-1 p-3 rounded-lg border border-line bg-paper-2/60">
            <div className="flex items-center justify-between text-[11px] font-semibold text-ink-soft">
              <span>上下文缓存命中</span>
              <Badge tone="ok" size="mini">
                {summary?.cacheHitRate || 0}% 命中率
              </Badge>
            </div>
            <div className="text-xl font-bold font-mono text-ink mt-0.5">{formatNumber(summary?.totalCachedTokens || 0)}</div>
            <span className="text-[10px] text-ink-soft/80">平均延迟 {summary?.averageLatencyMs || 0}ms</span>
          </div>
        </div>

        {/* Breakdown by Model & Purpose */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
          {/* Models Breakdown */}
          <div className="flex flex-col gap-2 p-3 rounded-lg border border-line bg-panel">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <LuCpu className="size-3.5 text-accent" />
              <span>按模型分布 (By Model)</span>
            </div>
            {summary?.byModel && summary.byModel.length > 0 ? (
              <div className="flex flex-col gap-2.5 mt-1">
                {summary.byModel.map((item) => {
                  const percent = Math.round((item.totalTokens / maxModelTokens) * 100)
                  return (
                    <div key={item.model} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-medium text-ink truncate max-w-[200px]" title={item.model}>
                          {item.model}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] font-mono">
                          <span className="text-ink-soft">{item.requestCount} 次调用</span>
                          <span className="font-bold text-ink">{formatNumber(item.totalTokens)}</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-paper-2 overflow-hidden flex">
                        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-ink-soft">暂无模型调用数据</div>
            )}
          </div>

          {/* Purpose Breakdown */}
          <div className="flex flex-col gap-2 p-3 rounded-lg border border-line bg-panel">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <LuActivity className="size-3.5 text-accent" />
              <span>按用途分布 (By Purpose)</span>
            </div>
            {summary?.byPurpose && summary.byPurpose.length > 0 ? (
              <div className="flex flex-col gap-2.5 mt-1">
                {summary.byPurpose.map((item) => {
                  const purposeLabels: Record<string, string> = {
                    chat: '对话问答 (Chat)',
                    diagnostic: 'Git 智能诊断 (Diagnostic)',
                    git_action: '分支与提交操作 (Git Action)',
                    task: '自动化任务 (Task)',
                  }
                  const label = purposeLabels[item.purpose] || item.purpose
                  return (
                    <div key={item.purpose} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">{label}</span>
                        <div className="flex items-center gap-2 text-[11px] font-mono">
                          <span className="text-ink-soft">{item.requestCount} 次</span>
                          <span className="font-bold text-ink">{formatNumber(item.totalTokens)}</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-paper-2 overflow-hidden flex">
                        <div
                          className="h-full bg-sky-500 transition-all duration-300"
                          style={{
                            width: `${totalTokens > 0 ? (item.totalTokens / totalTokens) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-ink-soft">暂无用途分布数据</div>
            )}
          </div>
        </div>

        {/* Detailed Records Table */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="text-xs font-bold text-ink">最近调用记录 (Recent Invocation Logs)</div>
          <div className="rounded-lg border border-line overflow-hidden">
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-paper-2 text-ink-soft font-semibold border-b border-line sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2">时间</th>
                    <th className="px-3 py-2">模型</th>
                    <th className="px-3 py-2">用途</th>
                    <th className="px-3 py-2 text-right">输入 Prompt</th>
                    <th className="px-3 py-2 text-right">输出 Completion</th>
                    <th className="px-3 py-2 text-right">缓存命中</th>
                    <th className="px-3 py-2 text-right">总 Tokens</th>
                    <th className="px-3 py-2 text-right">延迟</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-panel font-mono">
                  {summary?.records && summary.records.length > 0 ? (
                    summary.records.slice(0, 50).map((r) => (
                      <tr key={r.id} className="hover:bg-paper-2/60 transition-colors">
                        <td className="px-3 py-1.5 text-ink-soft whitespace-nowrap">{new Date(r.timestamp).toLocaleTimeString()}</td>
                        <td className="px-3 py-1.5 font-medium text-ink truncate max-w-[150px]">{r.model}</td>
                        <td className="px-3 py-1.5 text-ink-soft capitalize">{r.purpose}</td>
                        <td className="px-3 py-1.5 text-right text-sky-500">{r.promptTokens.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-emerald-500">{r.completionTokens.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-ink-soft">{r.cachedTokens > 0 ? r.cachedTokens.toLocaleString() : '-'}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-ink">{r.totalTokens.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-ink-soft">{r.latencyMs ? `${r.latencyMs}ms` : '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-xs text-ink-soft">
                        暂无调用记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
