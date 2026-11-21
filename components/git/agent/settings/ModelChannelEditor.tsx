'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AiOutlineFileSync } from 'react-icons/ai'
import { IoCheckmark } from 'react-icons/io5'
import { LuActivity, LuArrowLeft, LuSave, LuShieldAlert, LuTrash2, LuTriangleAlert } from 'react-icons/lu'

import { ConfiguredSecretInput } from '@/components/ConfiguredSecretInput/configured-secret-input'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, InputSuggestion, Select, Spinner, TagInput, TextInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { filterAllowedModels, getModelFilterConflicts, isModelAllowed } from '@/lib/agent/model-filter'
import type { AgentModelProfile } from '@/lib/agent/model-profiles'
import { testAgentConnection } from '@/lib/agent/openapi-client'
import { AGENT_PRESETS, type AgentProviderType, DEFAULT_AGENT_CONFIG } from '@/lib/agent/types'
import { cn } from '@/lib/utils'

import { PrivacyNoticeCallout } from './PrivacyNoticeCallout'
import { RuleDebugger } from './RuleDebugger'
import { SettingsColumns } from './SettingsColumns'
import { SettingsSectionCard } from './SettingsSectionCard'

interface ModelChannelEditorProps {
  showTools?: boolean
  profile?: AgentModelProfile
  isNew?: boolean
  onBack?: () => void
}

