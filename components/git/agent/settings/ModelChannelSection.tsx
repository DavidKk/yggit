'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { LuCheck, LuPencil, LuPlus, LuShieldAlert, LuTriangleAlert } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, TagInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { getModelFilterConflicts, isModelAllowed } from '@/lib/agent/model-filter'
import type { AgentModelProfile } from '@/lib/agent/model-profiles'
import { AGENT_PRESETS, DEFAULT_AGENT_CONFIG } from '@/lib/agent/types'

import { ModelChannelEditor } from './ModelChannelEditor'
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
          <Button variant="accent" gradient onClick={handleAdd}>
            <LuPlus aria-hidden="true" />
            {t('gitAgent.addModel')}
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {profiles.map((profile) => {
            const hasBlacklist = Boolean(profile.filter?.blacklist?.length)
            const hasWhitelist = Boolean(profile.filter?.whitelist?.length)

            return (
              <li key={profile.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <button type="button" className="min-w-0 flex-1 text-left hover:text-accent cursor-pointer group" onClick={() => handleEdit(profile)}>
                  <div className="flex items-center gap-2">
                    <span className="block text-sm font-medium break-words group-hover:text-accent transition-colors">{profile.name || profile.config.model}</span>
                    {hasBlacklist && <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">黑名单: {profile.filter?.blacklist?.length}</span>}
                    {hasWhitelist && <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">白名单: {profile.filter?.whitelist?.length}</span>}
                  </div>
                  <span className="block text-xs text-ink-soft break-all mt-0.5">
                    {profile.config.model} · {profile.config.baseUrl}
                    {profile.config.modelsEndpoint ? ` (接口: ${profile.config.modelsEndpoint})` : ''}
                  </span>
                </button>

                {activeProfileId === profile.id ? (
                  <Badge tone="ok">{t('gitAgent.activeModel')}</Badge>
                ) : (
                  <Button onClick={() => selectProfile(profile.id)}>
                    <LuCheck aria-hidden="true" />
                    {t('gitAgent.useModel')}
                  </Button>
                )}

                {AGENT_PRESETS[profile.config.provider]?.requiresKey && !profile.config.apiKey && <Badge tone="warn">{t('gitAgent.keyRequired')}</Badge>}

                <Button size="icon" variant="plain" aria-label={t('gitAgent.editModel')} onClick={() => handleEdit(profile)} title="编辑此模型接入项目">
                  <LuPencil aria-hidden="true" />
                </Button>
              </li>
            )
          })}
        </ul>
      </SettingsSectionCard>

      {/* Active Model Channel Filter Card */}
      <SettingsSectionCard
        title={`当前生效渠道模型访问控制「${currentProfile?.name || currentProfile?.config?.model || '默认'}」`}
        description="当前渠道黑白名单。黑名单优先，命中即禁。"
      >
        <div className="flex flex-col gap-3">
          {/* Active Model Blocked Warning */}
          {isCurrentModelBlocked && currentProfile && (
            <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-xs text-danger">
              <LuShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-semibold">{t('gitAgent.modelBlockedNotice')}</p>
                <p className="mt-0.5 text-danger/80">
                  当前生效的模型「<span className="font-mono font-medium">{currentProfile.config.model}</span>」命中黑名单规则，已在快捷栏与工作区全面禁止提交请求。
                </p>
              </div>
            </div>
          )}

          {/* Whitelist / Blacklist Conflicts Notice */}
          {filterConflicts.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5 text-xs text-warn">
              <LuTriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-semibold">{t('gitAgent.modelConflictNotice')}</p>
                <p className="mt-0.5 text-warn/80">
                  黑名单优先。以下白名单规则已被阻断：
                  <span className="ml-1 font-mono font-semibold">{filterConflicts.join(', ')}</span>
                </p>
              </div>
            </div>
          )}

          <div className="divide-y divide-line/60">
            {/* Whitelist Input */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 first:pt-0 items-center">
              <div className="md:col-span-5 min-w-0">
                <label htmlFor="agent-model-whitelist" className="text-xs font-semibold text-ink">
                  {t('gitAgent.modelWhitelist')}
                </label>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{t('gitAgent.modelWhitelistDesc')}</p>
              </div>
              <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex justify-end">
                <TagInput
                  id="agent-model-whitelist"
                  className="w-full"
                  value={modelFilter.whitelist}
                  onChange={(whitelist) => setModelFilter((prev) => ({ ...prev, whitelist }))}
                  placeholder="如 gpt-*、*-mini，回车添加..."
                />
              </div>
            </div>

            {/* Blacklist Input */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
              <div className="md:col-span-5 min-w-0">
                <label htmlFor="agent-model-blacklist" className="text-xs font-semibold text-ink">
                  {t('gitAgent.modelBlacklist')}
                </label>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{t('gitAgent.modelBlacklistDesc')}</p>
              </div>
              <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex justify-end">
                <TagInput
                  id="agent-model-blacklist"
                  className="w-full"
                  value={modelFilter.blacklist}
                  onChange={(blacklist) => setModelFilter((prev) => ({ ...prev, blacklist }))}
                  placeholder="如 *-mini、gpt-3.5*，回车添加..."
                />
              </div>
            </div>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  )
  return inline ? content : <SettingsColumns tools={<RuleDebugger filter={modelFilter} modelId={currentProfile?.config.model} />}>{content}</SettingsColumns>
}
