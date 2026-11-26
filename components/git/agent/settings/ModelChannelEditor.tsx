'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AiOutlineFileSync } from 'react-icons/ai'
import { IoCheckmark } from 'react-icons/io5'
import { LuActivity, LuArrowLeft, LuRefreshCw, LuSave, LuShieldCheck, LuTrash2, LuTriangleAlert } from 'react-icons/lu'

import { ConfiguredSecretInput } from '@/components/ConfiguredSecretInput/configured-secret-input'
import { useOptionalConfirm } from '@/components/confirm/ConfirmProvider'
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
  const { saveProfile, deleteProfile } = useAgent()
  const confirm = useOptionalConfirm()

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
    // Hardcoded preset models list is removed per UX requirement (require API key before selecting a model).
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
    setTestTooltip('Testing connection, please wait…')
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
        setTestTooltip(`Connected${res.latencyMs ? ` (${res.latencyMs}ms)` : ''}`)
      } else {
        setTestState('failure')
        setTestTooltip(res.error || 'Connection test failed')
      }
      if (isBrowserAi) {
        setBrowserAiRefreshSignal((n) => n + 1)
      }
    } catch (err) {
      setTestState('failure')
      setTestTooltip(err instanceof Error ? err.message : 'Connection test failed')
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
          setModelsFetchMsg(`Loaded ${data.models.length} available models`)
        } else {
          setModelsFetchFailed(true)
          setModelsFetchMsg('Could not load CLI model list; enter a model ID directly')
        }
      } catch {
        setModelsFetchFailed(true)
        setModelsFetchMsg('Could not load CLI model list; enter a model ID directly')
      } finally {
        setFetchingModels(false)
      }
      return
    }

    if (!config.baseUrl) {
      setModelsFetchFailed(true)
      setModelsFetchMsg('Please enter an endpoint URL first')
      return
    }
    if (preset.requiresKey && !config.apiKey && !hasSavedApiKey) {
      setModelsFetchFailed(true)
      setModelsFetchMsg(`${preset.name} requires an API key above before fetching models`)
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
        setModelsFetchMsg(`Loaded ${data.models.length} available models`)
      } else {
        setModelsFetchFailed(true)
        setModelsFetchMsg(data?.message || 'Could not fetch models from server; using preset list')
      }
    } catch {
      setModelsFetchFailed(true)
      setModelsFetchMsg('Could not fetch models from server; using preset list')
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
    const performDelete = async () => {
      try {
        await deleteProfile(draft.id)
        notify.success('Model configuration deleted')
        handleNavigateBack()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to delete model configuration'
        notify.error(msg)
        throw err
      }
    }

    if (!confirm) {
      void performDelete().catch(() => {})
      return
    }

    void confirm({
      title: `Delete "${draft.name || config.model || draft.id}"?`,
      description: 'This model configuration and its stored credentials will be removed.',
      confirmLabel: t('common.remove') || 'Delete',
      confirmVariant: 'fail',
      onConfirm: performDelete,
    })
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

  const testActionLabel = isBrowserAi ? t('gitAgent.browserAiRefreshBtn') || 'Re-check' : t('gitAgent.testConnection')
  let testButtonContent: React.ReactNode = (
    <>
      {isBrowserAi ? <LuRefreshCw aria-hidden="true" /> : <LuActivity aria-hidden="true" />}
      {testActionLabel}
    </>
  )
  let buttonTooltip = testTooltip || testActionLabel || 'Test connection'
  const isLocalNotReady = Boolean(localModelControl && !localModelControl.isReady)
  const isButtonDisabled = testing || testState === 'loading' || isLocalNotReady

  if (testState === 'loading') {
    testButtonContent = <Spinner className="size-3.5 text-accent" />
    buttonTooltip = 'Testing connection, please wait…'
  } else if (isLocalNotReady) {
    buttonTooltip = 'Model is not ready yet; download or install it first'
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
          title={isNew ? 'Add Model Channel' : t('gitAgent.modelDetails')}
          description={isNew ? 'Configure a new model channel and endpoint.' : 'Update channel endpoint and default model.'}
          titleAction={
            <SwitchToggle
              size="sm"
              checked={!isLocalNotReady && draft.enabled !== false}
              disabled={isLocalNotReady}
              aria-label={!isLocalNotReady && draft.enabled !== false ? t('gitAgent.skillEnabled') || 'Enabled' : t('gitAgent.skillDisabled') || 'Disabled'}
              tooltip={
                isLocalNotReady
                  ? 'Model is not ready yet; download or install it first'
                  : draft.enabled !== false
                    ? t('gitAgent.skillEnabled') || 'Enabled'
                    : t('gitAgent.skillDisabled') || 'Disabled'
              }
              onCheckedChange={(checked) => {
                if (isLocalNotReady) return
                setDraft((prev) => ({ ...prev, enabled: checked }))
              }}
            />
          }
        >
          <div className="flex flex-col">
            <fieldset disabled={testing} className="divide-y divide-line/60">
              {/* Row 1: Profile Name */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 first:pt-0 items-center">
                <div className="md:col-span-6 min-w-0">
                  <label htmlFor="agent-model-name" className="text-xs font-semibold text-ink">
                    {t('gitAgent.profileName')}
                  </label>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">A recognizable alias for this channel.</p>
                </div>
                <div className="md:col-span-6 min-w-0 max-w-[340px] md:ml-auto w-full">
                  <TextInput
                    id="agent-model-name"
                    fullWidth
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder={t('gitAgent.channelNamePlaceholder') || 'e.g. DeepSeek-V3 / Team Gateway'}
                  />
                </div>
              </div>

              {/* Row 2: Provider */}
              <div className={cn('grid grid-cols-1 md:grid-cols-12 gap-3 py-3', preset.noZdrNotice ? 'items-start' : 'items-center')}>
                <div className={cn('md:col-span-6 min-w-0', preset.noZdrNotice && 'pt-1.5')}>
                  <span className="text-xs font-semibold text-ink" id="agent-provider-label">
                    {t('gitAgent.modelProvider')}
                  </span>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{preset.description || 'Provider protocol or direct connection.'}</p>
                </div>
                <div className="md:col-span-6 min-w-0 max-w-[340px] md:ml-auto w-full flex flex-col gap-2">
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
                          const suffix = def.isCli && cliInfo ? (cliInfo.installed ? ' (Installed)' : ' (Not detected)') : ''
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
                    <div className="md:col-span-6 min-w-0">
                      <label htmlFor="agent-cli-command" className="text-xs font-semibold text-ink">
                        CLI Executable / Path
                      </label>
                      <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                        {preset.cliAdapter && detectedClis[preset.cliAdapter]?.installed
                          ? `Detected local CLI: ${detectedClis[preset.cliAdapter].command}`
                          : 'Leave empty to auto-detect from system PATH or common locations, or specify an absolute path.'}
                      </p>
                    </div>
                    <div className="md:col-span-6 min-w-0 max-w-[340px] md:ml-auto w-full">
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
                    <div className="md:col-span-6 min-w-0">
                      <label htmlFor="agent-model-endpoint" className="text-xs font-semibold text-ink">
                        {t('gitAgent.endpoint')}
                      </label>
                      <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{t('gitAgent.endpointDesc') || 'OpenAI-compatible service base URL.'}</p>
                    </div>
                    <div className="md:col-span-6 min-w-0 max-w-[340px] md:ml-auto w-full">
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
                  <div className="md:col-span-6 min-w-0">
                    <label htmlFor="agent-models-endpoint" className="text-xs font-semibold text-ink">
                      {t('integration.agentModelsEndpoint') || 'Models Endpoint'}
                    </label>
                    <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                      {t('integration.agentModelsEndpointDesc') || 'Optional. Custom path or URL to fetch available models.'}
                    </p>
                  </div>
                  <div className="md:col-span-6 min-w-0 max-w-[340px] md:ml-auto w-full">
                    <TextInput
                      id="agent-models-endpoint"
                      fullWidth
                      value={config.modelsEndpoint || ''}
                      onChange={(event) => updateConfig({ modelsEndpoint: event.target.value })}
                      placeholder={t('gitAgent.modelsEndpointPlaceholder') || 'Default /models, or relative path / full URL'}
                    />
                  </div>
                </div>
              )}

              {/* Row 5: API Key (Placed before Model Selection) */}
              {showApiKeyField && (
                <div className={cn('grid grid-cols-1 md:grid-cols-12 gap-3 py-3', getDriverMode() === 'edge' ? 'items-start' : 'items-center')}>
                  <div className={cn('md:col-span-6 min-w-0', getDriverMode() === 'edge' && 'pt-1.5')}>
                    <label htmlFor="agent-api-key" className="text-xs font-semibold text-ink">
                      {t('gitAgent.apiKey')}
                    </label>
                    <p className="text-xs text-ink-soft leading-relaxed mt-0.5">All tokens are strongly encrypted and stored locally; plaintext is never persisted.</p>
                  </div>
                  <div className="md:col-span-6 min-w-0 max-w-[340px] md:ml-auto w-full">
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
                          <p className="font-semibold text-accent">{t('gitAgent.edgeSecurityNoticeTitle') || 'Key Security & Privacy Notice'}</p>
                          <p className="text-ink-soft">
                            {t('gitAgent.edgeSecurityNoticeBody') ||
                              'We recommend forwarding requests through a proxy to avoid exposing real keys. If entering a key directly, issue a dedicated key for this service and never reuse it elsewhere. All tokens are encrypted and stored locally in your environment; no configuration data is collected.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Row 6: Default Model with InputSuggestion, unified local/browser AI status & download action */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
                <div className="md:col-span-6 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="agent-model-id" className="text-xs font-semibold text-ink">
                      {t('gitAgent.defaultModel') || 'Default Model'}
                    </label>
                    {localModelControl?.runtimeBadge && (
                      <Badge tone={localModelControl.runtimeBadge.isWebGpu ? 'accent' : 'neutral'} size="mini" dot={false}>
                        {localModelControl.runtimeBadge.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">
                    {localModelControl ? localModelControl.description : 'Fetch available models from remote or enter a model ID directly.'}
                  </p>
                </div>
                <div className="md:col-span-6 min-w-0 max-w-[340px] md:ml-auto w-full flex flex-col gap-1">
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
                    placeholder={
                      preset.requiresKey && !config.apiKey && !hasSavedApiKey
                        ? t('gitAgent.modelSelectNeedKeyPlaceholder') || 'Enter API Key above first, then fetch or type a model ID'
                        : t('gitAgent.modelSelectPlaceholder') || 'Click the button on the right to fetch, or enter a model ID'
                    }
                    progress={localModelControl?.progress}
                    action={
                      localModelControl
                        ? localModelControl.action
                        : {
                            icon: <AiOutlineFileSync className={cn('size-3.5', fetchingModels && 'animate-spin')} />,
                            title: 'Fetch model list from remote endpoint',
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
                    {t('gitAgent.browserLocalClearBtn') || 'Clear Local Model'}
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
                {!isNew && (
                  <Button type="button" variant="outline-fail" onClick={handleDelete} disabled={testing || testState === 'loading'} title="Delete this model configuration">
                    <LuTrash2 aria-hidden="true" />
                    Delete
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
  return showTools ? (
    <SettingsColumns className="max-w-[1160px] @min-[960px]/settings:grid-cols-[minmax(0,780px)_340px]" tools={<RuleDebugger filter={channelFilter} modelId={config.model} />}>
      {content}
    </SettingsColumns>
  ) : (
    content
  )
}