export function ModelChannelEditor({ profile, isNew = false, onBack, showTools = false }: ModelChannelEditorProps) {
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
    let baseConfig = { ...DEFAULT_AGENT_CONFIG }
    let initialName = ''
    if (isNew && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const providerParam = urlParams.get('provider') as AgentProviderType | null
      if (providerParam && AGENT_PRESETS[providerParam]) {
        const preset = AGENT_PRESETS[providerParam]
        baseConfig = {
          provider: providerParam,
          model: preset.defaultModel,
          baseUrl: preset.baseUrl,
          apiKey: '',
          stream: true,
        }
        initialName = preset.name
      }
    }
    return {
      id: crypto.randomUUID(),
      name: initialName,
      config: baseConfig,
      filter: { whitelist: [], blacklist: [] },
    }
  }, [profile, isNew])

  const [draft, setDraft] = useState<AgentModelProfile>(() => ({
    ...initialProfile,
    config: { ...initialProfile.config },
    filter: {
      whitelist: [...(initialProfile.filter?.whitelist || [])],
      blacklist: [...(initialProfile.filter?.blacklist || [])],
    },
  }))

  useEffect(() => {
    if (profile) {
      setDraft({
        ...profile,
        config: { ...profile.config },
        filter: {
          whitelist: [...(profile.filter?.whitelist || [])],
          blacklist: [...(profile.filter?.blacklist || [])],
        },
      })
    }
  }, [profile])

  const [keyDraft, setKeyDraft] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'failure'>('idle')
  const [testTooltip, setTestTooltip] = useState('')
  const resetTimerRef = useRef<number | null>(null)
  const [error, setError] = useState('')

  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
    }
  }, [])

  // Remote models fetching state
  const [fetchingModels, setFetchingModels] = useState(false)
  const [remoteModels, setRemoteModels] = useState<Array<{ id: string; name: string }>>([])
  const [modelsFetchMsg, setModelsFetchMsg] = useState('')
  const [modelsFetchFailed, setModelsFetchFailed] = useState(false)

  const preset = AGENT_PRESETS[draft.config.provider] || AGENT_PRESETS['byop']
  const config = { ...draft.config, apiKey: keyDraft.trim() || (clearKey ? '' : draft.config.apiKey) }
  const channelFilter = useMemo(() => draft.filter || { whitelist: [], blacklist: [] }, [draft.filter])

  const availableModels = useMemo(() => {
    // Exclusively display remote models returned by the server or user-entered model.
    // Hardcoded preset models list is removed per UX requirement ("将预置模型清单的列表去掉，先填 APP KEY 再选模型").
    const baseList: Array<{ id: string; name: string }> = remoteModels.length > 0 ? [...remoteModels] : []
    if (config.model && !baseList.some((item) => item.id === config.model)) {
      baseList.unshift({ id: config.model, name: config.model })
    }
    return filterAllowedModels(baseList, channelFilter)
  }, [config.model, remoteModels, channelFilter])

  const isModelBlocked = Boolean(config.model.trim()) && !isModelAllowed(config.model.trim(), channelFilter)
  const filterConflicts = getModelFilterConflicts(channelFilter)

  function validateAndFocus(): string {
    if (!draft.name.trim()) {
      document.getElementById('agent-model-name')?.focus()
      return t('gitAgent.requiredFields')
    }
    if (!config.baseUrl?.trim()) {
      document.getElementById('agent-model-endpoint')?.focus()
      return t('gitAgent.requiredFields')
    }
    try {
      const url = new URL(config.baseUrl.trim())
      if (!['http:', 'https:'].includes(url.protocol)) {
        document.getElementById('agent-model-endpoint')?.focus()
        return t('gitAgent.invalidEndpoint')
      }
    } catch {
      document.getElementById('agent-model-endpoint')?.focus()
      return t('gitAgent.invalidEndpoint')
    }
    if (!config.model.trim()) {
      document.getElementById('agent-model-id')?.focus()
      return t('gitAgent.requiredFields')
    }
    if (preset.requiresKey && !config.apiKey?.trim()) {
      document.getElementById('agent-api-key')?.focus()
      return t('gitAgent.keyRequired')
    }
    if (!isModelAllowed(config.model.trim(), channelFilter)) {
      document.getElementById('agent-model-id')?.focus()
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
    const message = validateAndFocus()
    setError(message)
    if (message) return
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
    setTesting(true)
    setTestState('loading')
    setTestTooltip('正在测试连接，请稍候…')
    try {
      const res = await testAgentConnection(validatedConfig())
      if (res.ok) {
        setTestState('success')
        setTestTooltip(`连接成功${res.latencyMs ? ` (${res.latencyMs}ms)` : ''}`)
      } else {
        setTestState('failure')
        setTestTooltip(res.error || '连接测试失败')
      }
    } catch (err) {
      setTestState('failure')
      setTestTooltip(err instanceof Error ? err.message : '连接测试失败')
    } finally {
      setTesting(false)
      resetTimerRef.current = window.setTimeout(() => {
        setTestState('idle')
        setTestTooltip('')
        resetTimerRef.current = null
      }, 5000)
    }
  }

  async function handleFetchModels() {
    if (!config.baseUrl) {
      setModelsFetchFailed(true)
      setModelsFetchMsg('请先填写接入地址')
      return
    }
    if (preset.requiresKey && !config.apiKey) {
      setModelsFetchFailed(true)
      setModelsFetchMsg(`${preset.name} 需先在上方填写 API 密钥，才能拉取在线模型`)
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
    setTestState('idle')
    setTestTooltip('')
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
      router.push('/settings/models')
    }
  }

  function handleDelete() {
    if (profiles.length <= 1) return
    deleteProfile(draft.id)
    handleNavigateBack()
  }

  const showApiKeyField = config.provider !== 'local-sdk'

  let testButtonContent: React.ReactNode = (
    <>
      <LuActivity aria-hidden="true" />
      {t('gitAgent.testConnection')}
    </>
  )
  let buttonTooltip = testTooltip || t('gitAgent.testConnection') || '测试连接'
  const isButtonDisabled = testing || testState === 'loading'

  if (testState === 'loading') {
    testButtonContent = <Spinner className="size-3.5 text-accent" />
    buttonTooltip = '正在测试连接中，请稍候…'
  } else if (testState === 'success') {
    testButtonContent = <IoCheckmark className="size-4 text-ok" />
  } else if (testState === 'failure') {
    testButtonContent = <LuTriangleAlert className="size-4 text-fail" />
  }

  const content = (
    <div className="flex flex-col gap-4">
      <SettingsSectionCard
        title={isNew ? '新增模型接入项目' : t('gitAgent.modelDetails')}
        description={isNew ? '配置新模型渠道、接口地址与黑白名单。' : '修改渠道接口地址、默认模型与黑白名单。'}
        titleAction={
          !isNew && profiles.length > 1 ? (
            <Button variant="outline-fail" size="sm" onClick={handleDelete} title="删除该模型配置">
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
            const message = validateAndFocus()
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
          <fieldset disabled={testing} className="divide-y divide-line/60">
            {/* Row 1: Profile Name */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 first:pt-0 items-center">
              <div className="md:col-span-5 min-w-0">
                <label htmlFor="agent-model-name" className="text-xs font-semibold text-ink">
                  {t('gitAgent.profileName')}
                </label>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">便于辨识的配置别名。</p>
              </div>
              <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full">
                <TextInput
                  id="agent-model-name"
                  fullWidth
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="例如：DeepSeek-V3 / 团队网关"
                />
              </div>
            </div>

            {/* Row 2: Provider */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
              <div className="md:col-span-5 min-w-0">
                <span className="text-xs font-semibold text-ink" id="agent-provider-label">
                  {t('gitAgent.modelProvider')}
                </span>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{preset.description || '服务商协议或网络直连方式。'}</p>
              </div>
              <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex flex-col gap-2">
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
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
              <div className="md:col-span-5 min-w-0">
                <label htmlFor="agent-model-endpoint" className="text-xs font-semibold text-ink">
                  {t('gitAgent.endpoint')}
                </label>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">OpenAPI 规范的服务基地址。</p>
              </div>
              <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full">
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
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
              <div className="md:col-span-5 min-w-0">
                <label htmlFor="agent-models-endpoint" className="text-xs font-semibold text-ink">
                  {t('integration.agentModelsEndpoint') || '模型列表接口'}
                </label>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{t('integration.agentModelsEndpointDesc') || '可选。自定义拉取可用模型的接口路径。'}</p>
              </div>
              <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full">
                <TextInput
                  id="agent-models-endpoint"
                  fullWidth
                  value={config.modelsEndpoint || ''}
                  onChange={(event) => updateConfig({ modelsEndpoint: event.target.value })}
                  placeholder="默认 /models，或填相对路径 / 完整 URL"
                />
              </div>
            </div>

            {/* Row 5: API Key (Placed before Model Selection) */}
            {showApiKeyField && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
                <div className="md:col-span-5 min-w-0">
                  <label htmlFor="agent-api-key" className="text-xs font-semibold text-ink">
                    {t('gitAgent.apiKey')}
                  </label>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">仅在客户端内存暂存，刷新即清空。</p>
                </div>
                <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full">
                  <ConfiguredSecretInput
                    key={config.provider}
                    configured={Boolean(draft.config.apiKey) && !clearKey}
                    value={keyDraft}
                    onChange={(value) => {
                      setKeyDraft(value)
                      setTestState('idle')
                      setTestTooltip('')
                      setError('')
                    }}
                    onClear={() => {
                      setKeyDraft('')
                      setClearKey(true)
                      setTestState('idle')
                      setTestTooltip('')
                    }}
                  />
                </div>
              </div>
            )}

            {/* Row 6: Default Model with InputSuggestion, Fetch Action, and zero-displacement attached error */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
              <div className="md:col-span-5 min-w-0">
                <label htmlFor="agent-model-id" className="text-xs font-semibold text-ink">
                  {t('gitAgent.defaultModel') || '默认模型'}
                </label>
                <p className="text-xs text-ink-soft leading-relaxed mt-0.5">从远程拉取可用清单或直接输入模型代码。</p>
              </div>
              <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex flex-col gap-1">
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
                    placeholder={preset.requiresKey && !config.apiKey ? '请先填写上方 API Key，再拉取或输入模型 ID' : '点击右侧按钮拉取，或直接输入模型 ID'}
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
          </fieldset>

          {/* Model Whitelist & Blacklist Follows Model Channel */}
          <div className="border-t border-line/60 pt-3 flex flex-col gap-3">
            <div>
              <h3 className="text-xs font-semibold text-ink">渠道白名单 / 黑名单</h3>
              <p className="text-xs text-ink-soft leading-relaxed mt-0.5">仅作用于当前「{draft.name || '该'}」渠道。黑名单优先，命中即禁。</p>
            </div>

            {/* Whitelist / Blacklist Conflicts Notice */}
            {filterConflicts.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
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
                  <label htmlFor="agent-channel-whitelist" className="text-xs font-semibold text-ink">
                    {t('gitAgent.modelWhitelist')}
                  </label>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{t('gitAgent.modelWhitelistDesc')}</p>
                </div>
                <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex justify-end">
                  <TagInput
                    id="agent-channel-whitelist"
                    className="w-full"
                    value={channelFilter.whitelist}
                    onChange={(whitelist) => setDraft((prev) => ({ ...prev, filter: { ...prev.filter, whitelist, blacklist: prev.filter?.blacklist || [] } }))}
                    placeholder="如 gpt-*、*-mini，回车添加..."
                  />
                </div>
              </div>

              {/* Blacklist Input */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
                <div className="md:col-span-5 min-w-0">
                  <label htmlFor="agent-channel-blacklist" className="text-xs font-semibold text-ink">
                    {t('gitAgent.modelBlacklist')}
                  </label>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{t('gitAgent.modelBlacklistDesc')}</p>
                </div>
                <div className="md:col-span-7 min-w-0 max-w-[460px] md:ml-auto w-full flex justify-end">
                  <TagInput
                    id="agent-channel-blacklist"
                    className="w-full"
                    value={channelFilter.blacklist}
                    onChange={(blacklist) => setDraft((prev) => ({ ...prev, filter: { ...prev.filter, blacklist, whitelist: prev.filter?.whitelist || [] } }))}
                    placeholder="如 *-mini、gpt-3.5*，回车添加..."
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

          <div className="flex items-center justify-between gap-3 border-t border-line pt-3 mt-1">
            <Button onClick={handleNavigateBack} disabled={testing || testState === 'loading'}>
              <LuArrowLeft aria-hidden="true" />
              {t('gitAgent.backToModels')}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                disabled={isButtonDisabled}
                onClick={handleTest}
                className={cn(testState !== 'idle' && 'min-w-[40px] px-2.5 justify-center')}
                tooltip={buttonTooltip}
                aria-label={buttonTooltip}
              >
                {testButtonContent}
              </Button>
              <Button type="submit" variant="accent" disabled={testing || testState === 'loading'}>
                <LuSave aria-hidden="true" />
                {t('common.save')}
              </Button>
            </div>
          </div>
        </form>
      </SettingsSectionCard>
    </div>
  )
  return showTools ? <SettingsColumns tools={<RuleDebugger filter={channelFilter} modelId={config.model} />}>{content}</SettingsColumns> : content
}
