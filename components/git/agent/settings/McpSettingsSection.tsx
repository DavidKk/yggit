'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { LuChevronRight, LuGlobe, LuNetwork, LuPlus, LuServer } from 'react-icons/lu'

import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, SwitchToggle } from '@/components/sk'
import { listMcpServers, subscribeMcp, toggleMcpServer } from '@/lib/mcp/storage'
import type { McpServerConfig, WebMcpSupportReport } from '@/lib/mcp/types'
import { getWebMcpSupportReport } from '@/lib/mcp/webmcp'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

export function McpSettingsSection() {
  const router = useRouter()
  const notify = useNotification()
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [loading, setLoading] = useState(true)

  // WebMCP report
  const [webMcpReport, setWebMcpReport] = useState<WebMcpSupportReport | null>(null)

  const reload = async () => {
    setLoading(true)
    const list = await listMcpServers()
    setServers(list)
    setLoading(false)
  }

  useEffect(() => {
    setWebMcpReport(getWebMcpSupportReport())
    void reload()
    return subscribeMcp(() => {
      void reload()
    })
  }, [])

  const handleToggleServer = async (id: string, current: boolean) => {
    await toggleMcpServer(id, !current)
    notify.success(current ? 'MCP Server 已停用' : 'MCP Server 已启用')
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 1. WebMCP Native Support */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuGlobe className="size-4 text-accent" />
            <span>原生 WebMCP 环境支持检测 (W3C WebMCP 标准草案)</span>
          </div>
        }
        description="检测当前浏览器是否原生支持 WebMCP 客户端/服务端接入规范及本地工具暴露能力。"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-line bg-paper-2/40">
            <div className="flex items-center gap-2.5">
              {webMcpReport?.supported ? <div className="size-2.5 rounded-full bg-ok shadow-xs shrink-0" /> : <div className="size-2.5 rounded-full bg-fail shadow-xs shrink-0" />}
              <div>
                <span className="text-xs font-semibold text-ink">WebMCP 标准支持状态</span>
                <p className="text-[11px] text-ink-soft">
                  {webMcpReport?.supported
                    ? '当前浏览器环境支持 WebMCP 标准客户端连接规范。'
                    : '当前浏览器未开启原生 navigator.modelContextProtocol 支持（可使用下方 HTTP MCP Server 方式）。'}
                </p>
              </div>
            </div>
            <Badge tone={webMcpReport?.supported ? 'ok' : 'neutral'} size="mini">
              {webMcpReport?.supported ? '原生已就绪' : '未检测到'}
            </Badge>
          </div>

          {webMcpReport?.hints && webMcpReport.hints.length > 0 && (
            <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-line/60 bg-paper-2/20 text-xs text-ink-soft">
              <span className="font-semibold text-ink">如何开启 Chrome / Edge 原生 WebMCP 实验性特性:</span>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                {webMcpReport.hints.map((hint: string, i: number) => (
                  <li key={i}>{hint}</li>
                ))}
              </ul>
              <div className="text-[11px] text-ink-soft mt-1">提示：未启用 WebMCP 不影响使用下方的标准 HTTP MCP Server 服务。</div>
            </div>
          )}
        </div>
      </SettingsSectionCard>

      {/* 2. HTTP MCP Server Manager */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuNetwork className="size-4 text-accent" />
            <span>HTTP MCP Server 管理 (Model Context Protocol)</span>
          </div>
        }
        description="连接外部 HTTP MCP Server 工具与数据源，支持 Streamable HTTP 协议及 Bearer Token 鉴权。点击卡片进入详情管理工具列表。"
        titleAction={
          <Button variant="accent" onClick={() => router.push('/settings/mcp/new')}>
            <LuPlus className="size-3.5 mr-1" />
            <span>添加 HTTP MCP Server</span>
          </Button>
        }
      >
        <div className="flex flex-col gap-2.5">
          {servers.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-line rounded-lg bg-paper-2">
              <LuServer className="size-8 text-ink-soft/40 mb-2" />
              <div className="text-xs font-semibold text-ink">暂未连接任何 MCP Server</div>
              <p className="text-[11px] text-ink-soft max-w-sm mt-1">点击右上角“添加 HTTP MCP Server”接入您的外部 MCP 工具服务。所有工具调用将在本地安全执行。</p>
            </div>
          )}

          {servers.map((s) => {
            const isConnected = s.status === 'connected'
            const isError = s.status === 'error'
            const toolCount = s.tools?.length || 0

            return (
              <div
                key={s.id}
                className={cn(
                  'flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors',
                  s.enabled ? 'border-line bg-panel hover:border-line-solid' : 'border-line/40 bg-paper-2/60 opacity-60'
                )}
              >
                <Link
                  href={`/settings/mcp/${encodeURIComponent(s.id)}`}
                  className="min-w-0 flex-1 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                  aria-label={`查看或配置 ${s.name}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink group-hover:text-accent transition-colors">{s.name}</span>
                    <Badge tone={isConnected ? 'ok' : isError ? 'fail' : 'neutral'} size="mini">
                      {isConnected ? '已连接' : isError ? '连接异常' : '未连接'}
                    </Badge>
                    <Badge tone="neutral" size="mini">
                      Streamable HTTP
                    </Badge>
                    <span className="text-[11px] text-ink-soft font-mono">{toolCount} 个工具可用</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-ink-soft font-mono truncate">
                    <span>URL: {s.url}</span>
                    <span>鉴权: {s.auth.type === 'bearer' ? 'Bearer Token' : '无认证'}</span>
                  </div>
                  {s.lastError && <p className="mt-1 text-[11px] text-fail font-mono line-clamp-1">错误: {s.lastError}</p>}
                </Link>

                <div className="flex items-center gap-3 shrink-0">
                  <SwitchToggle
                    checked={s.enabled}
                    onCheckedChange={() => void handleToggleServer(s.id, s.enabled)}
                    size="sm"
                    tooltip={s.enabled ? '停用此 Server' : '启用此 Server'}
                    aria-label={`启用或停用 ${s.name}`}
                  />
                  <Link href={`/settings/mcp/${encodeURIComponent(s.id)}`} className="text-ink-soft/40 hover:text-ink transition-colors p-1" title="管理工具与配置">
                    <LuChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </SettingsSectionCard>
    </div>
  )
}
