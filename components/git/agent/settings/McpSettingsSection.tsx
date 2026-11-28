'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { LuChevronRight, LuNetwork, LuPlus, LuServer } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, SwitchToggle } from '@/components/sk'
import { useModeHref } from '@/lib/git/driver'
import { listMcpServers, subscribeMcp, toggleMcpServer } from '@/lib/mcp/storage'
import type { McpServerConfig } from '@/lib/mcp/types'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

export function McpSettingsSection() {
  const t = useT()
  const router = useRouter()
  const modeHref = useModeHref()
  const notify = useNotification()
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    setLoading(true)
    const list = await listMcpServers()
    setServers(list)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    return subscribeMcp(() => {
      void reload()
    })
  }, [])

  const handleToggleServer = async (id: string, current: boolean) => {
    await toggleMcpServer(id, !current)
    notify.success(current ? t('gitAgent.mcpDisabled') || 'MCP Server disabled' : t('gitAgent.mcpEnabled') || 'MCP Server enabled')
  }

  return (
    <div className="flex flex-col gap-3">
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuNetwork className="size-4 text-accent" />
            <span>{t('gitAgent.tabMcp') || 'HTTP MCP Server Management (Model Context Protocol)'}</span>
          </div>
        }
        description={t('gitAgent.mcpCardDesc') || 'Connect external HTTP MCP Server tools and data sources.'}
        descriptionTooltip={t('gitAgent.mcpCardTooltip') || 'Follows the open Model Context Protocol specification, supporting Streamable HTTP and Bearer Token auth.'}
        titleAction={
          <Button variant="accent" size="sm" onClick={() => router.push(modeHref('/settings/mcp/new'))}>
            <LuPlus className="size-3.5 mr-1" />
            <span>{t('gitAgent.skillsAddBtn') || 'Add'}</span>
          </Button>
        }
      >
        <div className="flex flex-col gap-2.5">
          {servers.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-line rounded-lg bg-paper-2">
              <LuServer className="size-8 text-ink-soft/40 mb-2" />
              <div className="text-xs font-semibold text-ink">{t('gitAgent.mcpEmptyTitle') || 'No MCP Server connected'}</div>
              <p className="text-[11px] text-ink-soft max-w-sm mt-1">
                {t('gitAgent.mcpEmptyDesc') || 'Click "Add" at the top right to connect an external MCP tool server. All tool calls execute securely locally.'}
              </p>
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
                  href={modeHref(`/settings/mcp/${encodeURIComponent(s.id)}`)}
                  className="min-w-0 flex-1 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                  aria-label={s.name}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink group-hover:text-accent transition-colors">{s.name}</span>
                    <Badge tone={isConnected ? 'ok' : isError ? 'fail' : 'neutral'} size="mini">
                      {isConnected
                        ? t('gitAgent.mcpStatusConnected') || 'Connected'
                        : isError
                          ? t('gitAgent.mcpStatusError') || 'Connection Error'
                          : t('gitAgent.mcpStatusDisconnected') || 'Disconnected'}
                    </Badge>
                    <Badge tone="neutral" size="mini">
                      Streamable HTTP
                    </Badge>
                    <span className="text-[11px] text-ink-soft font-mono">{(t('gitAgent.mcpToolsCount') || '{count} tools').replace('{count}', String(toolCount))}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-ink-soft font-mono truncate">
                    <span>URL: {s.url}</span>
                    <span>
                      {t('gitAgent.mcpAuthLabel') || 'Auth'}: {s.auth.type === 'bearer' ? 'Bearer Token' : t('gitAgent.mcpAuthNone') || 'None'}
                    </span>
                  </div>
                  {s.lastError && <p className="mt-1 text-[11px] text-fail font-mono line-clamp-1">{s.lastError}</p>}
                </Link>

                <div className="flex items-center gap-3 shrink-0">
                  <SwitchToggle
                    checked={s.enabled}
                    onCheckedChange={() => void handleToggleServer(s.id, s.enabled)}
                    size="sm"
                    tooltip={s.enabled ? t('gitAgent.mcpToggleDisable') || 'Disable server' : t('gitAgent.mcpToggleEnable') || 'Enable server'}
                    aria-label={s.name}
                  />
                  <Link
                    href={modeHref(`/settings/mcp/${encodeURIComponent(s.id)}`)}
                    className="text-ink-soft/40 hover:text-ink transition-colors p-1"
                    title={t('gitAgent.mcpManageTooltip') || 'Manage tools & settings'}
                  >
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
