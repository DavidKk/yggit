'use client'

import React, { useEffect, useState } from 'react'
import { LuCircleAlert, LuCircleCheck, LuGlobe, LuNetwork, LuPlus, LuRefreshCw, LuServer, LuTrash2, LuWrench } from 'react-icons/lu'

import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, Modal } from '@/components/sk'
import { testAndDiscoverMcpServer } from '@/lib/mcp/client'
import { deleteMcpServer, listMcpServers, saveMcpServer, subscribeMcp, toggleMcpServer, toggleMcpTool } from '@/lib/mcp/storage'
import type { McpServerConfig, WebMcpSupportReport } from '@/lib/mcp/types'
import { getWebMcpSupportReport } from '@/lib/mcp/webmcp'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

export function McpSettingsSection() {
  const notify = useNotification()
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)

  // WebMCP report
  const [webMcpReport, setWebMcpReport] = useState<WebMcpSupportReport | null>(null)

  // New server form
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [authType, setAuthType] = useState<'none' | 'bearer'>('none')
  const [token, setToken] = useState('')

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

  const handleTestServer = async (server: McpServerConfig) => {
    setTestingId(server.id)
    try {
      const res = await testAndDiscoverMcpServer(server)
      if (res.ok) {
        await saveMcpServer({
          ...server,
          status: 'connected',
          tools: res.tools,
          resources: res.resources,
          prompts: res.prompts,
          lastError: undefined,
          lastCheckedAt: Date.now(),
        })
        notify.success(`连接成功！发现 ${res.tools.length} 个工具`)
      } else {
        await saveMcpServer({
          ...server,
          status: 'error',
          lastError: res.error,
          lastCheckedAt: Date.now(),
        })
        notify.error(`连接失败: ${res.error}`)
      }
    } finally {
      setTestingId(null)
    }
  }

  const handleAddServer = async () => {
    if (!name.trim() || !url.trim()) {
      notify.error('请填写完整 Server 名称与 URL')
      return
    }

    const newServer: McpServerConfig = {
      id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      url: url.trim(),
      transport: 'streamable-http',
      auth: {
        type: authType,
        token: authType === 'bearer' ? token.trim() : undefined,
      },
      enabled: true,
      status: 'disconnected',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await saveMcpServer(newServer)
    notify.success(`已添加 MCP Server: ${newServer.name}`)
    setAddModalOpen(false)
    setName('')
    setUrl('')
    setToken('')

    // Immediately test connection in background
    void handleTestServer(newServer)
  }

  const handleDelete = async (id: string) => {
    await deleteMcpServer(id)
    notify.success('MCP Server 已移除')
  }

  const handleToggleServer = async (id: string, current: boolean) => {
    await toggleMcpServer(id, !current)
    notify.success(current ? '已停用 MCP Server' : '已启用 MCP Server')
  }

  const handleToggleTool = async (serverId: string, toolName: string, current: boolean) => {
    await toggleMcpTool(serverId, toolName, !current)
    notify.success(current ? `已停用工具 ${toolName}` : `已启用工具 ${toolName}`)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 1. In-page WebMCP Status Banner */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuGlobe className="size-4 text-accent" />
            <span>浏览器 WebMCP 运行环境 (In-Page Model Context)</span>
          </div>
        }
        description="检测原生浏览器 WebMCP API (document.modelContext)。支持将 Yggdrasil 页面与工作区工具直接暴露给客户端 Agent。"
      >
        <div className="flex items-start gap-3 p-3 rounded-lg border border-line bg-paper-2">
          {webMcpReport?.supported ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
              <LuCircleCheck className="size-4 shrink-0 text-emerald-500" />
              <span>当前浏览器已启用原生 WebMCP API (document.modelContext)。</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 text-xs text-ink-soft">
              <div className="flex items-center gap-2 font-semibold text-warn">
                <LuCircleAlert className="size-4 shrink-0 text-warn" />
                <span>浏览器原生 WebMCP 未启用或当前版本暂不支持</span>
              </div>
              <ul className="list-disc ml-5 space-y-0.5 text-[11px] leading-relaxed">
                {webMcpReport?.hints.map((hint, idx) => (
                  <li key={idx}>{hint}</li>
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
        description="连接外部 HTTP MCP Server 工具与数据源，支持 Streamable HTTP 协议及 Bearer Token 鉴权。"
        titleAction={
          <Button variant="accent" size="mini" onClick={() => setAddModalOpen(true)}>
            <LuPlus className="size-3.5 mr-1" />
            <span>添加 HTTP MCP Server</span>
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
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
            const isTesting = testingId === s.id
            const toolCount = s.tools?.length || 0

            return (
              <div key={s.id} className="flex flex-col rounded-lg border border-line bg-panel overflow-hidden shadow-xs">
                {/* Header Row */}
                <div className="flex items-center justify-between gap-3 p-3 border-b border-line/60 bg-paper-2/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink">{s.name}</span>
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
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="default" size="mini" loading={isTesting} onClick={() => void handleTestServer(s)} title="测试连接并刷新工具列表">
                      <LuRefreshCw className="size-3.5 mr-1" />
                      <span>测试 & 刷新</span>
                    </Button>
                    <Button variant={s.enabled ? 'default' : 'accent'} size="mini" onClick={() => void handleToggleServer(s.id, s.enabled)}>
                      {s.enabled ? '停用' : '启用'}
                    </Button>
                    <Button variant="ghost" size="mini" onClick={() => void handleDelete(s.id)} title="移除 Server">
                      <LuTrash2 className="size-3.5 text-fail" />
                    </Button>
                  </div>
                </div>

                {/* Discovered Tools List */}
                {toolCount > 0 ? (
                  <div className="p-3 bg-panel flex flex-col gap-2">
                    <div className="text-[11px] font-semibold text-ink-soft flex items-center gap-1.5">
                      <LuWrench className="size-3 text-accent" />
                      <span>已发现工具 ({toolCount})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {s.tools?.map((tool) => (
                        <div
                          key={tool.name}
                          className={cn(
                            'flex items-start justify-between gap-2 p-2 rounded border transition-colors',
                            tool.enabled ? 'border-line bg-paper-2' : 'border-line/40 bg-paper-2/40 opacity-50'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-ink">{tool.name}</span>
                              <Badge tone={tool.enabled ? 'ok' : 'neutral'} size="mini">
                                {tool.enabled ? '可调用' : '已禁用'}
                              </Badge>
                            </div>
                            {tool.description && <p className="text-[11px] text-ink-soft line-clamp-2 mt-0.5 leading-relaxed">{tool.description}</p>}
                          </div>
                          <Button variant="ghost" size="mini" onClick={() => void handleToggleTool(s.id, tool.name, tool.enabled)}>
                            {tool.enabled ? '禁用' : '启用'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </SettingsSectionCard>

      {/* Add HTTP MCP Server Modal */}
      {addModalOpen && (
        <Modal
          open={addModalOpen}
          title="添加 HTTP MCP Server"
          description="输入符合 Model Context Protocol 协议的 Streamable HTTP 服务地址。"
          onClose={() => setAddModalOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="plain" size="md" onClick={() => setAddModalOpen(false)}>
                取消
              </Button>
              <Button variant="accent" size="md" onClick={() => void handleAddServer()}>
                保存并连接
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink">Server 名称</label>
              <input
                type="text"
                placeholder="例如: GitHub MCP / Database MCP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink">HTTP Endpoint URL</label>
              <input
                type="text"
                placeholder="https://example.com/mcp 或 http://localhost:8080/mcp"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink">认证类型</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                  <input type="radio" name="authType" checked={authType === 'none'} onChange={() => setAuthType('none')} />
                  <span>无认证 (None)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                  <input type="radio" name="authType" checked={authType === 'bearer'} onChange={() => setAuthType('bearer')} />
                  <span>Bearer Token</span>
                </label>
              </div>
            </div>
            {authType === 'bearer' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">Bearer Token</label>
                <input
                  type="password"
                  placeholder="输入 Token 凭证"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
                />
                <p className="text-[10px] text-ink-soft">Token 仅保存在本地设备存储中，不上传任何中间服务器。</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
