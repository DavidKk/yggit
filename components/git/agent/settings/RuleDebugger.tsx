'use client'

import { useMemo, useState } from 'react'

import { useT } from '@/components/i18n/LocaleProvider'
import { TextInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { isModelAllowed, matchesModelPattern, type ModelFilterOptions } from '@/lib/agent/model-filter'
import { RedactionEngine } from '@/lib/agent/redact/engine'
import type { RedactionOptions } from '@/lib/agent/redact/types'

import { SettingsSectionCard } from './SettingsSectionCard'

export function RuleDebugger({
  filter,
  modelId = '',
  redactionOptions: redactionOptionsProp,
}: {
  filter?: ModelFilterOptions
  modelId?: string
  redactionOptions?: RedactionOptions
}) {
  const t = useT()
  const { redactionOptions: contextRedactionOptions } = useAgent()
  const redactionOptions = redactionOptionsProp ?? contextRedactionOptions
  const [modelDraft, setModelDraft] = useState<string | null>(null)
  const [text, setText] = useState('')
  const model = modelDraft ?? modelId
  const allowed = !filter || !model.trim() || isModelAllowed(model, filter)
  const whitelist = filter?.whitelist.filter((pattern) => matchesModelPattern(pattern, model)) ?? []
  const blacklist = filter?.blacklist.filter((pattern) => matchesModelPattern(pattern, model)) ?? []
  const preview = useMemo(() => {
    const engine = new RedactionEngine(redactionOptions)
    const result = engine.mask(text)
    return { ...result, mappings: [...engine.getSession().originalToPlaceholder] }
  }, [redactionOptions, text])

  return (
    <SettingsSectionCard title={t('gitAgent.ruleTools')} description={t('gitAgent.ruleToolsDesc')}>
      {filter && (
        <>
          <label className="grid gap-1.5 text-xs text-ink">
            {t('gitAgent.testModel')}
            <TextInput fullWidth value={model} onChange={(event) => setModelDraft(event.target.value)} placeholder="a-demo" />
          </label>
          {model.trim() && (
            <div role="status" className="grid gap-2 text-xs">
              <p className={allowed ? 'text-ok' : 'text-fail'}>{t(allowed ? 'gitAgent.modelAllowed' : 'gitAgent.modelDenied')}</p>
              <p className="text-ink-soft">{t('gitAgent.matchedRules')}</p>
              <div className="break-words font-mono text-ink">
                {whitelist.length > 0 && (
                  <p>
                    {t('gitAgent.modelWhitelist')}: {whitelist.join(', ')}
                  </p>
                )}
                {blacklist.length > 0 && (
                  <p>
                    {t('gitAgent.modelBlacklist')}: {blacklist.join(', ')}
                  </p>
                )}
                {whitelist.length === 0 && blacklist.length === 0 && <p>{t('gitAgent.noRuleMatches')}</p>}
              </div>
            </div>
          )}
        </>
      )}
      <label className="grid gap-1.5 text-xs text-ink">
        {t('gitAgent.testSentence')}
        <textarea
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('gitAgent.testSentencePlaceholder')}
          className="w-full resize-y rounded-md border border-line bg-panel-2 p-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      {!redactionOptions.enabled && <p className="text-xs text-warn">{t('gitAgent.privacyDisabled')}</p>}
      <div className="grid gap-2" aria-live="polite">
        <h3 className="text-xs font-semibold text-ink">{t('gitAgent.agentPreview')}</h3>
        <pre className="min-h-20 whitespace-pre-wrap break-words rounded-md border border-line bg-panel-2 p-2.5 font-mono text-xs text-ink">
          {!allowed ? t('gitAgent.modelDenied') : text ? preview.sanitizedText : t('gitAgent.testEmpty')}
        </pre>
        <h3 className="text-xs font-semibold text-ink">
          {t('gitAgent.replacementMap')} ({preview.mappings.length})
        </h3>
        {preview.mappings.length > 0 ? (
          <dl className="grid gap-2 text-xs">
            {preview.mappings.map(([original, placeholder]) => (
              <div key={original} className="min-w-0 rounded border border-line p-2 font-mono">
                <dt className="break-all text-ink-soft">{original}</dt>
                <dd className="mt-1 break-all text-accent">→ {placeholder}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-ink-soft">{t('gitAgent.noRuleMatches')}</p>
        )}
      </div>
    </SettingsSectionCard>
  )
}
