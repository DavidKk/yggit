'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { LuNetwork, LuPlus, LuRefreshCw, LuServer, LuTrash2, LuWrench } from 'react-icons/lu'

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, SwitchToggle } from '@/components/sk'
import { testAndDiscoverMcpServer } from '@/lib/mcp/client'
import { deleteMcpServer, listMcpServers, saveMcpServer, toggleMcpServer, toggleMcpTool } from '@/lib/mcp/storage'
import type { McpServerConfig } from '@/lib/mcp/types'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

interface McpServerEditorProps {
  serverId: string
}

export function McpServerEditor({ serverId }: McpServerEditorProps) {
  const router = useRouter()
  const notify = useNotification()
  const confirm = useConfirm()

  const isNew = serverId === 'new'
  const [server, setServer] = useState<McpServerConfig | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [testing, setTesting] = useState(false)

  // New server form
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [authType, setAuthType] = useState<'none' | 'bearer'>('none')
  const [token, setToken] = useState('')

  // Load existing server
  useEffect(() => {
    if (isNew) return
    let active = true
    void (async () => {
      setLoading(true)
      const list = await listMcpServers()
      const found = list.find((s) => s.id === serverId)
      if (active) {
        if (found) {
          setServer(found)
        }
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [serverId, isNew])

  const handleBack = () => {
    router.replace('/settings/mcp')
  }

  // Create new server
  const handleCreateServer = async () => {
    if (!name.trim()) {
      notify.error('请输入 Server 名称')
      return
    }
    if (!url.trim()) {
      notify.error('请输入 Server URL')
      return
    }

    setTesting(true)
    const now = Date.now()
    const newServer: McpServerConfig = {
      id: `mcp-${now}`,
      name: name.trim(),
      url: url.trim(),
      transport: 'streamable-http',
      auth: authType === 'bearer' ? { type: 'bearer', token: token.trim() } : { type: 'none' },
      enabled: true,
      status: 'disconnected',
      createdAt: now,
      updatedAt: now,
    }

    try {
      const res = await testAndDiscoverMcpServer(newServer)
      if (res.ok) {
        newServer.status = 'connected'
        newServer.tools = res.tools
        newServer.resources = res.resources
        newServer.prompts = res.prompts
        newServer.lastCheckedAt = Date.now()
        notify.success(`成功连接并发现 ${res.tools.length} 个工具`)
      } else {
        newServer.status = 'error'
        newServer.lastError = res.error
        notify.warning(`保存配置，但连接测试未通过: ${res.error}`)
      }
    } catch (err) {
      newServer.status = 'error'
      newServer.lastError = err instanceof Error ? err.message : '连接失败'
      notify.warning('保存配置，外部服务未响应')
    } finally {
      await saveMcpServer(newServer)
      setTesting(false)
      router.replace('/settings/mcp')
    }
  }

  // Test and refresh tools for existing server
  const handleTestExisting = async () => {
    if (!server) return
    setTesting(true)
    try {
      const res = await testAndDiscoverMcpServer(server)
      if (res.ok) {
        const updated: McpServerConfig = {
          ...server,
          status: 'connected',
          tools: res.tools,
          resources: res.resources,
          prompts: res.prompts,
          lastError: undefined,
          lastCheckedAt: Date.now(),
        }
        await saveMcpServer(updated)
        setServer(updated)
        notify.success(`连接正常，已同步 ${res.tools.length} 个工具`)
      } else {
        const updated: McpServerConfig = {
          ...server,
          status: 'error',
          lastError: res.error,
          lastCheckedAt: Date.now(),
        }
        await saveMcpServer(updated)
        setServer(updated)
        notify.error(`连接失败: ${res.error}`)
      }
    } catch (err) {
      const updated: McpServerConfig = {
        ...server,
        status: 'error',
        lastError: err instanceof Error ? err.message : '网络请求失败',
      }
      await saveMcpServer(updated)
      setServer(updated)
      notify.error('测试连接失败')
    } finally {
      setTesting(false)
    }
  }

  // Toggle server enabled
  const handleToggleServer = async () => {
    if (!server) return
    await toggleMcpServer(server.id, !server.enabled)
    setServer({ ...server, enabled: !server.enabled })
    notify.success(server.enabled ? 'MCP Server 已停用' : 'MCP Server 已启用')
  }

  // Toggle tool enabled
  const handleToggleTool = async (toolName: string, current: boolean) => {
    if (!server) return
    await toggleMcpTool(server.id, toolName, !current)
    const updatedTools = (server.tools || []).map((t) => (t.name === toolName ? { ...t, enabled: !current } : t))
    setServer({ ...server, tools: updatedTools })
  }

  // Delete server
  const handleDelete = () => {
    if (!server) return
    confirm({
      title: '移除 MCP Server',
      description: `确定要移除「${server.name}」吗？移除后 Agent 将无法使用该 Server 提供的外部工具。`,
      confirmLabel: '移除',
      confirmVariant: 'fail',
      onConfirm: async () => {
        await deleteMcpServer(server.id)
        notify.success('已移除 MCP Server')
        router.replace('/settings/mcp')
      },
    })
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-ink-soft">
        <LuRefreshCw className="size-4 animate-spin mr-2 text-accent" />
        <span>加载 MCP Server 配置中…</span>
      </div>
    )
  }

  if (!isNew && !server) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-line rounded-lg bg-paper-2">
        <LuServer className="size-8 text-ink-soft/40 mb-2" />
        <div className="text-xs font-semibold text-ink">未找到该 MCP Server</div>
        <p className="text-[11px] text-ink-soft max-w-sm mt-1">此 Server 可能已被移除或 ID 不存在。</p>
        <Button variant="default" onClick={handleBack} className="mt-3">
          返回
        </Button>
      </div>
    )
  }

  // 1. New MCP Server Subpage
  if (isNew) {
    return (
      <div className="flex flex-col gap-3">
        <SettingsSectionCard
          title={
            <div className="flex items-center gap-2">
              <LuNetwork className="size-4 text-accent" />
              <span>添加 HTTP MCP Server</span>
            </div>
          }
          description="遵循官方 Model Context Protocol 协议规范。支持 Streamable HTTP 协议传输与 Bearer Token 鉴权。"
          titleAction={
            <Button variant="plain" size="sm" onClick={handleBack}>
              返回
            </Button>
          }
        >
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink">Server 名称标识</label>
              <input
                type="text"
                placeholder="例如: GitHub MCP Server 或 Local DB Tools"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink">HTTP 协议地址 (URL)</label>
              <input
                type="url"
                placeholder="https://mcp.github.com/ 或 http://localhost:8000/mcp"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-ink">认证与鉴权方式</label>
              <div className="flex items-center gap-4 text-xs text-ink">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="authType" checked={authType === 'none'} onChange={() => setAuthType('none')} />
                  <span>无认证 (None)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="authType" checked={authType === 'bearer'} onChange={() => setAuthType('bearer')} />
                  <span>Bearer Token</span>
                </label>
              </div>
            </div>

            {authType === 'bearer' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-ink">Bearer Token 密钥</label>
                <input
                  type="password"
                  placeholder="输入 Bearer Token 授权字符串"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="h-8 rounded border border-line bg-panel px-2.5 text-xs text-ink outline-none focus:border-accent font-mono"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line/60">
              <Button variant="plain" disabled={testing} onClick={handleBack}>
                取消
              </Button>
              <Button variant="accent" loading={testing} onClick={() => void handleCreateServer()}>
                <LuPlus className="size-3.5 mr-1" />
                <span>添加</span>
              </Button>
            </div>
          </div>
        </SettingsSectionCard>
      </div>
    )
  }

  // 2. Existing MCP Server Detail & Tools Subpage
  const isConnected = server?.status === 'connected'
  const isError = server?.status === 'error'
  const toolCount = server?.tools?.length || 0

  return (
    <div className="flex flex-col gap-3">
      {/* Server Status & Configuration Card */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <span>{server?.name}</span>
            <Badge tone={isConnected ? 'ok' : isError ? 'fail' : 'neutral'} size="mini">
              {isConnected ? '已连接' : isError ? '连接异常' : '未连接'}
            </Badge>
            <Badge tone="neutral" size="mini">
              Streamable HTTP
            </Badge>
          </div>
        }
        description={`URL: ${server?.url}`}
        titleAction={
          <div className="flex items-center gap-2">
            <SwitchToggle
              checked={server?.enabled ?? true}
              onCheckedChange={() => void handleToggleServer()}
              size="sm"
              tooltip={server?.enabled ? '停用此 Server' : '启用此 Server'}
              aria-label={`启用或停用 ${server?.name}`}
            />
            <Button variant="plain" size="sm" onClick={handleBack}>
              返回
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-paper-2/40 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-ink-soft font-mono">
            <span>传输协议: Streamable HTTP</span>
            <span>鉴权方式: {server?.auth.type === 'bearer' ? 'Bearer Token' : '无认证'}</span>
            <span>工具数量: {toolCount} 个</span>
            {server?.lastCheckedAt && <span>最后同步: {new Date(server.lastCheckedAt).toLocaleTimeString()}</span>}
          </div>

          {server?.lastError && <p className="mt-1 text-xs text-fail font-mono">连接错误: {server.lastError}</p>}

          <div className="pt-2 flex items-center gap-2 border-t border-line/60">
            <Button variant="default" loading={testing} onClick={() => void handleTestExisting()} title="测试连接并刷新工具列表">
              <LuRefreshCw className={cn('size-3.5 mr-1', testing && 'animate-spin')} />
              <span>测试连接</span>
            </Button>
          </div>
        </div>
      </SettingsSectionCard>

      {/* Discovered Tools List Card */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-1.5">
            <LuWrench className="size-4 text-accent" />
            <span>已注册 MCP 工具 ({toolCount})</span>
          </div>
        }
        description="管理该 Server 暴露给 Agent 使用的工具。可针对敏感操作单独停用指定工具。"
      >
        {toolCount === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-line rounded-lg bg-paper-2">
            <LuWrench className="size-6 text-ink-soft/40 mb-1" />
            <div className="text-xs font-semibold text-ink">暂未发现可用工具</div>
            <p className="text-[11px] text-ink-soft mt-1">请点击上方“测试连接并刷新工具”重新拉取工具列表。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {server?.tools?.map((tool) => {
              const isToolEnabled = tool.enabled !== false
              return (
                <div
                  key={tool.name}
                  className={cn(
                    'flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors',
                    isToolEnabled ? 'border-line bg-panel' : 'border-line/40 bg-paper-2/40 opacity-55'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-ink">{tool.name}</span>
                    </div>
                    {tool.description && <p className="text-[11px] text-ink-soft line-clamp-2 mt-1 leading-relaxed">{tool.description}</p>}
                  </div>
                  <SwitchToggle
                    checked={isToolEnabled}
                    onCheckedChange={() => void handleToggleTool(tool.name, isToolEnabled)}
                    size="sm"
                    tooltip={isToolEnabled ? '停用此工具' : '启用此工具'}
                    aria-label={`启用或停用 ${tool.name}`}
                  />
                </div>
              )
            })}
          </div>
        )}
      </SettingsSectionCard>

      {/* Danger Zone Card */}
      <SettingsSectionCard title="危险操作" description="移除后 Agent 将无法再调用该 Server 提供的任何工具。">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-soft">移除此 HTTP MCP Server 配置</span>
          <Button variant="outline-fail" onClick={handleDelete}>
            <LuTrash2 className="size-3.5 mr-1" />
            <span>删除</span>
          </Button>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
