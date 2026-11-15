'use client'

import React, { useState } from 'react'
import { LuActivity, LuKeyRound, LuServer } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { ApiKeyInput, Badge, Button, Select, type SelectOption, Spinner, TextInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { testAgentConnection } from '@/lib/agent/openapi-client'
import { AGENT_PRESETS, type AgentProviderType } from '@/lib/agent/types'

import { PrivacyNoticeCallout } from './PrivacyNoticeCallout'
import { SettingsSectionCard } from './SettingsSectionCard'

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
    <div className="flex flex-col gap-4">
      {/* Card 1: Channel & Protocol Configuration */}
      <SettingsSectionCard title="模型渠道配置" description="选择大模型推理服务渠道与协议，支持免凭证公共通道、自定义 OpenAI 兼容接口或本地 Ollama">
        {/* Provider Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink">{t('gitAgent.modelProvider')}</label>
          <p className="text-xs text-ink-soft">选择接入渠道与模型协议规范</p>
          <div className="pt-0.5">
            <Select className="w-full" value={config.provider} options={providerOptions} onChange={handleProviderChange} />
          </div>
        </div>

        {/* Privacy Notice for Free Public Model Tier */}
        {preset.noZdrNotice && <PrivacyNoticeCallout />}

        {/* API Base URL */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <LuServer className="size-3.5 text-ink-soft" aria-hidden="true" />
            <label className="text-xs font-medium text-ink">{t('gitAgent.endpoint')}</label>
          </div>
          <p className="text-xs text-ink-soft">服务端中继网关地址或私有化模型服务 Base URL</p>
          <div className="pt-0.5">
            <TextInput
              fullWidth
              value={config.baseUrl || ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
              placeholder={t('gitAgent.endpointPlaceholder')}
            />
          </div>
        </div>

        {/* Model Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink">{t('gitAgent.modelName')}</label>
          <p className="text-xs text-ink-soft">当前渠道推荐模型标识或自定义模型名</p>
          <div className="pt-0.5">
            {modelOptions.length > 0 ? (
              <Select className="w-full" value={config.model} options={modelOptions} onChange={(val) => setConfig((prev) => ({ ...prev, model: val }))} />
            ) : (
              <TextInput fullWidth value={config.model} onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))} placeholder="e.g. gpt-4o, deepseek-r1" />
            )}
          </div>
        </div>

        {/* API Key Input */}
        {config.provider !== 'ollama' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <LuKeyRound className="size-3.5 text-ink-soft" aria-hidden="true" />
                <label className="text-xs font-medium text-ink">{t('gitAgent.apiKey')}</label>
              </div>
              <span className="font-mono text-[11px] text-ink-soft">{config.provider === 'vercel-free' ? '免费渠道可留空' : '零持久化 · 内存保存'}</span>
            </div>
            <p className="text-xs text-ink-soft">{t('gitAgent.apiKeyPlaceholder')}</p>
            <div className="pt-0.5">
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
      </SettingsSectionCard>

      {/* Card 2: Connectivity Test & Diagnostic */}
      <SettingsSectionCard title="服务连通性检测" description="向配置的推理服务端点发送握手探针，验证网络可达性与鉴权凭据有效性">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="default" onClick={handleTestConnection} disabled={testing} className="gap-2">
            {testing ? <Spinner className="size-3.5" /> : <LuActivity className="size-3.5" aria-hidden="true" />}
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

        <p className="text-xs text-ink-soft leading-relaxed">测试探针由客户端直接发起探测，通过本地网关代理直连模型接口，服务端不留存任何密钥与请求历史。</p>
      </SettingsSectionCard>
    </div>
  )
}
