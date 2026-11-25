'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { LuCheck, LuKeyRound, LuNetwork, LuPlus, LuRefreshCw, LuServer, LuTrash2, LuWrench } from 'react-icons/lu'

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, SwitchToggle, TextInput } from '@/components/sk'
import { testAndDiscoverMcpServer } from '@/lib/mcp/client'
import { startMcpOAuthFlow } from '@/lib/mcp/oauth'
import { deleteMcpServer, listMcpServers, saveMcpServer, toggleMcpServer, toggleMcpTool } from '@/lib/mcp/storage'
import type { McpHeaderEntry, McpOAuthConfig, McpServerConfig } from '@/lib/mcp/types'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

interface McpServerEditorProps {
  serverId: string
}

export function McpServerEditor({ serverId }: McpServerEditorProps) {
  const t = useT()
  const router = useRouter()
  const notify = useNotification()
  const confirm = useConfirm()

  const isNew = serverId === 'new'
  const [server, setServer] = useState<McpServerConfig | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [testing, setTesting] = useState(false)
  const [authorizing, setAuthorizing] = useState(false)

  // New server form
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [authMode, setAuthMode] = useState<'headers' | 'oauth'>('headers')
  const [customHeaders, setCustomHeaders] = useState<McpHeaderEntry[]>([])
  const [oauthConfig, setOauthConfig] = useState<McpOAuthConfig>({})
  const [showOAuthAdvanced, setShowOAuthAdvanced] = useState(false)

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

  const handleAddHeader = () => {
    setCustomHeaders((prev) => [...prev, { key: '', value: '' }])
  }

  const handleUpdateHeader = (index: number, field: 'key' | 'value', val: string) => {
    setCustomHeaders((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: val } : item)))
  }

  const handleRemoveHeader = (index: number) => {
    setCustomHeaders((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleRunOAuth = async (targetUrl: string, currentOAuth?: McpOAuthConfig, onDone?: (nextOAuth: McpOAuthConfig) => void) => {
    if (!targetUrl.trim()) {
      notify.error(t('gitAgent.mcpUrlRequired') || 'Please enter server URL first')
      return
    }
    setAuthorizing(true)
    try {
      const nextOAuth = await startMcpOAuthFlow(targetUrl.trim(), currentOAuth)
      if (onDone) {
        onDone(nextOAuth)
      } else {
        setOauthConfig(nextOAuth)
      }
      notify.success('MCP OAuth 授权成功，已获取访问令牌。')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth authorization failed'
      notify.error(msg)
    } finally {
      setAuthorizing(false)
    }
  }

  // Create new server
  const handleCreateServer = async () => {
    if (!name.trim()) {
      notify.error(t('gitAgent.mcpNameRequired') || 'Please enter server name')
      return
    }
    if (!url.trim()) {
      notify.error(t('gitAgent.mcpUrlRequired') || 'Please enter server URL')
      return
    }

    const cleanedHeaders = customHeaders.map((h) => ({ key: h.key.trim(), value: h.value })).filter((h) => h.key.length > 0)

    const auth: McpServerConfig['auth'] =
      authMode === 'oauth'
        ? { type: 'oauth', oauth: oauthConfig, headers: cleanedHeaders.length > 0 ? cleanedHeaders : undefined }
        : cleanedHeaders.length > 0
          ? { type: 'headers', headers: cleanedHeaders }
          : { type: 'none' }

    setTesting(true)
    const now = Date.now()
    const newServer: McpServerConfig = {
      id: `mcp-${now}`,
      name: name.trim(),
      url: url.trim(),
      transport: 'streamable-http',
      auth,
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
        notify.success(t('gitAgent.mcpConnected', { count: res.tools.length }) || `Connected and discovered ${res.tools.length} tools`)
      } else {
        newServer.status = 'error'
        newServer.lastError = res.error
        notify.warning(`已保存配置，但连接测试未通过: ${res.error}`)
      }
    } catch (err) {
      newServer.status = 'error'
      newServer.lastError = err instanceof Error ? err.message : 'Connection failed'
      notify.warning('已保存配置，远程服务未响应')
    } finally {
      await saveMcpServer(newServer)
      setTesting(false)
      router.replace('/settings/mcp')
    }
  }

  // Test and refresh tools for existing server
  const handleTestExisting = async (overrideServer?: McpServerConfig) => {
    const target = overrideServer || server
    if (!target) return
    setTesting(true)
    try {
      const res = await testAndDiscoverMcpServer(target)
      if (res.ok) {
        const updated: McpServerConfig = {
          ...target,
          status: 'connected',
          tools: res.tools,
          resources: res.resources,
          prompts: res.prompts,
          lastError: undefined,
          lastCheckedAt: Date.now(),
        }
        await saveMcpServer(updated)
        setServer(updated)
        notify.success(t('gitAgent.mcpConnected', { count: res.tools.length }) || `Connected and synchronized ${res.tools.length} tools`)
      } else {
        const updated: McpServerConfig = {
          ...target,
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
        ...target,
        status: 'error',
        lastError: err instanceof Error ? err.message : 'Network request failed',
      }
      await saveMcpServer(updated)
      setServer(updated)
      notify.error(t('gitAgent.mcpTestFailed') || 'Test connection failed')
    } finally {
      setTesting(false)
    }
  }

  // Toggle server enabled
  const handleToggleServer = async () => {
    if (!server) return
    await toggleMcpServer(server.id, !server.enabled)
    setServer({ ...server, enabled: !server.enabled })
    notify.success(server.enabled ? t('gitAgent.mcpDisabled') || 'MCP Server disabled' : t('gitAgent.mcpEnabled') || 'MCP Server enabled')
  }

  // Toggle tool enabled
  const handleToggleTool = async (toolName: string, current: boolean) => {
    if (!server) return
    await toggleMcpTool(server.id, toolName, !current)
    const updatedTools = (server.tools || []).map((tool) => (tool.name === toolName ? { ...tool, enabled: !current } : tool))
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
        notify.success(t('gitAgent.mcpRemoved') || 'MCP Server removed')
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

  // 1. New MCP Server Subpage (Left-Right Form Layout)
  if (isNew) {
    const hasExpandedHeaders = authMode === 'headers' && customHeaders.length > 0
    const isOAuth = authMode === 'oauth'

    return (
      <div className="flex flex-col gap-3">
        <SettingsSectionCard
          title={
            <div className="flex items-center gap-2">
              <LuNetwork className="size-4 text-accent" />
              <span>添加 HTTP MCP Server</span>
            </div>
          }
          description="遵循 Model Context Protocol 规范，支持 Streamable HTTP、自定义请求头与通用 MCP OAuth 2.0 授权。"
          titleAction={
            <Button variant="plain" size="sm" onClick={handleBack}>
              返回
            </Button>
          }
        >
          <form
            className="flex flex-col"
            onSubmit={(e) => {
              e.preventDefault()
              void handleCreateServer()
            }}
          >
            <fieldset disabled={testing || authorizing} className="divide-y divide-line/60">
              {/* Row 1: Server Name */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 first:pt-0 items-center">
                <div className="md:col-span-4 min-w-0">
                  <label htmlFor="mcp-server-name" className="text-xs font-semibold text-ink">
                    Server 名称
                  </label>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">便于辨识的服务别名。</p>
                </div>
                <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full">
                  <TextInput id="mcp-server-name" fullWidth value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：GitHub MCP / Local Tools" />
                </div>
              </div>

              {/* Row 2: Server URL */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
                <div className="md:col-span-4 min-w-0">
                  <label htmlFor="mcp-server-url" className="text-xs font-semibold text-ink">
                    服务端地址 (URL)
                  </label>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">Streamable HTTP 协议入口地址。</p>
                </div>
                <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full">
                  <TextInput id="mcp-server-url" type="url" fullWidth value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" />
                </div>
              </div>

              {/* Row 3: Auth Mode */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
                <div className="md:col-span-4 min-w-0">
                  <span className="text-xs font-semibold text-ink">鉴权方式</span>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">选择自定义请求头或通用 MCP OAuth 授权。</p>
                </div>
                <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthMode('headers')}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-md border py-2 px-3 text-xs font-medium transition-all cursor-pointer select-none',
                        authMode === 'headers'
                          ? 'border-accent bg-accent/10 text-accent font-semibold shadow-xs'
                          : 'border-line bg-panel text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink'
                      )}
                    >
                      <span>自定义请求头</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('oauth')}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-md border py-2 px-3 text-xs font-medium transition-all cursor-pointer select-none',
                        authMode === 'oauth'
                          ? 'border-accent bg-accent/10 text-accent font-semibold shadow-xs'
                          : 'border-line bg-panel text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink'
                      )}
                    >
                      <LuKeyRound className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>MCP OAuth 2.0</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 4A: Custom Headers */}
              {authMode === 'headers' && (
                <div className={cn('grid grid-cols-1 md:grid-cols-12 gap-3 py-3', hasExpandedHeaders ? 'items-start' : 'items-center')}>
                  <div className={cn('md:col-span-4 min-w-0', hasExpandedHeaders && 'pt-1.5')}>
                    <span className="text-xs font-semibold text-ink">自定义头部 (Headers)</span>
                    <p className="text-xs text-ink-soft leading-relaxed mt-0.5">按需填写 Authorization、X-API-Key 等请求头，留空即无认证。</p>
                  </div>
                  <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full flex flex-col gap-2">
                    {customHeaders.map((header, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <TextInput
                          value={header.key}
                          onChange={(e) => handleUpdateHeader(idx, 'key', e.target.value)}
                          placeholder="Header 名称 (如 Authorization)"
                          className="w-[42%] font-mono"
                        />
                        <TextInput
                          value={header.value}
                          onChange={(e) => handleUpdateHeader(idx, 'value', e.target.value)}
                          placeholder="Header 值 (如 Bearer xxx)"
                          className="flex-1 font-mono"
                        />
                        <Button type="button" variant="plain" size="sm" onClick={() => handleRemoveHeader(idx)} aria-label="移除请求头" title="移除">
                          <LuTrash2 className="size-3.5 text-ink-soft hover:text-fail" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center justify-end">
                      <Button type="button" variant="default" size="sm" onClick={handleAddHeader}>
                        <LuPlus className="size-3.5 mr-1" />
                        <span>添加请求头</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 4B: MCP OAuth 2.0 */}
              {isOAuth && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
                  <div className="md:col-span-4 min-w-0 pt-1.5">
                    <span className="text-xs font-semibold text-ink">OAuth 授权状态</span>
                    <p className="text-xs text-ink-soft leading-relaxed mt-0.5">自动探测 .well-known 元数据并完成 PKCE 授权。</p>
                  </div>
                  <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper-2/50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge tone={oauthConfig.accessToken ? 'ok' : 'neutral'} size="mini">
                          {oauthConfig.accessToken ? '已授权' : '未授权'}
                        </Badge>
                        {oauthConfig.accessToken && <span className="text-[11px] text-ink-soft font-mono">Token 已就绪</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button type="button" variant="plain" size="sm" onClick={() => setShowOAuthAdvanced((v) => !v)}>
                          {showOAuthAdvanced ? '收起参数' : '高级参数'}
                        </Button>
                        <Button type="button" variant="accent" size="sm" loading={authorizing} onClick={() => void handleRunOAuth(url, oauthConfig)}>
                          <LuKeyRound className="size-3.5 mr-1" />
                          <span>{oauthConfig.accessToken ? '重新授权' : '发起 OAuth 授权'}</span>
                        </Button>
                      </div>
                    </div>

                    {showOAuthAdvanced && (
                      <div className="flex flex-col gap-2 rounded-lg border border-line/70 bg-paper-2/30 p-2.5">
                        <TextInput
                          fullWidth
                          value={oauthConfig.clientId || ''}
                          onChange={(e) => setOauthConfig((prev) => ({ ...prev, clientId: e.target.value }))}
                          placeholder="Client ID（支持动态注册时可留空）"
                        />
                        <TextInput
                          fullWidth
                          value={oauthConfig.authorizationEndpoint || ''}
                          onChange={(e) => setOauthConfig((prev) => ({ ...prev, authorizationEndpoint: e.target.value }))}
                          placeholder="Authorization URL（可选，覆盖自动探测）"
                        />
                        <TextInput
                          fullWidth
                          value={oauthConfig.tokenEndpoint || ''}
                          onChange={(e) => setOauthConfig((prev) => ({ ...prev, tokenEndpoint: e.target.value }))}
                          placeholder="Token URL（可选，覆盖自动探测）"
                        />
                        <TextInput
                          fullWidth
                          value={oauthConfig.scope || ''}
                          onChange={(e) => setOauthConfig((prev) => ({ ...prev, scope: e.target.value }))}
                          placeholder="Scope（可选，空格分隔）"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </fieldset>

            <div className="mt-3 flex items-center justify-end gap-2 border-t border-line/60 pt-3">
              <Button type="button" variant="plain" disabled={testing || authorizing} onClick={handleBack}>
                取消
              </Button>
              <Button type="submit" variant="accent" loading={testing} disabled={authorizing}>
                <LuCheck className="size-3.5 mr-1" />
                <span>添加并连接</span>
              </Button>
            </div>
          </form>
        </SettingsSectionCard>
      </div>
    )
  }

  // 2. Existing MCP Server Detail & Tools Subpage
  const isConnected = server?.status === 'connected'
  const isError = server?.status === 'error'
  const toolCount = server?.tools?.length || 0
  const authLabel =
    server?.auth.type === 'oauth'
      ? server.auth.oauth?.accessToken
        ? 'MCP OAuth 2.0 (已授权)'
        : 'MCP OAuth 2.0 (未授权)'
      : server?.auth.type === 'headers'
        ? `自定义请求头 (${server.auth.headers?.length || 0} 项)`
        : server?.auth.type === 'bearer'
          ? 'Bearer Token'
          : '无认证'

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
            <span>鉴权方式: {authLabel}</span>
            <span>工具数量: {toolCount} 个</span>
            {server?.lastCheckedAt && <span>最后同步: {new Date(server.lastCheckedAt).toLocaleTimeString()}</span>}
          </div>

          {server?.lastError && <p className="mt-1 text-xs text-fail font-mono">连接错误: {server.lastError}</p>}

          <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-line/60">
            <Button variant="default" loading={testing} onClick={() => void handleTestExisting()} title="测试连接并刷新工具列表">
              <LuRefreshCw className={cn('size-3.5 mr-1', testing && 'animate-spin')} />
              <span>测试连接</span>
            </Button>
            {server?.auth.type === 'oauth' && (
              <Button
                variant="default"
                loading={authorizing}
                onClick={() =>
                  void handleRunOAuth(server.url, server.auth.oauth, (nextOAuth) => {
                    const updated: McpServerConfig = {
                      ...server,
                      auth: { ...server.auth, oauth: nextOAuth },
                      updatedAt: Date.now(),
                    }
                    void saveMcpServer(updated).then(() => {
                      setServer(updated)
                      void handleTestExisting(updated)
                    })
                  })
                }
              >
                <LuKeyRound className="size-3.5 mr-1" />
                <span>{server.auth.oauth?.accessToken ? '刷新 OAuth 授权' : '发起 OAuth 授权'}</span>
              </Button>
            )}
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
            <p className="text-[11px] text-ink-soft mt-1">请点击上方“测试连接”重新拉取工具列表。</p>
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
