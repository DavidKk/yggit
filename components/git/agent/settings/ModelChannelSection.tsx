'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { LuPencil, LuPlus, LuShieldCheck } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, SwitchToggle } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { getModelFilterConflicts, isModelAllowed } from '@/lib/agent/model-filter'
import type { AgentModelProfile } from '@/lib/agent/model-profiles'
import { AGENT_PRESETS, DEFAULT_AGENT_CONFIG } from '@/lib/agent/types'
import { getDriverMode } from '@/lib/git/driver'

import { ModelChannelEditor } from './ModelChannelEditor'
import { ModelFilterInputs } from './ModelFilterInputs'
import { RuleDebugger } from './RuleDebugger'
import { SettingsColumns } from './SettingsColumns'
import { SettingsSectionCard } from './SettingsSectionCard'

interface ModelChannelSectionProps {
  inline?: boolean
  onAdd?: () => void
  onEdit?: (profile: AgentModelProfile) => void
}

export function ModelChannelSection({ inline = false, onAdd, onEdit }: ModelChannelSectionProps = {}) {
  const t = useT()
  let router: ReturnType<typeof useRouter> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter()
  } catch {
    // Graceful fallback for test environments without Next navigation context
  }

  const { profiles, activeProfileId, selectProfile, modelFilter, setModelFilter } = useAgent()
  const [inlineEditing, setInlineEditing] = useState<AgentModelProfile | null>(null)

  const handleAdd = () => {
    if (onAdd) {
      onAdd()
      return
    }
    if (!inline && router?.push) {
      router.push('/settings/models/new')
      return
    }
    setInlineEditing({ id: crypto.randomUUID(), name: '', config: { ...DEFAULT_AGENT_CONFIG } })
  }

  const handleEdit = (profile: AgentModelProfile) => {
    if (onEdit) {
      onEdit(profile)
      return
    }
    if (!inline && router?.push) {
      router.push(`/settings/models/${profile.id}`)
      return
    }
    setInlineEditing(profile)
  }

  if (inlineEditing) {
    return <ModelChannelEditor key={inlineEditing.id} profile={inlineEditing} onBack={() => setInlineEditing(null)} />
  }

  const currentProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0]
  const isCurrentModelBlocked = currentProfile ? !isModelAllowed(currentProfile.config.model, modelFilter) : false
  const filterConflicts = getModelFilterConflicts(modelFilter)

  const content = (
    <div className="flex flex-col gap-4">
      {/* Model Channel Projects List */}
      <SettingsSectionCard
        title={t('gitAgent.modelList')}
        description={t('gitAgent.modelListDesc')}
        titleAction={
          <Button variant="accent" size="sm" onClick={handleAdd}>
            <LuPlus aria-hidden="true" />
            {t('gitAgent.addModel')}
          </Button>
        }
      >
        {getDriverMode() === 'edge' && (
          <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent/8 px-3 py-2.5 text-xs text-ink">
            <LuShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            <div className="space-y-0.5 leading-relaxed">
              <p className="font-semibold text-accent">{t('gitAgent.edgeSecurityNoticeTitle') || '密钥安全与隐私说明'}</p>
              <p className="text-ink-soft">
                {t('gitAgent.edgeSecurityNoticeBody') ||
                  '建议通过代理层转发请求以避免真实 Key 泄露；若直接填写 Key，请务必为本服务单独签发专用 Key，切勿与其他服务共用。本服务所有 Token 均加密后仅保存在您的本地环境中，不会收集任何相关配置信息。'}
              </p>
            </div>
          </div>
        )}
        <ul className="divide-y divide-line">
          {profiles.map((profile) => {
            const hasBlacklist = Boolean(profile.filter?.blacklist?.length)
            const hasWhitelist = Boolean(profile.filter?.whitelist?.length)

            return (
              <li key={profile.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <button
                  type="button"
                  aria-label={t('gitAgent.editModel')}
                  className="min-w-0 flex-1 text-left hover:text-accent cursor-pointer group"
                  onClick={() => handleEdit(profile)}
                >
                  <div className="flex items-center gap-2">
                    <span className="block text-sm font-medium break-words group-hover:text-accent transition-colors">{profile.name || profile.config.model}</span>
                    <LuPencil className="size-3 text-ink-soft/40 group-hover:text-accent transition-colors shrink-0" aria-hidden="true" />
                    {hasBlacklist && <span className="rounded bg-fail/10 px-1.5 py-0.5 text-[10px] font-medium text-fail">黑名单: {profile.filter?.blacklist?.length}</span>}
                    {hasWhitelist && <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">白名单: {profile.filter?.whitelist?.length}</span>}
                  </div>
                  <span className="block text-xs text-ink-soft break-all mt-0.5">
                    {profile.config.model} · {profile.config.baseUrl}
                    {profile.config.modelsEndpoint ? ` (接口: ${profile.config.modelsEndpoint})` : ''}
                  </span>
                </button>

                {AGENT_PRESETS[profile.config.provider]?.requiresKey && !profile.config.apiKey && !profile.config.hasApiKey && (
                  <Badge tone="warn">{t('gitAgent.keyRequired')}</Badge>
                )}

                <SwitchToggle
                  size="sm"
                  checked={activeProfileId === profile.id}
                  aria-label={activeProfileId === profile.id ? t('gitAgent.activeModel') : t('gitAgent.useModel')}
                  tooltip={activeProfileId === profile.id ? t('gitAgent.activeModel') : t('gitAgent.useModel')}
                  onCheckedChange={(checked) => {
                    if (checked) selectProfile(profile.id)
                  }}
                />
              </li>
            )
          })}
        </ul>
      </SettingsSectionCard>

      {/* Active Model Channel Filter Cards (Whitelist & Blacklist as separate cards) */}
      <ModelFilterInputs
        whitelistId="agent-model-whitelist"
        blacklistId="agent-model-blacklist"
        whitelist={modelFilter.whitelist}
        blacklist={modelFilter.blacklist}
        onWhitelistChange={(whitelist) => setModelFilter((prev) => ({ ...prev, whitelist }))}
        onBlacklistChange={(blacklist) => setModelFilter((prev) => ({ ...prev, blacklist }))}
        conflicts={filterConflicts}
        blockedModel={isCurrentModelBlocked && currentProfile ? currentProfile.config.model : null}
        scopeLabel={currentProfile?.name || currentProfile?.config?.model || '默认'}
      />
    </div>
  )
  return inline ? content : <SettingsColumns tools={<RuleDebugger filter={modelFilter} modelId={currentProfile?.config.model} />}>{content}</SettingsColumns>
}
