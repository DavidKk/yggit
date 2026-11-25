'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AiOutlineFileSync } from 'react-icons/ai'
import { IoCheckmark } from 'react-icons/io5'
import { LuActivity, LuArrowLeft, LuRefreshCw, LuSave, LuShieldCheck, LuTrash2, LuTriangleAlert } from 'react-icons/lu'

import { ConfiguredSecretInput } from '@/components/ConfiguredSecretInput/configured-secret-input'
import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Badge, Button, InputSuggestion, Select, Spinner, SwitchToggle, TextInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { unloadAndClearBrowserLocalModel } from '@/lib/agent/browser-local'
import { filterAllowedModels, getModelFilterConflicts, isModelAllowed } from '@/lib/agent/model-filter'
import type { AgentModelProfile } from '@/lib/agent/model-profiles'
import { testAgentConnection } from '@/lib/agent/openapi-client'
import { AGENT_PRESETS, type AgentProviderType, DEFAULT_AGENT_CONFIG, OPENAPI_ENDPOINT_SUGGESTIONS } from '@/lib/agent/types'
import { getDriverMode } from '@/lib/git/driver'
import { openEdgeSecret } from '@/lib/security/edge-vault'
import { cn } from '@/lib/utils'

import { BrowserAiDebug } from './BrowserAiDebug'
import { ModelFilterInputs } from './ModelFilterInputs'
import { PrivacyNoticeCallout } from './PrivacyNoticeCallout'
import { RuleDebugger } from './RuleDebugger'
import { SettingsColumns } from './SettingsColumns'
import { SettingsSectionCard } from './SettingsSectionCard'
import { useLocalModelControl } from './useLocalModelControl'

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
          modelsEndpoint: preset.modelsEndpoint || '',
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
  const [detectedClis, setDetectedClis] = useState<Record<string, { command: string; installed: boolean }>>({})
  const [browserAiRefreshSignal, setBrowserAiRefreshSignal] = useState(0)

  const isLocalMode = getDriverMode() === 'local'

  useEffect(() => {
    if (!isLocalMode || typeof fetch !== 'function') return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/git/agent/cli', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'detect' }),
        })
        if (!res.ok) return
        const data = (await res.json()) as { installed?: Record<string, { command: string; installed: boolean }> }
        if (!cancelled && data?.installed) {
          setDetectedClis(data.installed)
        }
      } catch {
        // Ignore detection errors
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isLocalMode])

  const preset = AGENT_PRESETS[draft.config.provider] || AGENT_PRESETS['byop']
  const hasSavedApiKey = Boolean(draft.config.apiKey || draft.config.hasApiKey) && !clearKey
  const config = {
    ...draft.config,
    apiKey: keyDraft.trim() || (clearKey ? '' : draft.config.apiKey),
    hasApiKey: hasSavedApiKey || Boolean(keyDraft.trim()),
  }
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
    if (!preset.isCli && config.provider !== 'browser-ai' && config.provider !== 'browser-local') {
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
    }
    if (!config.model.trim()) {
      document.getElementById('agent-model-id')?.focus()
      return t('gitAgent.requiredFields')
    }
    if (preset.requiresKey && !config.apiKey?.trim() && !hasSavedApiKey) {
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
      const cfg = validatedConfig()
      if (getDriverMode() === 'edge' && !cfg.apiKey && hasSavedApiKey) {
        const ephemeralKey = await openEdgeSecret(draft.id)
        if (ephemeralKey) {
          cfg.apiKey = ephemeralKey
        }
      }
      const res = !cfg.apiKey && hasSavedApiKey ? await testAgentConnection(cfg, draft.id) : await testAgentConnection(cfg)
      if (res.ok) {
        setTestState('success')
        setTestTooltip(`连接成功${res.latencyMs ? ` (${res.latencyMs}ms)` : ''}`)
      } else {
        setTestState('failure')
        setTestTooltip(res.error || '连接测试失败')
      }
      if (isBrowserAi) {
        setBrowserAiRefreshSignal((n) => n + 1)
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
    if (preset.isCli) {
      setFetchingModels(true)
      setModelsFetchMsg('')
      setModelsFetchFailed(false)
      try {
        const res = await fetch('/api/git/agent/cli', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'models',
            provider: config.provider,
            cliCommand: config.cliCommand || config.baseUrl,
          }),
        })
        const data = await res.json().catch(() => null)
        if (res.ok && data?.models && data.models.length > 0) {
          setRemoteModels(data.models)
          setModelsFetchFailed(false)
          setModelsFetchMsg(`已成功读取 ${data.models.length} 个可用模型`)
        } else {
          setModelsFetchFailed(true)
          setModelsFetchMsg('未能读取 CLI 模型列表，请直接输入模型 ID')
        }
      } catch {
        setModelsFetchFailed(true)
        setModelsFetchMsg('未能读取 CLI 模型列表，请直接输入模型 ID')
      } finally {
        setFetchingModels(false)
      }
      return
    }

    if (!config.baseUrl) {
      setModelsFetchFailed(true)
      setModelsFetchMsg('请先填写接入地址')
      return
    }
    if (preset.requiresKey && !config.apiKey && !hasSavedApiKey) {
      setModelsFetchFailed(true)
      setModelsFetchMsg(`${preset.name} 需先在上方填写 API 密钥，才能拉取在线模型`)
      return
    }
    setFetchingModels(true)
    setModelsFetchMsg('')
    setModelsFetchFailed(false)
    try {
      let effectiveApiKey = config.apiKey
      if (getDriverMode() === 'edge' && !effectiveApiKey && hasSavedApiKey) {
        effectiveApiKey = await openEdgeSecret(draft.id)
      }
      const res = await fetch('/api/git/agent/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: effectiveApiKey,
          ...(!effectiveApiKey && hasSavedApiKey ? { profileId: draft.id } : {}),
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
    if (router?.replace) {
      router.replace('/settings/models')
    } else if (router?.push) {
      router.push('/settings/models')
    }
  }

  function handleDelete() {
    if (profiles.length <= 1) return
    deleteProfile(draft.id)
    handleNavigateBack()
  }

  const notify = useNotification()
  const [localCacheRevision, setLocalCacheRevision] = useState(0)
  const [clearingLocalCache, setClearingLocalCache] = useState(false)

  const isBrowserAi = config.provider === 'browser-ai'
  const isBrowserLocal = config.provider === 'browser-local'
  const showApiKeyField = config.provider !== 'local-sdk' && !isBrowserAi && !isBrowserLocal
  const localModelControl = useLocalModelControl({
    provider: config.provider,
    modelId: config.model,
    browserAiRefreshSignal,
    localCacheRevision,
  })

  async function handleClearLocalModels() {
    setClearingLocalCache(true)
    try {
      const removed = await unloadAndClearBrowserLocalModel()
      setLocalCacheRevision((prev) => prev + 1)
      if (removed > 0) {
        notify.success((t('gitAgent.browserLocalClearSuccess') || 'Cleared local model cache ({count} files)').replace('{count}', String(removed)))
      } else {
        notify.info(t('gitAgent.browserLocalClearEmpty') || 'No local model cache to clear')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      notify.error((t('gitAgent.browserLocalClearFailed') || 'Failed to clear local model cache: {error}').replace('{error}', message))
    } finally {
      setClearingLocalCache(false)
    }
  }

  const testActionLabel = isBrowserAi ? t('gitAgent.browserAiRefreshBtn') || '重新检测' : t('gitAgent.testConnection')
  let testButtonContent: React.ReactNode = (
    <>
      {isBrowserAi ? <LuRefreshCw aria-hidden="true" /> : <LuActivity aria-hidden="true" />}
      {testActionLabel}
    </>
  )
  let buttonTooltip = testTooltip || testActionLabel || '测试连接'
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
    <>
      {process.env.NODE_ENV === 'development' && isBrowserAi ? <BrowserAiDebug /> : null}
      <form
        className="flex flex-col gap-4"
        autoComplete="off"
        data-1p-ignore="true"
        data-lpignore="true"
        onSubmit={(event) => {
          event.preventDefault()
          const message = validateAndFocus()
          setError(message)
          if (message) return
          const cleared = clearKey && !keyDraft.trim()
          saveProfile(
            {
              ...draft,
              name: draft.name.trim(),
              config: validatedConfig(),
              filter: channelFilter,
            },
            cleared ? { clearApiKey: true } : undefined
          )
          handleNavigateBack()
        }}
      >
        <SettingsSectionCard
          title={isNew ? '新增模型接入项目' : t('gitAgent.modelDetails')}
          description={isNew ? '配置新模型渠道与接口地址。' : '修改渠道接口地址与默认模型。'}
          titleAction={
            <SwitchToggle
              size="sm"
              checked={draft.enabled !== false}
              aria-label={draft.enabled !== false ? t('gitAgent.skillEnabled') || '已启用' : t('gitAgent.skillDisabled') || '已禁用'}
              tooltip={draft.enabled !== false ? t('gitAgent.skillEnabled') || '已启用' : t('gitAgent.skillDisabled') || '已禁用'}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, enabled: checked }))}
            />
          }
        >
          <div className="flex flex-col">
            <fieldset disabled={testing} className="divide-y divide-line/60">
              {/* Row 1: Profile Name */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 first:pt-0 items-center">
                <div className="md:col-span-4 min-w-0">
                  <label htmlFor="agent-model-name" className="text-xs font-semibold text-ink">
                    {t('gitAgent.profileName')}
                  </label>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">便于辨识的配置别名。</p>
                </div>
                <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full">
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
              <div className={cn('grid grid-cols-1 md:grid-cols-12 gap-3 py-3', preset.noZdrNotice ? 'items-start' : 'items-center')}>
                <div className={cn('md:col-span-4 min-w-0', preset.noZdrNotice && 'pt-1.5')}>
                  <span className="text-xs font-semibold text-ink" id="agent-provider-label">
                    {t('gitAgent.modelProvider')}
                  </span>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{preset.description || '服务商协议或网络直连方式。'}</p>
                </div>
                <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full flex flex-col gap-2">
                  <Select
                    aria-labelledby="agent-provider-label"
                    className="w-full"
                    value={config.provider}
                    options={(() => {
                      const groups: AgentProviderType[][] = [
                        ['browser-ai', 'browser-local', 'ollama', 'local-sdk', 'magpie'],
                        ['vercel-free', 'kilo-free', 'chatgpt', 'openai', 'claude', 'gemini', 'deepseek', 'byop'],
                        ['claude-cli', 'codex-cli', 'antigravity-cli', 'cursor-cli', 'gemini-cli'],
                      ]
                      const seen = new Set<AgentProviderType>()
                      const items: Array<{ value: string; label: string; divider?: boolean }> = []
                      for (const providers of groups) {
                        const available = providers.filter((value) => {
                          if (!(value in AGENT_PRESETS) || seen.has(value)) return false
                          return isLocalMode || !AGENT_PRESETS[value].isCli || value === config.provider
                        })
                        if (available.length === 0) continue
                        const needsDivider = items.length > 0
                        available.forEach((value, idx) => {
                          seen.add(value)
                          const def = AGENT_PRESETS[value]
                          const cliInfo = def.cliAdapter ? detectedClis[def.cliAdapter] : undefined
                          const suffix = def.isCli && cliInfo ? (cliInfo.installed ? ' (已安装)' : ' (未检测到)') : ''
                          items.push({
                            value,
                            label: `${def.name}${suffix}`,
                            ...(needsDivider && idx === 0 ? { divider: true } : {}),
                          })
                        })
                      }
                      return items
                    })()}
                    onChange={(value) => {
                      const provider = value as AgentProviderType
                      const next = AGENT_PRESETS[provider]
                      const detectedCmd = next.cliAdapter ? detectedClis[next.cliAdapter]?.command : undefined
                      updateConfig({
                        provider,
                        baseUrl: next.baseUrl,
                        cliCommand: next.isCli ? detectedCmd || next.baseUrl : undefined,
                        model: next.defaultModel,
                        apiKey: '',
                        modelsEndpoint: next.modelsEndpoint || '',
                      })
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

              {/* Row 3: Local CLI Path or API Endpoint (Browser AI & Browser Local AI live inside Default Model row) */}
              {!isBrowserAi &&
                !isBrowserLocal &&
                (preset.isCli ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
                    <div className="md:col-span-4 min-w-0">
                      <label htmlFor="agent-cli-command" className="text-xs font-semibold text-ink">
                        CLI 可执行命令 / 路径
                      </label>
                      <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                        {preset.cliAdapter && detectedClis[preset.cliAdapter]?.installed
                          ? `已自动检测到本机 CLI: ${detectedClis[preset.cliAdapter].command}`
                          : '留空将自动从系统 PATH 或常用目录查找；也可手动指定绝对路径。'}
                      </p>
                    </div>
                    <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full">
                      <TextInput
                        id="agent-cli-command"
                        fullWidth
                        value={config.cliCommand ?? config.baseUrl ?? ''}
                        onChange={(event) => updateConfig({ cliCommand: event.target.value })}
                        placeholder={preset.baseUrl}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
                    <div className="md:col-span-4 min-w-0">
                      <label htmlFor="agent-model-endpoint" className="text-xs font-semibold text-ink">
                        {t('gitAgent.endpoint')}
                      </label>
                      <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{t('gitAgent.endpointDesc') || 'OpenAPI 规范的服务基地址。'}</p>
                    </div>
                    <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full">
                      <InputSuggestion
                        id="agent-model-endpoint"
                        name="agent-model-endpoint"
                        fullWidth
                        value={config.baseUrl || ''}
                        onChange={(value) => {
                          const matched = OPENAPI_ENDPOINT_SUGGESTIONS.find((s) => s.baseUrl === value.trim())
                          updateConfig(matched?.modelsEndpoint ? { baseUrl: value, modelsEndpoint: matched.modelsEndpoint } : { baseUrl: value })
                        }}
                        options={[
                          ...(!OPENAPI_ENDPOINT_SUGGESTIONS.some((s) => s.baseUrl === preset.baseUrl)
                            ? [{ value: preset.baseUrl, label: `${preset.name} (${preset.baseUrl})` }]
                            : []),
                          ...OPENAPI_ENDPOINT_SUGGESTIONS.map((s) => ({
                            value: s.baseUrl,
                            label: `${s.label} — ${s.baseUrl}`,
                          })),
                        ]}
                        placeholder={t('gitAgent.endpointPlaceholder')}
                      />
                    </div>
                  </div>
                ))}

              {/* Row 4: Custom Models Catalog Endpoint (Hidden for CLI, Browser AI, and Browser Local AI providers) */}
              {!preset.isCli && !isBrowserAi && !isBrowserLocal && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
                  <div className="md:col-span-4 min-w-0">
                    <label htmlFor="agent-models-endpoint" className="text-xs font-semibold text-ink">
                      {t('integration.agentModelsEndpoint') || '模型列表接口'}
                    </label>
                    <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{t('integration.agentModelsEndpointDesc') || '可选。自定义拉取可用模型的接口路径。'}</p>
                  </div>
                  <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full">
                    <TextInput
                      id="agent-models-endpoint"
                      fullWidth
                      value={config.modelsEndpoint || ''}
                      onChange={(event) => updateConfig({ modelsEndpoint: event.target.value })}
                      placeholder="默认 /models，或填相对路径 / 完整 URL"
                    />
                  </div>
                </div>
              )}

              {/* Row 5: API Key (Placed before Model Selection) */}
              {showApiKeyField && (
                <div className={cn('grid grid-cols-1 md:grid-cols-12 gap-3 py-3', getDriverMode() === 'edge' ? 'items-start' : 'items-center')}>
                  <div className={cn('md:col-span-4 min-w-0', getDriverMode() === 'edge' && 'pt-1.5')}>
                    <label htmlFor="agent-api-key" className="text-xs font-semibold text-ink">
                      {t('gitAgent.apiKey')}
                    </label>
                    <p className="text-xs text-ink-soft leading-relaxed mt-0.5">所有 Token 均经高强度加密后保存在本地安全库中，不保留明文。</p>
                  </div>
                  <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full">
                    <ConfiguredSecretInput
                      key={config.provider}
                      configured={hasSavedApiKey}
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
                    {getDriverMode() === 'edge' && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/8 px-3 py-2 text-[11px] text-ink">
                        <LuShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
                        <div className="space-y-0.5 leading-relaxed">
                          <p className="font-semibold text-accent">{t('gitAgent.edgeSecurityNoticeTitle') || '密钥安全与隐私说明'}</p>
                          <p className="text-ink-soft">
                            {t('gitAgent.edgeSecurityNoticeBody') ||
                              '建议通过代理层转发请求以避免真实 Key 泄露；若直接填写 Key，请务必为本服务单独签发专用 Key，切勿与其他服务共用。本服务所有 Token 均加密后仅保存在您的本地环境中，不会收集任何相关配置信息。'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Row 6: Default Model with InputSuggestion, unified local/browser AI status & download action */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
                <div className="md:col-span-4 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="agent-model-id" className="text-xs font-semibold text-ink">
                      {t('gitAgent.defaultModel') || '默认模型'}
                    </label>
                    {localModelControl?.runtimeBadge && (
                      <Badge tone={localModelControl.runtimeBadge.isWebGpu ? 'accent' : 'neutral'} size="mini" dot={false}>
                        {localModelControl.runtimeBadge.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{localModelControl ? localModelControl.description : '从远程拉取可用清单或直接输入模型代码。'}</p>
                </div>
                <div className="md:col-span-8 min-w-0 max-w-[460px] md:ml-auto w-full flex flex-col gap-1">
                  <InputSuggestion
                    id="agent-model-id"
                    name="agent-model-id"
                    value={config.model}
                    readOnly={localModelControl?.readOnly}
                    hideDropdown={localModelControl?.hideDropdown}
                    invalid={modelsFetchFailed || isModelBlocked}
                    error={modelsFetchFailed && modelsFetchMsg ? modelsFetchMsg : isModelBlocked ? t('gitAgent.modelBlockedNotice') : undefined}
                    warn={localModelControl?.warn ?? (!modelsFetchFailed && modelsFetchMsg ? modelsFetchMsg : undefined)}
                    onChange={(val) => {
                      updateConfig({ model: val })
                      setModelsFetchFailed(false)
                      setModelsFetchMsg('')
                    }}
                    options={availableModels.map((m) => ({ value: m.id, label: m.name }))}
                    placeholder={preset.requiresKey && !config.apiKey && !hasSavedApiKey ? '请先填写上方 API Key，再拉取或输入模型 ID' : '点击右侧按钮拉取，或直接输入模型 ID'}
                    progress={localModelControl?.progress}
                    action={
                      localModelControl
                        ? localModelControl.action
                        : {
                            icon: <AiOutlineFileSync className={cn('size-3.5', fetchingModels && 'animate-spin')} />,
                            title: '从远程接口动态拉取模型列表',
                            loading: fetchingModels,
                            disabled: fetchingModels || testing,
                            onClick: handleFetchModels,
                          }
                    }
                  />
                </div>
              </div>
            </fieldset>

            {/* Merged Whitelist & Blacklist Section */}
            <ModelFilterInputs
              embedded
              whitelistId="agent-channel-whitelist"
              blacklistId="agent-channel-blacklist"
              whitelist={channelFilter.whitelist}
              blacklist={channelFilter.blacklist}
              onWhitelistChange={(whitelist) => setDraft((prev) => ({ ...prev, filter: { ...prev.filter, whitelist, blacklist: prev.filter?.blacklist || [] } }))}
              onBlacklistChange={(blacklist) => setDraft((prev) => ({ ...prev, filter: { ...prev.filter, blacklist, whitelist: prev.filter?.whitelist || [] } }))}
              conflicts={filterConflicts}
            />

            {error && (
              <p role="alert" className="mt-3 text-xs text-fail">
                {error}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/60 pt-3">
              <Button onClick={handleNavigateBack} disabled={testing || testState === 'loading'}>
                <LuArrowLeft aria-hidden="true" />
                {t('gitAgent.backToModels')}
              </Button>
              <div className="flex items-center gap-2">
                {isBrowserLocal && (
                  <Button type="button" variant="outline-fail" disabled={clearingLocalCache || testing || testState === 'loading'} onClick={() => void handleClearLocalModels()}>
                    {clearingLocalCache ? <Spinner className="size-3.5" /> : <LuTrash2 aria-hidden="true" />}
                    {t('gitAgent.browserLocalClearBtn') || '清理本地模型'}
                  </Button>
                )}
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
                {!isNew && profiles.length > 1 && (
                  <Button type="button" variant="outline-fail" onClick={handleDelete} disabled={testing || testState === 'loading'} title="删除该模型配置">
                    <LuTrash2 aria-hidden="true" />
                    删除
                  </Button>
                )}
                <Button type="submit" variant="accent" disabled={testing || testState === 'loading'}>
                  <LuSave aria-hidden="true" />
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </div>
        </SettingsSectionCard>
      </form>
    </>
  )
  return showTools ? <SettingsColumns tools={<RuleDebugger filter={channelFilter} modelId={config.model} />}>{content}</SettingsColumns> : content
}
