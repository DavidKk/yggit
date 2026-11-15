'use client'

import React, { useMemo, useState } from 'react'
import { LuActivity, LuArrowLeft, LuCheck, LuCpu, LuPencil, LuPlus, LuRefreshCw, LuSave } from 'react-icons/lu'

import { ConfiguredSecretInput } from '@/components/ConfiguredSecretInput/configured-secret-input'
import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, InputSuggestion, Select, TextInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import type { AgentModelProfile } from '@/lib/agent/model-profiles'
import { testAgentConnection } from '@/lib/agent/openapi-client'
import { AGENT_PRESETS, type AgentProviderType, DEFAULT_AGENT_CONFIG } from '@/lib/agent/types'
import { cn } from '@/lib/utils'

import { PrivacyNoticeCallout } from './PrivacyNoticeCallout'
import { SettingsSectionCard } from './SettingsSectionCard'

export function ModelChannelSection() {
  const t = useT()
  const { profiles, activeProfileId, selectProfile } = useAgent()
  const [editing, setEditing] = useState<AgentModelProfile | null>(null)

  if (editing) return <ModelChannelEditor key={editing.id} profile={editing} onBack={() => setEditing(null)} />

  return (
    <SettingsSectionCard
      title={t('gitAgent.modelList')}
      description={t('gitAgent.modelListDesc')}
      titleAction={
        <Button variant="accent" gradient onClick={() => setEditing({ id: crypto.randomUUID(), name: '', config: { ...DEFAULT_AGENT_CONFIG } })}>
          <LuPlus aria-hidden="true" />
          {t('gitAgent.addModel')}
        </Button>
      }
    >
      <ul className="divide-y divide-line">
        {profiles.map((profile) => (
          <li key={profile.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <LuCpu className="size-4 shrink-0 text-accent" aria-hidden="true" />
            <button type="button" className="min-w-0 flex-1 text-left hover:text-accent cursor-pointer" onClick={() => setEditing(profile)}>
              <span className="block text-sm font-medium break-words">{profile.name}</span>
              <span className="block text-xs text-ink-soft break-all">
                {profile.config.model} · {profile.config.baseUrl}
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
            <Button size="icon" variant="plain" aria-label={t('gitAgent.editModel')} onClick={() => setEditing(profile)}>
              <LuPencil aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </SettingsSectionCard>
  )
}

function ModelChannelEditor({ profile, onBack }: { profile: AgentModelProfile; onBack: () => void }) {
  const t = useT()
  const { saveProfile } = useAgent()
  const [draft, setDraft] = useState(() => ({ ...profile, config: { ...profile.config } }))
  const [keyDraft, setKeyDraft] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs?: number; error?: string } | null>(null)
  const [error, setError] = useState('')

  // Remote models fetching state
  const [fetchingModels, setFetchingModels] = useState(false)
  const [remoteModels, setRemoteModels] = useState<Array<{ id: string; name: string }>>([])
  const [modelsFetchMsg, setModelsFetchMsg] = useState('')

  const preset = AGENT_PRESETS[draft.config.provider] || AGENT_PRESETS['byop']
  const config = { ...draft.config, apiKey: keyDraft.trim() || (clearKey ? '' : draft.config.apiKey) }

  const availableModels = useMemo(() => {
    const list = [...(preset.models || [])]
    for (const rm of remoteModels) {
      if (!list.some((item) => item.id === rm.id)) {
        list.push(rm)
      }
    }
    return list
  }, [preset.models, remoteModels])

  function validationError() {
    if (!draft.name.trim() || !config.model.trim() || !config.baseUrl?.trim()) return t('gitAgent.requiredFields')
    try {
      const url = new URL(config.baseUrl.trim())
      if (!['http:', 'https:'].includes(url.protocol)) return t('gitAgent.invalidEndpoint')
    } catch {
      return t('gitAgent.invalidEndpoint')
    }
    if (preset.requiresKey && !config.apiKey?.trim()) return t('gitAgent.keyRequired')
    return ''
  }

  function validatedConfig() {
    return { ...config, model: config.model.trim(), baseUrl: config.baseUrl?.trim(), apiKey: config.apiKey?.trim() }
  }

  async function handleTest() {
    const message = validationError()
    setError(message)
    if (message) return
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await testAgentConnection(validatedConfig()))
    } finally {
      setTesting(false)
    }
  }

  async function handleFetchModels() {
    if (!config.baseUrl) {
      setModelsFetchMsg('请先填写接入地址')
      return
    }
    setFetchingModels(true)
    setModelsFetchMsg('')
    try {
      const res = await fetch('/api/git/agent/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          provider: config.provider,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.models && data.models.length > 0) {
        setRemoteModels(data.models)
        setModelsFetchMsg(`已成功读取 ${data.models.length} 个可用模型`)
      } else {
        setModelsFetchMsg(data?.message || '未能从服务端读取到模型列表，使用预设清单')
      }
    } catch {
      setModelsFetchMsg('读取失败，请检查网络或接入地址')
    } finally {
      setFetchingModels(false)
    }
  }

  function updateConfig(patch: Partial<typeof draft.config>) {
    setDraft((previous) => ({ ...previous, config: { ...previous.config, ...patch } }))
    setTestResult(null)
    setError('')
  }

  const showApiKeyField = config.provider !== 'ollama' && config.provider !== 'local-sdk'

  return (
    <SettingsSectionCard title={t('gitAgent.modelDetails')} description="配置服务渠道、接口地址、默认模型与 API 密钥。">
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const message = validationError()
          setError(message)
          if (message) return
          saveProfile({ ...draft, name: draft.name.trim(), config: validatedConfig() })
          onBack()
        }}
      >
        <fieldset disabled={testing} className="divide-y divide-line/60">
          {/* Row 1: Profile Name */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 first:pt-0 items-start">
            <div className="md:col-span-5 min-w-0">
              <label htmlFor="agent-model-name" className="text-xs font-semibold text-ink">
                {t('gitAgent.profileName')}
              </label>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">便于辨识的配置别名。</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px]">
              <TextInput
                id="agent-model-name"
                fullWidth
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="例如：主力模型 / DeepSeek-V3"
              />
            </div>
          </div>

          {/* Row 2: Provider */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
            <div className="md:col-span-5 min-w-0">
              <span className="text-xs font-semibold text-ink" id="agent-provider-label">
                {t('gitAgent.modelProvider')}
              </span>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{preset.description || '服务商协议或本地直连方式。'}</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px] flex flex-col gap-2">
              <Select
                aria-labelledby="agent-provider-label"
                className="w-full"
                value={config.provider}
                options={(Object.keys(AGENT_PRESETS) as AgentProviderType[]).map((value) => ({
                  value,
                  label: AGENT_PRESETS[value].name,
                }))}
                onChange={(value) => {
                  const provider = value as AgentProviderType
                  const next = AGENT_PRESETS[provider]
                  updateConfig({ provider, baseUrl: next.baseUrl, model: next.defaultModel, apiKey: '' })
                  setKeyDraft('')
                  setClearKey(false)
                  setRemoteModels([])
                  setModelsFetchMsg('')
                }}
              />
              {preset.noZdrNotice && <PrivacyNoticeCallout />}
            </div>
          </div>

          {/* Row 3: API Endpoint */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
            <div className="md:col-span-5 min-w-0">
              <label htmlFor="agent-model-endpoint" className="text-xs font-semibold text-ink">
                {t('gitAgent.endpoint')}
              </label>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">OpenAPI 规范的服务基地址。</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px]">
              <TextInput
                id="agent-model-endpoint"
                fullWidth
                value={config.baseUrl || ''}
                onChange={(event) => updateConfig({ baseUrl: event.target.value })}
                placeholder={t('gitAgent.endpointPlaceholder')}
              />
            </div>
          </div>

          {/* Row 4: Default Model with InputSuggestion & Dynamic Fetch */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
            <div className="md:col-span-5 min-w-0">
              <label htmlFor="agent-model-id" className="text-xs font-semibold text-ink">
                {t('gitAgent.defaultModel') || '默认模型'}
              </label>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">预设规格或输入自定义模型代码。</p>
            </div>
            <div className="md:col-span-7 min-w-0 max-w-[460px] flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <InputSuggestion
                  id="agent-model-id"
                  className="flex-1 min-w-0"
                  value={config.model}
                  onChange={(val) => updateConfig({ model: val })}
                  options={availableModels.map((m) => ({ value: m.id, label: m.name }))}
                  placeholder="选择或输入默认模型（如 gpt-4o, deepseek-chat...）"
                />
                <Button
                  type="button"
                  size="md"
                  variant="default"
                  loading={fetchingModels}
                  onClick={handleFetchModels}
                  title="从远程接口动态拉取模型列表"
                  className="shrink-0 text-xs gap-1 cursor-pointer"
                >
                  <LuRefreshCw className={cn('size-3.5', fetchingModels && 'animate-spin')} />
                  <span>读取列表</span>
                </Button>
              </div>
              {modelsFetchMsg && <p className="text-[11px] text-ink-soft">{modelsFetchMsg}</p>}
            </div>
          </div>

          {/* Row 5: API Key */}
          {showApiKeyField && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
              <div className="md:col-span-5 min-w-0">
                <label htmlFor="agent-api-key" className="text-xs font-semibold text-ink">
                  {t('gitAgent.apiKey')}
                </label>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">仅在客户端内存暂存，刷新即清空。</p>
              </div>
              <div className="md:col-span-7 min-w-0 max-w-[460px]">
                <ConfiguredSecretInput
                  key={config.provider}
                  configured={Boolean(draft.config.apiKey) && !clearKey}
                  value={keyDraft}
                  onChange={(value) => {
                    setKeyDraft(value)
                    setTestResult(null)
                    setError('')
                  }}
                  onClear={() => {
                    setKeyDraft('')
                    setClearKey(true)
                    setTestResult(null)
                  }}
                />
              </div>
            </div>
          )}
        </fieldset>

        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        {testResult && (
          <div role="status" className="text-xs break-words">
            <Badge tone={testResult.ok ? 'ok' : 'fail'}>{t(testResult.ok ? 'gitAgent.testSuccess' : 'gitAgent.testFailed')}</Badge>
            <span className="ml-2 text-ink-soft">{testResult.ok ? `${testResult.latencyMs} ms` : testResult.error}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <Button onClick={onBack} disabled={testing}>
            <LuArrowLeft aria-hidden="true" />
            {t('gitAgent.backToModels')}
          </Button>
          <div className="flex items-center gap-2">
            <Button loading={testing} onClick={handleTest}>
              <LuActivity aria-hidden="true" />
              {t(testing ? 'gitAgent.testing' : 'gitAgent.testConnection')}
            </Button>
            <Button type="submit" variant="accent" disabled={testing}>
              <LuSave aria-hidden="true" />
              {t('common.save')}
            </Button>
          </div>
        </div>
      </form>
    </SettingsSectionCard>
  )
}
