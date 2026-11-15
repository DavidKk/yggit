'use client'

import React, { useState } from 'react'
import { FiCheckCircle, FiXCircle } from 'react-icons/fi'
import { LuActivity, LuEye, LuEyeOff, LuServer } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Spinner } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { testAgentConnection } from '@/lib/agent/openapi-client'
import { AGENT_PRESETS, type AgentProviderType } from '@/lib/agent/types'
import { cn } from '@/lib/utils'

import { PrivacyNoticeCallout } from './PrivacyNoticeCallout'

export function ModelChannelSection() {
  const t = useT()
  const { config, setConfig } = useAgent()

  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok?: boolean
    latencyMs?: number
    error?: string
  } | null>(null)

  const preset = AGENT_PRESETS[config.provider]

  const handleProviderChange = (provider: AgentProviderType) => {
    const nextPreset = AGENT_PRESETS[provider]
    setConfig((prev) => ({
      ...prev,
      provider,
      baseUrl: nextPreset.baseUrl,
      model: nextPreset.defaultModel,
      apiKey: provider === 'vercel-free' ? '' : prev.apiKey,
    }))
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
    <div className="flex flex-col gap-6 max-w-2xl text-left">
      {/* 1. Channel Preset Selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t('gitAgent.modelProvider')}</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(AGENT_PRESETS) as AgentProviderType[]).map((key) => {
            const p = AGENT_PRESETS[key]
            const isSelected = config.provider === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleProviderChange(key)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  isSelected ? 'border-accent bg-accent/10 shadow-sm' : 'border-border/60 bg-muted/10 hover:border-border hover:bg-muted/20'
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={cn('text-xs font-medium', isSelected ? 'text-accent' : 'text-foreground')}>{p.name.split('(')[0].trim()}</span>
                  {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </div>
                <span className="text-[11px] text-muted-foreground">{key === 'vercel-free' ? '免费 · 免 Key' : key === 'byop' ? '自定义 Key' : '本地模型'}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Privacy Notice when Free Model Selected */}
      {preset.noZdrNotice && <PrivacyNoticeCallout />}

      {/* 3. API Base URL */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <LuServer className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{t('gitAgent.endpoint')}</span>
        </label>
        <input
          type="text"
          value={config.baseUrl || ''}
          onChange={(e) => setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
          placeholder={t('gitAgent.endpointPlaceholder')}
          className="h-9 w-full rounded-md border border-border/80 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* 4. Model Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">{t('gitAgent.modelName')}</label>
        {preset.models.length > 0 ? (
          <div className="flex flex-col gap-2">
            <select
              value={config.model}
              onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
              className="h-9 w-full rounded-md border border-border/80 bg-background px-2.5 text-xs text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {preset.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.id})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input
            type="text"
            value={config.model}
            onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
            placeholder="e.g. gpt-4o, deepseek-r1"
            className="h-9 w-full rounded-md border border-border/80 bg-background px-3 text-xs text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        )}
      </div>

      {/* 5. API Key Input (if not free/local) */}
      {config.provider !== 'ollama' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">{t('gitAgent.apiKey')}</label>
            <span className="text-[11px] text-muted-foreground">{config.provider === 'vercel-free' ? '可选 (默认免鉴权)' : '内存保存 · 刷新即焚'}</span>
          </div>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={config.apiKey || ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder={t('gitAgent.apiKeyPlaceholder')}
              className="h-9 w-full rounded-md border border-border/80 bg-background px-3 pr-10 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <LuEyeOff className="h-4 w-4" /> : <LuEye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* 6. Test Connection */}
      <div className="flex items-center gap-4 pt-2 border-t border-border/40">
        <Button type="button" onClick={handleTestConnection} disabled={testing} className="gap-2 text-xs">
          {testing ? (
            <>
              <Spinner className="h-3.5 w-3.5" />
              <span>{t('gitAgent.testing')}</span>
            </>
          ) : (
            <>
              <LuActivity className="h-3.5 w-3.5" />
              <span>{t('gitAgent.testConnection')}</span>
            </>
          )}
        </Button>

        {testResult && (
          <div className="flex items-center gap-2 text-xs animate-in fade-in duration-200">
            {testResult.ok ? (
              <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
                <FiCheckCircle className="h-4 w-4 shrink-0" />
                <span>{t('gitAgent.testSuccess')}</span>
                <span className="text-muted-foreground">({testResult.latencyMs}ms)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-rose-500 font-medium">
                <FiXCircle className="h-4 w-4 shrink-0" />
                <span>
                  {t('gitAgent.testFailed')}: {testResult.error}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
