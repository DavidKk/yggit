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
      notify.success('MCP OAuth authorization succeeded; access token acquired.')
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
        notify.warning(`Configuration saved, but connection test failed: ${res.error}`)
      }
    } catch (err) {
      newServer.status = 'error'
      newServer.lastError = err instanceof Error ? err.message : 'Connection failed'
      notify.warning('Configuration saved, but remote server did not respond')
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
        notify.error(`Connection failed: ${res.error}`)
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
      title: 'Remove MCP Server',
      description: `Are you sure you want to remove "${server.name}"? The Agent will no longer be able to use tools from this server.`,
      confirmLabel: 'Remove',
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
        <span>Loading MCP Server configuration…</span>
      </div>
    )
  }

  if (!isNew && !server) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-line rounded-lg bg-paper-2">
        <LuServer className="size-8 text-ink-soft/40 mb-2" />
        <div className="text-xs font-semibold text-ink">MCP Server not found</div>
        <p className="text-[11px] text-ink-soft max-w-sm mt-1">This server may have been removed or the ID does not exist.</p>
        <Button variant="default" onClick={handleBack} className="mt-3">
          Back
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
              <span>Add HTTP MCP Server</span>
            </div>
          }
          description="Follows the Model Context Protocol specification, supporting Streamable HTTP, custom headers, and generic MCP OAuth 2.0."
          titleAction={
            <Button variant="plain" size="sm" onClick={handleBack}>
              Back
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
                    Server Name
                  </label>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">A recognizable alias for this server.</p>
                </div>
                <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full">
                  <TextInput id="mcp-server-name" fullWidth value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GitHub MCP / Local Tools" />
                </div>
              </div>

              {/* Row 2: Server URL */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
                <div className="md:col-span-4 min-w-0">
                  <label htmlFor="mcp-server-url" className="text-xs font-semibold text-ink">
                    Server URL
                  </label>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">Streamable HTTP protocol endpoint URL.</p>
                </div>
                <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full">
                  <TextInput id="mcp-server-url" type="url" fullWidth value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" />
                </div>
              </div>

              {/* Row 3: Auth Mode */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
                <div className="md:col-span-4 min-w-0">
                  <span className="text-xs font-semibold text-ink">Authentication</span>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">Choose custom headers or generic MCP OAuth 2.0.</p>
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
                      <span>Custom Headers</span>
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
                    <span className="text-xs font-semibold text-ink">Custom Headers</span>
                    <p className="text-xs text-ink-soft leading-relaxed mt-0.5">Add Authorization, X-API-Key, etc. Leave empty for no auth.</p>
                  </div>
                  <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full flex flex-col gap-2">
                    {customHeaders.map((header, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <TextInput
                          value={header.key}
                          onChange={(e) => handleUpdateHeader(idx, 'key', e.target.value)}
                          placeholder="Header name (e.g. Authorization)"
                          className="w-[42%] font-mono"
                        />
                        <TextInput
                          value={header.value}
                          onChange={(e) => handleUpdateHeader(idx, 'value', e.target.value)}
                          placeholder="Header value (e.g. Bearer xxx)"
                          className="flex-1 font-mono"
                        />
                        <Button type="button" variant="plain" size="sm" onClick={() => handleRemoveHeader(idx)} aria-label="Remove header" title="Remove">
                          <LuTrash2 className="size-3.5 text-ink-soft hover:text-fail" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center justify-end">
                      <Button type="button" variant="default" size="sm" onClick={handleAddHeader}>
                        <LuPlus className="size-3.5 mr-1" />
                        <span>Add Header</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 4B: MCP OAuth 2.0 */}
              {isOAuth && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
                  <div className="md:col-span-4 min-w-0 pt-1.5">
                    <span className="text-xs font-semibold text-ink">OAuth Status</span>
                    <p className="text-xs text-ink-soft leading-relaxed mt-0.5">Automatically discovers .well-known metadata and completes PKCE authorization.</p>
                  </div>
                  <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper-2/50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge tone={oauthConfig.accessToken ? 'ok' : 'neutral'} size="mini">
                          {oauthConfig.accessToken ? 'Authorized' : 'Unauthorized'}
                        </Badge>
                        {oauthConfig.accessToken && <span className="text-[11px] text-ink-soft font-mono">Token Ready</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button type="button" variant="plain" size="sm" onClick={() => setShowOAuthAdvanced((v) => !v)}>
                          {showOAuthAdvanced ? 'Hide Advanced' : 'Advanced'}
                        </Button>
                        <Button type="button" variant="accent" size="sm" loading={authorizing} onClick={() => void handleRunOAuth(url, oauthConfig)}>
                          <LuKeyRound className="size-3.5 mr-1" />
                          <span>{oauthConfig.accessToken ? 'Re-authorize' : 'Authorize with OAuth'}</span>
                        </Button>
                      </div>
                    </div>

                    {showOAuthAdvanced && (
                      <div className="flex flex-col gap-2 rounded-lg border border-line/70 bg-paper-2/30 p-2.5">
                        <TextInput
                          fullWidth
                          value={oauthConfig.clientId || ''}
                          onChange={(e) => setOauthConfig((prev) => ({ ...prev, clientId: e.target.value }))}
                          placeholder="Client ID (optional if dynamic registration is supported)"
                        />
                        <TextInput
                          fullWidth
                          value={oauthConfig.authorizationEndpoint || ''}
                          onChange={(e) => setOauthConfig((prev) => ({ ...prev, authorizationEndpoint: e.target.value }))}
                          placeholder="Authorization URL (optional, overrides discovery)"
                        />
                        <TextInput
                          fullWidth
                          value={oauthConfig.tokenEndpoint || ''}
                          onChange={(e) => setOauthConfig((prev) => ({ ...prev, tokenEndpoint: e.target.value }))}
                          placeholder="Token URL (optional, overrides discovery)"
                        />
                        <TextInput
                          fullWidth
                          value={oauthConfig.scope || ''}
                          onChange={(e) => setOauthConfig((prev) => ({ ...prev, scope: e.target.value }))}
                          placeholder="Scope (optional, space-separated)"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </fieldset>

            <div className="mt-3 flex items-center justify-end gap-2 border-t border-line/60 pt-3">
              <Button type="button" variant="plain" disabled={testing || authorizing} onClick={handleBack}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" loading={testing} disabled={authorizing}>
                <LuCheck className="size-3.5 mr-1" />
                <span>Add & Connect</span>
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
        ? 'MCP OAuth 2.0 (Authorized)'
        : 'MCP OAuth 2.0 (Unauthorized)'
      : server?.auth.type === 'headers'
        ? `Custom Headers (${server.auth.headers?.length || 0})`
        : server?.auth.type === 'bearer'
          ? 'Bearer Token'
          : 'None'

  return (
    <div className="flex flex-col gap-3">
      {/* Server Status & Configuration Card */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <span>{server?.name}</span>
            <Badge tone={isConnected ? 'ok' : isError ? 'fail' : 'neutral'} size="mini">
              {isConnected ? 'Connected' : isError ? 'Connection Error' : 'Disconnected'}
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
              tooltip={server?.enabled ? 'Disable server' : 'Enable server'}
              aria-label={`Toggle ${server?.name}`}
            />
            <Button variant="plain" size="sm" onClick={handleBack}>
              Back
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-paper-2/40 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-ink-soft font-mono">
            <span>Transport: Streamable HTTP</span>
            <span>Auth: {authLabel}</span>
            <span>Tools: {toolCount}</span>
            {server?.lastCheckedAt && <span>Last synced: {new Date(server.lastCheckedAt).toLocaleTimeString()}</span>}
          </div>

          {server?.lastError && <p className="mt-1 text-xs text-fail font-mono">Connection error: {server.lastError}</p>}

          <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-line/60">
            <Button variant="default" loading={testing} onClick={() => void handleTestExisting()} title="Test connection and refresh tool list">
              <LuRefreshCw className={cn('size-3.5 mr-1', testing && 'animate-spin')} />
              <span>Test Connection</span>
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
                <span>{server.auth.oauth?.accessToken ? 'Refresh OAuth' : 'Authorize with OAuth'}</span>
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
            <span>Registered MCP Tools ({toolCount})</span>
          </div>
        }
        description="Manage tools exposed by this server to the Agent. Sensitive tools can be disabled individually."
      >
        {toolCount === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-line rounded-lg bg-paper-2">
            <LuWrench className="size-6 text-ink-soft/40 mb-1" />
            <div className="text-xs font-semibold text-ink">No tools discovered yet</div>
            <p className="text-[11px] text-ink-soft mt-1">Click &ldquo;Test Connection&rdquo; above to fetch the tool list.</p>
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
                    tooltip={isToolEnabled ? 'Disable tool' : 'Enable tool'}
                    aria-label={`Toggle ${tool.name}`}
                  />
                </div>
              )
            })}
          </div>
        )}
      </SettingsSectionCard>

      {/* Danger Zone Card */}
      <SettingsSectionCard title="Danger Zone" description="Removing this server prevents the Agent from calling any tools it provides.">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-soft">Remove this HTTP MCP Server configuration</span>
          <Button variant="outline-fail" onClick={handleDelete}>
            <LuTrash2 className="size-3.5 mr-1" />
            <span>Delete</span>
          </Button>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
