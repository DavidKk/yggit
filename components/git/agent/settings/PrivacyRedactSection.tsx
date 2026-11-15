'use client'

import React from 'react'
import { LuKeyRound, LuNetwork, LuShieldCheck, LuUserCheck } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { formCard, formDesc, formField, formTitle, settingsCardWide } from '@/components/layoutClasses'
import { SwitchToggle, TextInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { cn } from '@/lib/utils'

export function PrivacyRedactSection() {
  const t = useT()
  const { redactionOptions, setRedactionOptions } = useAgent()

  const handleToggleCategory = (categoryKey: 'secrets' | 'pii' | 'network') => {
    setRedactionOptions((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [categoryKey]: !prev.categories[categoryKey],
      },
    }))
  }

  const handleCustomWordsChange = (text: string) => {
    const words = text
      .split(/[\n,]/)
      .map((w) => w.trim())
      .filter(Boolean)
      .map((word) => ({ word, caseSensitive: false, wholeWord: false }))

    setRedactionOptions((prev) => ({
      ...prev,
      customWords: words,
    }))
  }

  const handleAllowListChange = (text: string) => {
    const allowList = text
      .split(/[\n,]/)
      .map((w) => w.trim())
      .filter(Boolean)

    setRedactionOptions((prev) => ({
      ...prev,
      allowList,
    }))
  }

  const customWordsText = redactionOptions.customWords.map((cw) => cw.word).join(', ')
  const allowListText = redactionOptions.allowList.join(', ')

  return (
    <div className={settingsCardWide}>
      <section className={formCard}>
        {/* 1. Header & Master Toggle */}
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex items-center gap-2">
              <LuShieldCheck className="size-4 text-accent shrink-0" aria-hidden />
              <span className={formTitle}>{t('gitAgent.privacyRedactTitle')}</span>
            </div>
            <p className={formDesc}>{t('gitAgent.privacyRedactDesc')}</p>
          </div>
          <SwitchToggle
            checked={redactionOptions.enabled}
            onCheckedChange={(checked) => setRedactionOptions((prev) => ({ ...prev, enabled: checked }))}
            aria-label={t('gitAgent.privacyRedactTitle')}
          />
        </div>

        {/* 2. Category Switches */}
        <div className={cn('space-y-3 transition-opacity duration-200', !redactionOptions.enabled && 'opacity-40 pointer-events-none')}>
          <div className={formTitle}>内置脱敏规则分类</div>
          <div className="flex flex-col divide-y divide-line rounded-[0.15rem] border border-line bg-paper-2">
            {/* Secrets */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <LuKeyRound className="size-3.5 text-warn shrink-0" aria-hidden />
                <span className="text-xs font-medium text-ink">{t('gitAgent.privacySecrets')}</span>
              </div>
              <SwitchToggle
                size="sm"
                checked={redactionOptions.categories.secrets}
                onCheckedChange={() => handleToggleCategory('secrets')}
                aria-label={t('gitAgent.privacySecrets')}
              />
            </div>

            {/* PII */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <LuUserCheck className="size-3.5 text-accent shrink-0" aria-hidden />
                <span className="text-xs font-medium text-ink">{t('gitAgent.privacyPii')}</span>
              </div>
              <SwitchToggle size="sm" checked={redactionOptions.categories.pii} onCheckedChange={() => handleToggleCategory('pii')} aria-label={t('gitAgent.privacyPii')} />
            </div>

            {/* Network */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <LuNetwork className="size-3.5 text-ok shrink-0" aria-hidden />
                <span className="text-xs font-medium text-ink">{t('gitAgent.privacyNetwork')}</span>
              </div>
              <SwitchToggle
                size="sm"
                checked={redactionOptions.categories.network}
                onCheckedChange={() => handleToggleCategory('network')}
                aria-label={t('gitAgent.privacyNetwork')}
              />
            </div>
          </div>
        </div>

        {/* 3. Custom Words */}
        <div className={cn(formField, 'transition-opacity duration-200', !redactionOptions.enabled && 'opacity-40 pointer-events-none')}>
          <div className={formTitle}>{t('gitAgent.privacyCustomWords')}</div>
          <p className={formDesc}>输入自定义敏感词（多个用逗号隔开），发送给大模型前将被替换为语义占位符</p>
          <div className="pt-1">
            <TextInput
              fullWidth
              value={customWordsText}
              onChange={(e) => handleCustomWordsChange(e.target.value)}
              placeholder={t('gitAgent.privacyCustomWordsPlaceholder')}
              disabled={!redactionOptions.enabled}
            />
          </div>
        </div>

        {/* 4. Allowlist */}
        <div className={cn(formField, 'transition-opacity duration-200', !redactionOptions.enabled && 'opacity-40 pointer-events-none')}>
          <div className={formTitle}>{t('gitAgent.privacyAllowList')}</div>
          <p className={formDesc}>输入豁免白名单词汇（多个用逗号隔开），命中此类词汇时不做任何掩盖</p>
          <div className="pt-1">
            <TextInput
              fullWidth
              value={allowListText}
              onChange={(e) => handleAllowListChange(e.target.value)}
              placeholder={t('gitAgent.privacyAllowListPlaceholder')}
              disabled={!redactionOptions.enabled}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
