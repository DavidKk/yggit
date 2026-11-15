'use client'

import React, { useState } from 'react'
import { LuActivity, LuServer } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { formCard, formDesc, formField, formTitle, settingsCardWide } from '@/components/layoutClasses'
import { ApiKeyInput, Badge, Button, Select, type SelectOption, Spinner, TextInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { testAgentConnection } from '@/lib/agent/openapi-client'
import { AGENT_PRESETS, type AgentProviderType } from '@/lib/agent/types'

import { PrivacyNoticeCallout } from './PrivacyNoticeCallout'

export function ModelChannelSection() {
  const t = useT()
  const { config, setConfig } = useAgent()

  const [apiKeyUnlocked, setApiKeyUnlocked] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok?: boolean
    latencyMs?: number
    error?: string
  } | null>(null)

  const preset = AGENT_PRESETS[config.provider]

  const providerOptions: SelectOption[] = (Object.keys(AGENT_PRESETS) as AgentProviderType[]).map((key) => ({
    value: key,
    label: AGENT_PRESETS[key].name,
  }))

  const modelOptions: SelectOption[] = preset.models.map((m) => ({
    value: m.id,
    label: `${m.name} (${m.id})`,
  }))

  const handleProviderChange = (providerVal: string) => {
    const provider = providerVal as AgentProviderType
    const nextPreset = AGENT_PRESETS[provider]
    setConfig((prev) => ({
      ...prev,
      provider,
      baseUrl: nextPreset.baseUrl,
      model: nextPreset.defaultModel,
      apiKey: provider === 'vercel-free' ? '' : prev.apiKey,
    }))
    setApiKeyUnlocked(false)
    setTestResult(null)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testAgentConnection(config)
      setTestResult(res)
    } catch (err) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className={settingsCardWide}>
      {/* 1. Channel Preset Selector */}
      <section className={formCard}>
        <div className={formField}>
          <div className={formTitle}>{t('gitAgent.modelProvider')}</div>
          <p className={formDesc}>选择大模型接入渠道与协议（支持 Vercel AI Gateway 免费渠道、自定义 OpenAI 兼容接口或本地 Ollama）</p>
          <div className="pt-1">
            <Select className="w-full" value={config.provider} options={providerOptions} onChange={handleProviderChange} />
          </div>
        </div>

        {/* 2. Privacy Notice when Free Model Selected */}
        {preset.noZdrNotice && (
          <div>
            <PrivacyNoticeCallout />
          </div>
        )}

        {/* 3. API Base URL */}
        <div className={formField}>
          <div className="flex items-center gap-1.5">
            <LuServer className="size-3.5 text-ink-soft" aria-hidden />
            <span className={formTitle}>{t('gitAgent.endpoint')}</span>
          </div>
          <p className={formDesc}>服务端中继网关地址或私有化模型服务 Base URL</p>
          <div className="pt-1">
            <TextInput
              fullWidth
              value={config.baseUrl || ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
              placeholder={t('gitAgent.endpointPlaceholder')}
            />
          </div>
        </div>

        {/* 4. Model Name */}
        <div className={formField}>
          <div className={formTitle}>{t('gitAgent.modelName')}</div>
          <p className={formDesc}>当前渠道推荐模型或输入自定义模型标识</p>
          <div className="pt-1">
            {modelOptions.length > 0 ? (
              <Select className="w-full" value={config.model} options={modelOptions} onChange={(val) => setConfig((prev) => ({ ...prev, model: val }))} />
            ) : (
              <TextInput fullWidth value={config.model} onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))} placeholder="e.g. gpt-4o, deepseek-r1" />
            )}
          </div>
        </div>

        {/* 5. API Key Input (if not ollama) */}
        {config.provider !== 'ollama' && (
          <div className={formField}>
            <div className="flex items-center justify-between">
              <span className={formTitle}>{t('gitAgent.apiKey')}</span>
              <span className="text-[11px] text-ink-soft font-mono">{config.provider === 'vercel-free' ? '免费渠道可留空' : '零持久化 · 内存保存'}</span>
            </div>
            <p className={formDesc}>{t('gitAgent.apiKeyPlaceholder')}</p>
            <div className="pt-1">
              <ApiKeyInput
                configured={Boolean(config.apiKey)}
                value={config.apiKey || ''}
                unlocked={apiKeyUnlocked}
                onUnlockedChange={setApiKeyUnlocked}
                onChange={(val) => setConfig((prev) => ({ ...prev, apiKey: val }))}
                placeholder={t('gitAgent.apiKeyPlaceholder')}
              />
            </div>
          </div>
        )}

        {/* 6. Test Connection */}
        <div className="flex items-center gap-3 pt-3">
          <Button type="button" variant="default" onClick={handleTestConnection} disabled={testing} className="gap-2">
            {testing ? <Spinner className="size-3.5" /> : <LuActivity className="size-3.5" aria-hidden />}
            <span>{testing ? t('gitAgent.testing') : t('gitAgent.testConnection')}</span>
          </Button>

          {testResult && (
            <div className="animate-in fade-in duration-200">
              {testResult.ok ? (
                <Badge tone="ok">
                  {t('gitAgent.testSuccess')} ({testResult.latencyMs}ms)
                </Badge>
              ) : (
                <Badge tone="fail">
                  {t('gitAgent.testFailed')}: {testResult.error}
                </Badge>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
