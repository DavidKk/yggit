'use client'

import React, { useEffect, useState } from 'react'
import { LuBug, LuCheck, LuCopy, LuDownload, LuRefreshCw, LuScrollText, LuSearch, LuTrash2 } from 'react-icons/lu'

import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button } from '@/components/sk'
import { copyToClipboard } from '@/lib/clipboard'
import { clearAllLogs, generateIssueReportMarkdown, loadPersistedLogs, type LogLevel, type LogModule, type ServiceLogEntry, subscribeLogs } from '@/lib/logger'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

export function LogsSettingsSection() {
  const notify = useNotification()
  const [logs, setLogs] = useState<ServiceLogEntry[]>([])
  const [levelFilter, setLevelFilter] = useState<'all' | LogLevel>('all')
  const [moduleFilter, setModuleFilter] = useState<'all' | LogModule>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedIssue, setCopiedIssue] = useState(false)
  const [loading, setLoading] = useState(false)

  const reload = async () => {
    setLoading(true)
    const list = await loadPersistedLogs(200)
    setLogs(list)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    return subscribeLogs((newLogs) => {
      setLogs(newLogs)
    })
  }, [])

  const handleCopyIssue = async () => {
    const md = generateIssueReportMarkdown(logs)
    const ok = await copyToClipboard(md)
    if (ok) {
      setCopiedIssue(true)
      notify.success('已复制标准化 Issue 报告，可直接粘贴至 GitHub/GitLab')
      setTimeout(() => setCopiedIssue(false), 2500)
    } else {
      notify.error('复制失败，请检查剪贴板权限')
    }
  }

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `yggit-logs-${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    notify.success('日志已导出为 JSON 文件')
  }

  const handleClear = async () => {
    if (typeof window !== 'undefined' && !window.confirm('确定要清空全部服务诊断日志吗？')) return
    await clearAllLogs()
    notify.success('日志已清空')
  }

  const filteredLogs = logs.filter((entry) => {
    if (levelFilter !== 'all' && entry.level !== levelFilter) return false
    if (moduleFilter !== 'all' && entry.module !== moduleFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const inMsg = entry.message.toLowerCase().includes(q)
      const inDetails = entry.details?.toLowerCase().includes(q)
      if (!inMsg && !inDetails) return false
    }
    return true
  })

  return (
    <div className="flex flex-col gap-3">
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuScrollText className="size-4 text-accent" />
            <span>服务运行与诊断日志 (Service Logs & Issue Report)</span>
          </div>
        }
        description="记录 Agent 运行时、MCP 工具调用、Skill 加载与 Git 驱动事件。支持一键导出标准化报告以便提交 Issue 排查。"
        titleAction={
          <div className="flex items-center gap-2">
            <Button variant="accent" size="mini" onClick={() => void handleCopyIssue()}>
              {copiedIssue ? <LuCheck className="size-3.5 mr-1 text-white" /> : <LuCopy className="size-3.5 mr-1" />}
              <span>一键复制 Issue 报告</span>
            </Button>
            <Button variant="default" size="mini" onClick={handleExportJson}>
              <LuDownload className="size-3.5 mr-1" />
              <span>导出 JSON</span>
            </Button>
            <Button variant="ghost" size="mini" onClick={() => void reload()} title="刷新日志">
              <LuRefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="mini" onClick={() => void handleClear()} title="清空日志">
              <LuTrash2 className="size-3.5 text-fail" />
            </Button>
          </div>
        }
      >
        {/* Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Level Filter */}
            <div className="flex items-center rounded border border-line bg-paper-2 p-0.5 text-xs">
              {[
                { label: '全部级别', value: 'all' as const },
                { label: 'Error', value: 'error' as const },
                { label: 'Warn', value: 'warn' as const },
                { label: 'Info', value: 'info' as const },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setLevelFilter(item.value)}
                  className={cn(
                    'px-2 py-1 rounded font-medium transition-colors cursor-pointer',
                    levelFilter === item.value ? 'bg-panel text-accent font-semibold shadow-xs' : 'text-ink-soft hover:text-ink'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Module Filter */}
            <div className="flex items-center rounded border border-line bg-paper-2 p-0.5 text-xs">
              {[
                { label: '全部模块', value: 'all' as const },
                { label: 'Agent', value: 'agent' as const },
                { label: 'MCP', value: 'mcp' as const },
                { label: 'Skill', value: 'skill' as const },
                { label: 'Git', value: 'git' as const },
                { label: 'System', value: 'system' as const },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setModuleFilter(item.value)}
                  className={cn(
                    'px-2 py-1 rounded font-medium transition-colors cursor-pointer',
                    moduleFilter === item.value ? 'bg-panel text-accent font-semibold shadow-xs' : 'text-ink-soft hover:text-ink'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative flex items-center min-w-[200px]">
            <LuSearch className="absolute left-2.5 size-3.5 text-ink-soft/60 pointer-events-none" />
            <input
              type="text"
              placeholder="搜索日志关键字…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded border border-line bg-panel pl-8 pr-2.5 text-xs text-ink placeholder:text-ink-soft/60 outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Logs Table / Stream */}
        <div className="rounded-lg border border-line overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto divide-y divide-line/60 bg-panel font-mono text-[11px]">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-ink-soft">
                <LuBug className="size-6 text-ink-soft/40 mb-1.5" />
                <span>暂无符合条件的日志</span>
              </div>
            ) : (
              filteredLogs.map((entry) => {
                const isErr = entry.level === 'error'
                const isWarn = entry.level === 'warn'

                return (
                  <div key={entry.id} className="flex flex-col p-2.5 hover:bg-paper-2/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-ink-soft text-[10px] shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        <Badge tone={isErr ? 'fail' : isWarn ? 'warn' : 'neutral'} size="mini" className="shrink-0 uppercase text-[9px]">
                          {entry.level}
                        </Badge>
                        <Badge tone="accent" size="mini" className="shrink-0 uppercase text-[9px]">
                          {entry.module}
                        </Badge>
                        <span className={cn('truncate font-medium', isErr ? 'text-fail font-semibold' : 'text-ink')}>{entry.message}</span>
                      </div>
                    </div>

                    {entry.details && (
                      <details className="mt-1.5 text-[10px] text-ink-soft">
                        <summary className="cursor-pointer hover:text-ink">查看详细上下文与调用栈</summary>
                        <pre className="mt-1 p-2 rounded bg-paper-2 text-ink whitespace-pre-wrap overflow-x-auto leading-relaxed border border-line/40">{entry.details}</pre>
                      </details>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
