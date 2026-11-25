'use client'

import React from 'react'
import { LuShieldAlert, LuTriangleAlert } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { TagInput } from '@/components/sk'

import { SettingsSectionCard } from './SettingsSectionCard'

export interface ModelFilterInputsProps {
  whitelistId: string
  blacklistId: string
  whitelist: string[]
  blacklist: string[]
  onWhitelistChange: (whitelist: string[]) => void
  onBlacklistChange: (blacklist: string[]) => void
  conflicts: string[]
  blockedModel?: string | null
  scopeLabel?: string
  embedded?: boolean
}

export function ModelFilterInputs({
  whitelistId,
  blacklistId,
  whitelist,
  blacklist,
  onWhitelistChange,
  onBlacklistChange,
  conflicts,
  blockedModel,
  scopeLabel,
  embedded = false,
}: ModelFilterInputsProps) {
  const t = useT()

  const cardTitle = scopeLabel ? `${t('gitAgent.modelFilterTitle')} · ${scopeLabel}` : t('gitAgent.modelFilterTitle')

  const innerContent = (
    <div className="flex flex-col gap-4">
      {blockedModel && (
        <div className="flex items-start gap-2.5 rounded-lg border border-fail/40 bg-fail/10 px-3 py-2.5 text-xs text-fail">
          <LuShieldAlert className="mt-0.5 size-4 shrink-0 text-fail" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-fail">{t('gitAgent.modelBlockedNotice')}</p>
            <p className="mt-0.5 text-fail/85">
              {t('gitAgent.modelBlockedDetail', { model: blockedModel }) ||
                `Active model "${blockedModel}" matches the blacklist and is blocked from submission in both the quick bar and workspace.`}
            </p>
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5 text-xs text-warn">
          <LuTriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold">{t('gitAgent.modelConflictNotice')}</p>
            <p className="mt-0.5 text-warn/85">
              {t('gitAgent.modelConflictDetail', { rules: conflicts.join(', ') }) ||
                `Blacklist takes precedence. The following whitelist rules are overridden: ${conflicts.join(', ')}`}
            </p>
          </div>
        </div>
      )}

      {/* Whitelist */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <label htmlFor={whitelistId} className="text-xs font-semibold text-ink">
              {t('gitAgent.modelWhitelist')}
            </label>
            <p className="text-[11px] text-ink-soft">{t('gitAgent.modelWhitelistDesc')}</p>
          </div>
          {whitelist.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono text-ink-soft">{whitelist.length}</span>
              <button type="button" onClick={() => onWhitelistChange([])} className="text-[11px] text-ink-soft hover:text-fail transition-colors cursor-pointer">
                {t('common.clear')}
              </button>
            </div>
          )}
        </div>
        <TagInput
          id={whitelistId}
          className="w-full"
          value={whitelist}
          onChange={onWhitelistChange}
          placeholder={t('gitAgent.modelWhitelistPlaceholder') || 'e.g. gpt-*, *-mini, press Enter or comma to add...'}
          multiline
          rows={embedded ? 2 : 3}
        />
        <p className="text-xs text-ink-soft leading-relaxed">
          {t('gitAgent.modelWhitelistHint') || 'Manage allowed model patterns as tags. Supports wildcards (e.g. gpt-*, *-mini). Press Enter or comma to add, or paste in bulk.'}
        </p>
      </div>

      {/* Blacklist */}
      <div className="flex flex-col gap-2 border-t border-line/60 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <label htmlFor={blacklistId} className="text-xs font-semibold text-ink">
              {t('gitAgent.modelBlacklist')}
            </label>
            <p className="text-[11px] text-ink-soft">{t('gitAgent.modelBlacklistDesc')}</p>
          </div>
          {blacklist.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono text-ink-soft">{blacklist.length}</span>
              <button type="button" onClick={() => onBlacklistChange([])} className="text-[11px] text-ink-soft hover:text-fail transition-colors cursor-pointer">
                {t('common.clear')}
              </button>
            </div>
          )}
        </div>
        <TagInput
          id={blacklistId}
          className="w-full"
          value={blacklist}
          onChange={onBlacklistChange}
          placeholder={t('gitAgent.modelBlacklistPlaceholder') || 'e.g. *-mini, gpt-3.5*, press Enter or comma to add...'}
          multiline
          rows={embedded ? 2 : 3}
        />
        <p className="text-xs text-ink-soft leading-relaxed">
          {t('gitAgent.modelBlacklistHint') || 'Blacklist takes precedence over whitelist. Supports wildcards (e.g. *-mini, gpt-3.5*). Matched models are blocked.'}
        </p>
      </div>
    </div>
  )

  if (embedded) {
    return (
      <div className="flex flex-col gap-3 border-t border-line/60 pt-3">
        <div>
          <h3 className="text-xs font-semibold text-ink">{cardTitle}</h3>
          <p className="text-xs text-ink-soft mt-0.5">{t('gitAgent.modelFilterDesc')}</p>
        </div>
        {innerContent}
      </div>
    )
  }

  return (
    <SettingsSectionCard title={cardTitle} description={t('gitAgent.modelFilterDesc')}>
      {innerContent}
    </SettingsSectionCard>
  )
}
