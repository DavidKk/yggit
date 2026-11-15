'use client'

import React from 'react'
import { LuKeyRound, LuNetwork, LuShieldCheck, LuUserCheck } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { SwitchToggle } from '@/components/sk/Switch'
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
    <div className="flex flex-col gap-6 max-w-2xl text-left">
      {/* 1. Header & Master Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/15 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LuShieldCheck className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-foreground">{t('gitAgent.privacyRedactTitle')}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{t('gitAgent.privacyRedactDesc')}</p>
        </div>
        <SwitchToggle
          checked={redactionOptions.enabled}
          onCheckedChange={(checked) => setRedactionOptions((prev) => ({ ...prev, enabled: checked }))}
          aria-label={t('gitAgent.privacyRedactTitle')}
        />
      </div>

      {/* 2. Category Switches */}
      <div className={cn('space-y-3 transition-opacity duration-200', !redactionOptions.enabled && 'opacity-40 pointer-events-none')}>
        <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">脱敏规则分类</label>

        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background p-3">
          {/* Secrets */}
          <div className="flex items-center justify-between py-1.5 border-b border-border/30">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <LuKeyRound className="h-4 w-4 text-amber-500" />
              <span>{t('gitAgent.privacySecrets')}</span>
            </div>
            <SwitchToggle checked={redactionOptions.categories.secrets} onCheckedChange={() => handleToggleCategory('secrets')} aria-label={t('gitAgent.privacySecrets')} />
          </div>

          {/* PII */}
          <div className="flex items-center justify-between py-1.5 border-b border-border/30">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <LuUserCheck className="h-4 w-4 text-blue-500" />
              <span>{t('gitAgent.privacyPii')}</span>
            </div>
            <SwitchToggle checked={redactionOptions.categories.pii} onCheckedChange={() => handleToggleCategory('pii')} aria-label={t('gitAgent.privacyPii')} />
          </div>

          {/* Network */}
          <div className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <LuNetwork className="h-4 w-4 text-emerald-500" />
              <span>{t('gitAgent.privacyNetwork')}</span>
            </div>
            <SwitchToggle checked={redactionOptions.categories.network} onCheckedChange={() => handleToggleCategory('network')} aria-label={t('gitAgent.privacyNetwork')} />
          </div>
        </div>
      </div>

      {/* 3. Custom Words */}
      <div className={cn('space-y-1.5 transition-opacity duration-200', !redactionOptions.enabled && 'opacity-40 pointer-events-none')}>
        <label className="text-xs font-medium text-foreground">{t('gitAgent.privacyCustomWords')}</label>
        <textarea
          rows={2}
          value={customWordsText}
          onChange={(e) => handleCustomWordsChange(e.target.value)}
          placeholder={t('gitAgent.privacyCustomWordsPlaceholder')}
          className="w-full rounded-md border border-border/80 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* 4. Allowlist */}
      <div className={cn('space-y-1.5 transition-opacity duration-200', !redactionOptions.enabled && 'opacity-40 pointer-events-none')}>
        <label className="text-xs font-medium text-foreground">{t('gitAgent.privacyAllowList')}</label>
        <textarea
          rows={2}
          value={allowListText}
          onChange={(e) => handleAllowListChange(e.target.value)}
          placeholder={t('gitAgent.privacyAllowListPlaceholder')}
          className="w-full rounded-md border border-border/80 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
    </div>
  )
}
