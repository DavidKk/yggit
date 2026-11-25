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
}: ModelFilterInputsProps) {
  const t = useT()

  const whitelistTitle = scopeLabel ? `${t('gitAgent.modelWhitelist')} · ${scopeLabel}` : t('gitAgent.modelWhitelist')
  const blacklistTitle = scopeLabel ? `${t('gitAgent.modelBlacklist')} · ${scopeLabel}` : t('gitAgent.modelBlacklist')

  return (
    <div className="flex flex-col gap-4">
      {blockedModel && (
        <div className="flex items-start gap-2.5 rounded-lg border border-fail/40 bg-fail/10 px-3 py-2.5 text-xs text-fail">
          <LuShieldAlert className="mt-0.5 size-4 shrink-0 text-fail" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-fail">{t('gitAgent.modelBlockedNotice')}</p>
            <p className="mt-0.5 text-fail/85">
              当前生效的模型「<span className="font-mono font-medium">{blockedModel}</span>」命中黑名单规则，已在快捷栏与工作区全面禁止提交请求。
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
              黑名单优先。以下白名单规则已被阻断：
              <span className="ml-1 font-mono font-semibold">{conflicts.join(', ')}</span>
            </p>
          </div>
        </div>
      )}

      {/* Card: Whitelist */}
      <SettingsSectionCard
        title={whitelistTitle}
        description={t('gitAgent.modelWhitelistDesc')}
        titleAction={
          whitelist.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-ink-soft">{whitelist.length}</span>
              <button type="button" onClick={() => onWhitelistChange([])} className="text-[11px] text-ink-soft hover:text-fail transition-colors cursor-pointer">
                {t('common.clear')}
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-2">
          <TagInput id={whitelistId} className="w-full" value={whitelist} onChange={onWhitelistChange} placeholder="如 gpt-*、*-mini，按 Enter 或逗号添加..." multiline rows={3} />
          <p className="text-xs text-ink-soft leading-relaxed">
            以标签形式配置允许的模型规则，支持通配符（如 <code className="font-mono text-ink">gpt-*</code>、<code className="font-mono text-ink">*-mini</code>
            ），按 Enter 或逗号添加，支持粘贴批量录入。
          </p>
        </div>
      </SettingsSectionCard>

      {/* Card: Blacklist */}
      <SettingsSectionCard
        title={blacklistTitle}
        description={t('gitAgent.modelBlacklistDesc')}
        titleAction={
          blacklist.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-ink-soft">{blacklist.length}</span>
              <button type="button" onClick={() => onBlacklistChange([])} className="text-[11px] text-ink-soft hover:text-fail transition-colors cursor-pointer">
                {t('common.clear')}
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-2">
          <TagInput
            id={blacklistId}
            className="w-full"
            value={blacklist}
            onChange={onBlacklistChange}
            placeholder="如 *-mini、gpt-3.5*，按 Enter 或逗号添加..."
            multiline
            rows={3}
          />
          <p className="text-xs text-ink-soft leading-relaxed">
            黑名单优先级最高，命中规则的模型将被隐藏并禁止提交（支持 <code className="font-mono text-ink">*-mini</code>、<code className="font-mono text-ink">gpt-3.5*</code>
            等通配符）。
          </p>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
