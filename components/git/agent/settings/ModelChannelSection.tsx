'use client'

import React, { useState } from 'react'
import { LuActivity, LuArrowLeft, LuCheck, LuCpu, LuPencil, LuPlus, LuSave } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, Select, TextInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import type { AgentModelProfile } from '@/lib/agent/model-profiles'
import { testAgentConnection } from '@/lib/agent/openapi-client'
import { AGENT_PRESETS, type AgentProviderType, DEFAULT_AGENT_CONFIG } from '@/lib/agent/types'

import { ConfiguredSecretInput } from './ConfiguredSecretInput'
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
            <button type="button" className="min-w-0 flex-1 text-left hover:text-accent" onClick={() => setEditing(profile)}>
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
            {AGENT_PRESETS[profile.config.provider].requiresKey && !profile.config.apiKey && <Badge tone="warn">{t('gitAgent.keyRequired')}</Badge>}
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
  const preset = AGENT_PRESETS[draft.config.provider]
  const config = { ...draft.config, apiKey: keyDraft.trim() || (clearKey ? '' : draft.config.apiKey) }

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

  function updateConfig(patch: Partial<typeof draft.config>) {
    setDraft((previous) => ({ ...previous, config: { ...previous.config, ...patch } }))
    setTestResult(null)
    setError('')
  }

  return (
    <SettingsSectionCard title={t('gitAgent.modelDetails')} description={t('gitAgent.modelDetailsDesc')}>
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
        <fieldset disabled={testing} className="grid min-w-0 gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="agent-model-name" className="text-xs font-medium">
              {t('gitAgent.profileName')}
            </label>
            <TextInput id="agent-model-name" fullWidth value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium" id="agent-provider-label">
              {t('gitAgent.modelProvider')}
            </span>
            <Select
              aria-labelledby="agent-provider-label"
              className="w-full"
              value={config.provider}
              options={(Object.keys(AGENT_PRESETS) as AgentProviderType[]).map((value) => ({ value, label: AGENT_PRESETS[value].name }))}
              onChange={(value) => {
                const provider = value as AgentProviderType
                const next = AGENT_PRESETS[provider]
                updateConfig({ provider, baseUrl: next.baseUrl, model: next.defaultModel, apiKey: '' })
                setKeyDraft('')
                setClearKey(false)
              }}
            />
          </div>
          {preset.noZdrNotice && <PrivacyNoticeCallout />}
          <div className="grid gap-1.5">
            <label htmlFor="agent-model-endpoint" className="text-xs font-medium">
              {t('gitAgent.endpoint')}
            </label>
            <TextInput
              id="agent-model-endpoint"
              fullWidth
              value={config.baseUrl || ''}
              onChange={(event) => updateConfig({ baseUrl: event.target.value })}
              placeholder={t('gitAgent.endpointPlaceholder')}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="agent-model-id" className="text-xs font-medium">
              {t('gitAgent.modelName')}
            </label>
            <TextInput id="agent-model-id" fullWidth list="agent-model-options" value={config.model} onChange={(event) => updateConfig({ model: event.target.value })} />
            <datalist id="agent-model-options">
              {preset.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </datalist>
          </div>
          {config.provider !== 'ollama' && (
            <div className="grid gap-1.5">
              <label htmlFor="agent-api-key" className="text-xs font-medium">
                {t('gitAgent.apiKey')}
              </label>
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
              <p className="text-xs text-ink-soft">{t('gitAgent.apiKeyPlaceholder')}</p>
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
