'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { LuRotateCcw, LuSave, LuShieldCheck } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { useNotification } from '@/components/notification/useNotification'
import { Button, SwitchToggle, TagInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import type { RedactionOptions } from '@/lib/agent/redact/types'
import { cn } from '@/lib/utils'

import { RuleDebugger } from './RuleDebugger'
import { SettingsColumns } from './SettingsColumns'
import { SettingsSectionCard } from './SettingsSectionCard'

export function PrivacyRedactSection() {
  const t = useT()
  const notify = useNotification()
  const { redactionOptions, setRedactionOptions } = useAgent()
  const [draft, setDraft] = useState<RedactionOptions>(redactionOptions)

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(redactionOptions), [draft, redactionOptions])

  useEffect(() => {
    setDraft(redactionOptions)
  }, [redactionOptions])

  const handleToggleCategory = (categoryKey: 'secrets' | 'pii' | 'network') => {
    setDraft((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [categoryKey]: !prev.categories[categoryKey],
      },
    }))
  }

  const handleCustomWordsChange = (tags: string[]) => {
    setDraft((prev) => ({
      ...prev,
      customWords: tags.map((word) => ({ word, caseSensitive: false, wholeWord: false })),
    }))
  }

  const handleAllowListChange = (allowList: string[]) => {
    setDraft((prev) => ({
      ...prev,
      allowList,
    }))
  }

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault()
    setRedactionOptions(draft)
    notify.success(`${t('gitAgent.privacyRedactTitle')} · ${t('common.save')}`)
  }

  const handleReset = () => {
    setDraft(redactionOptions)
  }

  return (
    <SettingsColumns className="@min-[960px]/settings:grid-cols-[minmax(0,580px)_340px]" tools={<RuleDebugger redactionOptions={draft} />}>
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        {/* Card 1: Master Redaction Engine Switch */}
        <SettingsSectionCard
          title={t('gitAgent.privacyRedactTitle')}
          description={t('gitAgent.privacyRedactDesc')}
          titleAction={
            <SwitchToggle
              checked={draft.enabled}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, enabled: checked }))}
              size="sm"
              aria-label={t('gitAgent.privacyRedactTitle')}
            />
          }
        >
          {draft.enabled ? (
            <div className="flex items-center gap-2 rounded-md border border-ok/30 bg-ok/10 p-3 text-xs text-ink">
              <LuShieldCheck className="size-4 shrink-0 text-ok" aria-hidden="true" />
              <span>
                {t('gitAgent.privacyActiveBanner') ||
                  'Redaction engine is active: sensitive entities are masked on outbound requests and restored in real time on streaming responses.'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-line bg-panel-2/60 p-3 text-xs text-ink-soft">
              <span>
                {t('gitAgent.privacyInactiveBanner') ||
                  'Redaction engine is disabled: raw context will be sent to the model (recommended only for private self-hosted deployments).'}
              </span>
            </div>
          )}
        </SettingsSectionCard>

        {/* Card 2: Built-in Categories */}
        <SettingsSectionCard
          title={t('gitAgent.privacyCategoriesTitle') || 'Built-in Rule Categories'}
          description={t('gitAgent.privacyCategoriesDesc') || 'Enable or disable automatic sensitive entity detection and masking by category.'}
        >
          <div className={cn('flex flex-col divide-y divide-line rounded-md border border-line bg-panel-2', !draft.enabled && 'pointer-events-none opacity-50')}>
            {/* Secrets */}
            <div className="flex items-center justify-between p-3">
              <div>
                <span className="text-xs font-medium text-ink">{t('gitAgent.privacySecrets')}</span>
                <p className="text-[11px] text-ink-soft">
                  {t('gitAgent.privacySecretsDesc') || 'Matches AWS/GitHub/GitLab tokens, private keys, and database connection strings.'}
                </p>
              </div>
              <SwitchToggle checked={draft.categories.secrets} onCheckedChange={() => handleToggleCategory('secrets')} size="sm" aria-label={t('gitAgent.privacySecrets')} />
            </div>

            {/* PII */}
            <div className="flex items-center justify-between p-3">
              <div>
                <span className="text-xs font-medium text-ink">{t('gitAgent.privacyPii')}</span>
                <p className="text-[11px] text-ink-soft">{t('gitAgent.privacyPiiDesc') || 'Masks commit author emails, phone numbers, and personal identifiers.'}</p>
              </div>
              <SwitchToggle checked={draft.categories.pii} onCheckedChange={() => handleToggleCategory('pii')} size="sm" aria-label={t('gitAgent.privacyPii')} />
            </div>

            {/* Network */}
            <div className="flex items-center justify-between p-3">
              <div>
                <span className="text-xs font-medium text-ink">{t('gitAgent.privacyNetwork')}</span>
                <p className="text-[11px] text-ink-soft">{t('gitAgent.privacyNetworkDesc') || 'Masks RFC1918 private IPs, internal cluster hostnames, and topology assets.'}</p>
              </div>
              <SwitchToggle checked={draft.categories.network} onCheckedChange={() => handleToggleCategory('network')} size="sm" aria-label={t('gitAgent.privacyNetwork')} />
            </div>
          </div>
        </SettingsSectionCard>

        {/* Card 3: Custom Words & Allowlist */}
        <SettingsSectionCard
          title={t('gitAgent.privacyRulesTitle') || 'Custom Terms & Allowlist'}
          description={t('gitAgent.privacyRulesDesc') || 'Configure project-specific terms to redact and allowlist patterns exempt from masking.'}
        >
          <div className={cn('flex flex-col gap-4', !draft.enabled && 'pointer-events-none opacity-50')}>
            {/* Custom Words */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label htmlFor="privacy-custom-words" className="text-xs font-semibold text-ink">
                    {t('gitAgent.privacyCustomWords')}
                  </label>
                  <p className="text-[11px] text-ink-soft">
                    {t('gitAgent.privacyCustomWordsDesc') || 'Project-specific terms or codenames to force-redact before sending and restore in replies.'}
                  </p>
                </div>
                {draft.customWords.length > 0 && draft.enabled && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-ink-soft font-mono">{draft.customWords.length}</span>
                    <button type="button" onClick={() => handleCustomWordsChange([])} className="text-[11px] text-ink-soft hover:text-danger transition-colors cursor-pointer">
                      {t('common.clear')}
                    </button>
                  </div>
                )}
              </div>
              <TagInput
                id="privacy-custom-words"
                value={draft.customWords.map((cw) => cw.word)}
                onChange={handleCustomWordsChange}
                placeholder={t('gitAgent.privacyCustomWordsPlaceholder')}
                disabled={!draft.enabled}
                multiline
                rows={3}
              />
              <p className="text-xs text-ink-soft leading-relaxed">
                {t('gitAgent.privacyCustomWordsHint') ||
                  'Manage sensitive terms as tags. Supports wildcards (e.g. PROJ_*, secret_?). Press Enter or comma to add, or paste multiple lines.'}
              </p>
            </div>

            {/* Allowlist */}
            <div className="flex flex-col gap-2 border-t border-line/60 pt-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label htmlFor="privacy-allow-list" className="text-xs font-semibold text-ink">
                    {t('gitAgent.privacyAllowList')}
                  </label>
                  <p className="text-[11px] text-ink-soft">
                    {t('gitAgent.privacyAllowListDesc') || 'Exempt terms that will never be masked even when matched by built-in redaction rules.'}
                  </p>
                </div>
                {draft.allowList.length > 0 && draft.enabled && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-ink-soft font-mono">{draft.allowList.length}</span>
                    <button type="button" onClick={() => handleAllowListChange([])} className="text-[11px] text-ink-soft hover:text-danger transition-colors cursor-pointer">
                      {t('common.clear')}
                    </button>
                  </div>
                )}
              </div>
              <TagInput
                id="privacy-allow-list"
                value={draft.allowList}
                onChange={handleAllowListChange}
                placeholder={t('gitAgent.privacyAllowListPlaceholder')}
                disabled={!draft.enabled}
                multiline
                rows={3}
              />
              <p className="text-xs text-ink-soft leading-relaxed">
                {t('gitAgent.privacyAllowListHint') || 'Manage allowlist tags. Supports domain and name wildcards (e.g. *.internal.net, public-*).'}
              </p>
            </div>

            {/* Save Actions inside card */}
            <div className="flex items-center justify-end gap-2 border-t border-line/60 pt-3">
              {isDirty && (
                <Button type="button" variant="ghost" onClick={handleReset}>
                  <LuRotateCcw aria-hidden="true" />
                  {t('common.cancel')}
                </Button>
              )}
              <Button type="submit" variant="accent" disabled={!isDirty}>
                <LuSave aria-hidden="true" />
                {t('common.save')}
              </Button>
            </div>
          </div>
        </SettingsSectionCard>
      </form>
    </SettingsColumns>
  )
}
