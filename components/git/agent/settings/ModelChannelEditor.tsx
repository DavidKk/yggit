'use client'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'
import { AiOutlineFileSync } from 'react-icons/ai'
import { LuActivity, LuArrowLeft, LuSave, LuShieldAlert, LuTrash2, LuTriangleAlert } from 'react-icons/lu'

import { ConfiguredSecretInput } from '@/components/ConfiguredSecretInput/configured-secret-input'
import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, InputSuggestion, Select, TagInput, TextInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { filterAllowedModels, getModelFilterConflicts, isModelAllowed } from '@/lib/agent/model-filter'
import type { AgentModelProfile } from '@/lib/agent/model-profiles'
import { testAgentConnection } from '@/lib/agent/openapi-client'
import { AGENT_PRESETS, type AgentProviderType, DEFAULT_AGENT_CONFIG } from '@/lib/agent/types'
import { cn } from '@/lib/utils'

import { PrivacyNoticeCallout } from './PrivacyNoticeCallout'
import { SettingsSectionCard } from './SettingsSectionCard'

interface ModelChannelEditorProps {
  profile?: AgentModelProfile
  isNew?: boolean
  onBack?: () => void
}

export function ModelChannelEditor({ profile, isNew = false, onBack }: ModelChannelEditorProps) {
  const t = useT()
  let router: ReturnType<typeof useRouter> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter()
  } catch {
    // Graceful fallback for environments outside Next router
  }
  const { profiles, saveProfile, deleteProfile } = useAgent()

  const initialProfile: AgentModelProfile = useMemo(() => {
    if (profile) return profile
    return {
      id: crypto.randomUUID(),
      name: '',
      config: { ...DEFAULT_AGENT_CONFIG },
      filter: { whitelist: [], blacklist: [] },
    }
  }, [profile])

  const [draft, setDraft] = useState<AgentModelProfile>(() => ({
    ...initialProfile,
    config: { ...initialProfile.config },
    filter: {
      whitelist: [...(initialProfile.filter?.whitelist || [])],
      blacklist: [...(initialProfile.filter?.blacklist || [])],
    },
  }))

  const [keyDraft, setKeyDraft] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs?: number; error?: string } | null>(null)
  const [error, setError] = useState('')

  // Remote models fetching state
  const [fetchingModels, setFetchingModels] = useState(false)
  const [remoteModels, setRemoteModels] = useState<Array<{ id: string; name: string }>>([])
  const [modelsFetchMsg, setModelsFetchMsg] = useState('')
  const [modelsFetchFailed, setModelsFetchFailed] = useState(false)

  const preset = AGENT_PRESETS[draft.config.provider] || AGENT_PRESETS['byop']
  const config = { ...draft.config, apiKey: keyDraft.trim() || (clearKey ? '' : draft.config.apiKey) }
  const channelFilter = useMemo(() => draft.filter || { whitelist: [], blacklist: [] }, [draft.filter])

  const availableModels = useMemo(() => {
    const list = [...(preset.models || [])]
    for (const rm of remoteModels) {
      if (!list.some((item) => item.id === rm.id)) {
        list.push(rm)
      }
    }
    return filterAllowedModels(list, channelFilter)
  }, [preset.models, remoteModels, channelFilter])

  const isModelBlocked = Boolean(config.model.trim()) && !isModelAllowed(config.model.trim(), channelFilter)
  const filterConflicts = getModelFilterConflicts(channelFilter)

  function validationError() {
    if (!draft.name.trim() || !config.model.trim() || !config.baseUrl?.trim()) return t('gitAgent.requiredFields')
    try {
      const url = new URL(config.baseUrl.trim())
      if (!['http:', 'https:'].includes(url.protocol)) return t('gitAgent.invalidEndpoint')
    } catch {
      return t('gitAgent.invalidEndpoint')
    }
    if (preset.requiresKey && !config.apiKey?.trim()) return t('gitAgent.keyRequired')
    if (!isModelAllowed(config.model.trim(), channelFilter)) {
      return t('gitAgent.modelBlockedNotice')
    }
    return ''
  }

  function validatedConfig() {
    return {
      ...config,
      model: config.model.trim(),
      baseUrl: config.baseUrl?.trim(),
      modelsEndpoint: config.modelsEndpoint?.trim() || undefined,
      apiKey: config.apiKey?.trim(),
    }
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
      setModelsFetchFailed(true)
      setModelsFetchMsg('请先填写接入地址')
      return
    }
    setFetchingModels(true)
    setModelsFetchMsg('')
    setModelsFetchFailed(false)
    try {
      const res = await fetch('/api/git/agent/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          provider: config.provider,
          modelsEndpoint: config.modelsEndpoint,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.models && data.models.length > 0) {
        setRemoteModels(data.models)
        setModelsFetchFailed(false)
        setModelsFetchMsg(`已成功读取 ${data.models.length} 个可用模型`)
      } else {
        setModelsFetchFailed(true)
        setModelsFetchMsg(data?.message || '未能从服务端读取到模型列表，使用预设清单')
      }
    } catch {
      setModelsFetchFailed(true)
      setModelsFetchMsg('未能从服务端读取到模型列表，使用预设清单')
    } finally {
      setFetchingModels(false)
    }
  }

  function updateConfig(patch: Partial<typeof draft.config>) {
    setDraft((previous) => ({ ...previous, config: { ...previous.config, ...patch } }))
    setTestResult(null)
    setError('')
    setModelsFetchFailed(false)
    setModelsFetchMsg('')
  }

  function handleNavigateBack() {
    if (onBack) {
      onBack()
      return
    }
    if (router?.push) {
      router.push('/settings?tab=models')
    }
  }

  function handleDelete() {
    if (profiles.length <= 1) return
    deleteProfile(draft.id)
    handleNavigateBack()
  }

  const showApiKeyField = config.provider !== 'local-sdk'

  return (
    <div className="flex flex-col gap-4">
      <SettingsSectionCard
        title={isNew ? '新增模型接入项目' : t('gitAgent.modelDetails')}
        description={isNew ? '配置新的模型渠道、服务商、接口地址与专属黑白名单。' : '配置服务渠道、接口地址、默认模型与 API 密钥。'}
        titleAction={
          !isNew && profiles.length > 1 ? (
            <Button variant="outline-fail" size="mini" onClick={handleDelete} title="删除该模型配置">
              <LuTrash2 aria-hidden="true" />
              删除
            </Button>
          ) : undefined
        }
      >
        <form
          className="grid gap-3"
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          onSubmit={(event) => {
            event.preventDefault()
            const message = validationError()
            setError(message)
            if (message) return
            saveProfile({
              ...draft,
              name: draft.name.trim(),
              config: validatedConfig(),
              filter: channelFilter,
            })
            handleNavigateBack()
          }}
        >
          {/* Hidden decoy fields defuse browser credential autofill heuristics */}
          <div className="sr-only" aria-hidden="true" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0, overflow: 'hidden' }}>
            <input type="text" name="chrome_prevent_autofill_user" tabIndex={-1} autoComplete="username" />
            <input type="password" name="chrome_prevent_autofill_pwd" tabIndex={-1} autoComplete="current-password" />
          </div>

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
                  placeholder="例如：Magpie 主力 / DeepSeek-V3 / 团队网关"
                />
              </div>
            </div>

            {/* Row 2: Provider */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
              <div className="md:col-span-5 min-w-0">
                <span className="text-xs font-semibold text-ink" id="agent-provider-label">
                  {t('gitAgent.modelProvider')}
                </span>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{preset.description || '服务商协议或网络直连方式。'}</p>
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
                    updateConfig({ provider, baseUrl: next.baseUrl, model: next.defaultModel, apiKey: '', modelsEndpoint: '' })
                    setKeyDraft('')
                    setClearKey(false)
                    setRemoteModels([])
                    setModelsFetchMsg('')
                    setModelsFetchFailed(false)
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

            {/* Row 4: Custom Models Catalog Endpoint (Special support for Magpie / Custom gateways) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
              <div className="md:col-span-5 min-w-0">
                <label htmlFor="agent-models-endpoint" className="text-xs font-semibold text-ink">
                  {t('integration.agentModelsEndpoint') || '模型列表接口'}
                </label>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                  {t('integration.agentModelsEndpointDesc') || '可选。默认请求 /models。若代理网关使用不同模型列表接口（如 Magpie），可填相对路径或完整 URL。'}
                </p>
              </div>
              <div className="md:col-span-7 min-w-0 max-w-[460px]">
                <TextInput
                  id="agent-models-endpoint"
                  fullWidth
                  value={config.modelsEndpoint || ''}
                  onChange={(event) => updateConfig({ modelsEndpoint: event.target.value })}
                  placeholder="默认 /models（Magpie 网关可填 /v1/models 或自定义接口）"
                />
              </div>
            </div>

            {/* Row 5: Default Model with InputSuggestion, Fetch Action, and zero-displacement attached error */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
              <div className="md:col-span-5 min-w-0">
                <label htmlFor="agent-model-id" className="text-xs font-semibold text-ink">
                  {t('gitAgent.defaultModel') || '默认模型'}
                </label>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">预设规格或输入自定义模型代码。</p>
              </div>
              <div className="md:col-span-7 min-w-0 max-w-[460px] flex flex-col gap-1">
                {/* Form element with integrated zero-displacement bottom error */}
                <div className="relative w-full">
                  <InputSuggestion
                    id="agent-model-id"
                    name="agent-model-id"
                    value={config.model}
                    invalid={modelsFetchFailed}
                    onChange={(val) => {
                      updateConfig({ model: val })
                      setModelsFetchFailed(false)
                      setModelsFetchMsg('')
                    }}
                    options={availableModels.map((m) => ({ value: m.id, label: m.name }))}
                    placeholder="选择或输入默认模型（如 gpt-4o, deepseek-chat...）"
                    action={{
                      icon: <AiOutlineFileSync className={cn('size-3.5', fetchingModels && 'animate-spin')} />,
                      title: '从远程接口动态拉取模型列表',
                      loading: fetchingModels,
                      disabled: fetchingModels || testing,
                      onClick: handleFetchModels,
                    }}
                  />
                  {/* Error attached directly to bottom edge without displacing layout space */}
                  {modelsFetchFailed && modelsFetchMsg && (
                    <span
                      role="alert"
                      title={modelsFetchMsg}
                      className="absolute -bottom-4.5 left-1 text-[10px] text-fail font-medium truncate max-w-full pointer-events-none select-none animate-in fade-in duration-150"
                    >
                      {modelsFetchMsg}
                    </span>
                  )}
                  {!modelsFetchFailed && modelsFetchMsg && (
                    <span
                      title={modelsFetchMsg}
                      className="absolute -bottom-4.5 left-1 text-[10px] text-accent font-medium truncate max-w-full pointer-events-none select-none animate-in fade-in duration-150"
                    >
                      {modelsFetchMsg}
                    </span>
                  )}
                </div>

                {isModelBlocked && (
                  <div className="flex items-center gap-1.5 text-xs text-danger font-medium mt-1">
                    <LuShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{t('gitAgent.modelBlockedNotice')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Row 6: API Key */}
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

          {/* Model Whitelist & Blacklist Follows Model Channel */}
          <div className="border-t border-line/60 pt-3 flex flex-col gap-3">
            <div>
              <h3 className="text-xs font-semibold text-ink">渠道模型白名单与黑名单</h3>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                仅作用于当前「{draft.name || '该'}」模型渠道。黑名单比白名单优先，设置了黑名单后，同名或匹配模型将被彻底禁止提交。
              </p>
            </div>

            {/* Whitelist / Blacklist Conflicts Notice */}
            {filterConflicts.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                <LuTriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <p className="font-semibold">{t('gitAgent.modelConflictNotice')}</p>
                  <p className="mt-0.5 text-warn/80">
                    黑名单拥有最高优先级。以下白名单中的规则已被黑名单直接阻断并隐藏：
                    <span className="ml-1 font-mono font-semibold">{filterConflicts.join(', ')}</span>
                  </p>
                </div>
              </div>
            )}

            <div className="divide-y divide-line/60">
              {/* Whitelist Input */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 first:pt-0 items-start">
                <div className="md:col-span-5 min-w-0">
                  <label htmlFor="agent-channel-whitelist" className="text-xs font-semibold text-ink">
                    {t('gitAgent.modelWhitelist')}
                  </label>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{t('gitAgent.modelWhitelistDesc')}</p>
                </div>
                <div className="md:col-span-7 min-w-0 max-w-[460px]">
                  <TagInput
                    id="agent-channel-whitelist"
                    value={channelFilter.whitelist}
                    onChange={(whitelist) => setDraft((prev) => ({ ...prev, filter: { ...prev.filter, whitelist, blacklist: prev.filter?.blacklist || [] } }))}
                    placeholder="留空允许所有；输入如 gpt-*、codex/* 后回车添加..."
                  />
                </div>
              </div>

              {/* Blacklist Input */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-start">
                <div className="md:col-span-5 min-w-0">
                  <label htmlFor="agent-channel-blacklist" className="text-xs font-semibold text-ink">
                    {t('gitAgent.modelBlacklist')}
                  </label>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{t('gitAgent.modelBlacklistDesc')}</p>
                </div>
                <div className="md:col-span-7 min-w-0 max-w-[460px]">
                  <TagInput
                    id="agent-channel-blacklist"
                    value={channelFilter.blacklist}
                    onChange={(blacklist) => setDraft((prev) => ({ ...prev, filter: { ...prev.filter, blacklist, whitelist: prev.filter?.whitelist || [] } }))}
                    placeholder="输入要阻断的模型或通配符，如 *-mini、workbuddy/deepseek-v4-pro，回车添加..."
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-danger mt-2">
              {error}
            </p>
          )}

          {testResult && (
            <div role="status" className="text-xs break-words mt-2">
              <Badge tone={testResult.ok ? 'ok' : 'fail'}>{t(testResult.ok ? 'gitAgent.testSuccess' : 'gitAgent.testFailed')}</Badge>
              <span className="ml-2 text-ink-soft">{testResult.ok ? `${testResult.latencyMs} ms` : testResult.error}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-line pt-3 mt-1">
            <Button onClick={handleNavigateBack} disabled={testing}>
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
    </div>
  )
}
