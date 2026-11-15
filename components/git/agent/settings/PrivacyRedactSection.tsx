'use client'

import React from 'react'
import { LuKeyRound, LuNetwork, LuShieldCheck, LuUserCheck } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { SwitchToggle, TagInput } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'
import { cn } from '@/lib/utils'

import { SettingsSectionCard } from './SettingsSectionCard'

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

  const handleCustomWordsChange = (tags: string[]) => {
    setRedactionOptions((prev) => ({
      ...prev,
      customWords: tags.map((word) => ({ word, caseSensitive: false, wholeWord: false })),
    }))
  }

  const handleAllowListChange = (allowList: string[]) => {
    setRedactionOptions((prev) => ({
      ...prev,
      allowList,
    }))
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Card 1: Master Redaction Engine Switch */}
      <SettingsSectionCard
        title={t('gitAgent.privacyRedactTitle')}
        description={t('gitAgent.privacyRedactDesc')}
        titleAction={
          <SwitchToggle
            checked={redactionOptions.enabled}
            onCheckedChange={(checked) => setRedactionOptions((prev) => ({ ...prev, enabled: checked }))}
            aria-label={t('gitAgent.privacyRedactTitle')}
          />
        }
      >
        {redactionOptions.enabled ? (
          <div className="flex items-center gap-2 rounded-md border border-ok/30 bg-ok/10 p-3 text-xs text-ink">
            <LuShieldCheck className="size-4 shrink-0 text-ok" aria-hidden="true" />
            <span>脱敏引擎已激活：敏感实体将在出站请求时自动掩盖，并在模型流式返回时实时解密。</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-line bg-muted/20 p-3 text-xs text-ink-soft">
            <span>脱敏引擎已停用：发送给大模型的内容将包含原始上下文，适合私有化自部署环境。</span>
          </div>
        )}

        <p className="text-xs text-ink-soft leading-relaxed">脱敏字典与替换映射完全运行在浏览器内存中，无任何服务端数据流转或持久化行为。</p>
      </SettingsSectionCard>

      {/* Card 2: Built-in Categories */}
      <SettingsSectionCard title="内置规则分类" description="启用或停用特定分类的自动敏感实体识别与掩盖">
        <div className={cn('flex flex-col divide-y divide-line rounded-md border border-line bg-panel-2', !redactionOptions.enabled && 'pointer-events-none opacity-50')}>
          {/* Secrets */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2.5">
              <LuKeyRound className="size-3.5 shrink-0 text-warn" aria-hidden="true" />
              <div>
                <span className="text-xs font-medium text-ink">{t('gitAgent.privacySecrets')}</span>
                <p className="text-[11px] text-ink-soft">匹配 AWS/GitHub/GitLab Token、私钥与数据库连接串等</p>
              </div>
            </div>
            <SwitchToggle checked={redactionOptions.categories.secrets} onCheckedChange={() => handleToggleCategory('secrets')} aria-label={t('gitAgent.privacySecrets')} />
          </div>

          {/* PII */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2.5">
              <LuUserCheck className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <span className="text-xs font-medium text-ink">{t('gitAgent.privacyPii')}</span>
                <p className="text-[11px] text-ink-soft">掩盖 Commit 作者邮箱、电话号码与用户个人识别符</p>
              </div>
            </div>
            <SwitchToggle checked={redactionOptions.categories.pii} onCheckedChange={() => handleToggleCategory('pii')} aria-label={t('gitAgent.privacyPii')} />
          </div>

          {/* Network */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2.5">
              <LuNetwork className="size-3.5 shrink-0 text-ok" aria-hidden="true" />
              <div>
                <span className="text-xs font-medium text-ink">{t('gitAgent.privacyNetwork')}</span>
                <p className="text-[11px] text-ink-soft">掩盖内网 RFC1918 私有 IP、内部集群域名等拓扑资产</p>
              </div>
            </div>
            <SwitchToggle checked={redactionOptions.categories.network} onCheckedChange={() => handleToggleCategory('network')} aria-label={t('gitAgent.privacyNetwork')} />
          </div>
        </div>
      </SettingsSectionCard>

      {/* Card 3: Custom Words */}
      <SettingsSectionCard title={t('gitAgent.privacyCustomWords')} description="配置需要额外强制脱敏的项目特有专有词汇或敏感代号（发送前替换为语义占位符并在回复时自动还原）">
        <div className={cn('flex flex-col gap-2', !redactionOptions.enabled && 'pointer-events-none opacity-50')}>
          <TagInput
            value={redactionOptions.customWords.map((cw) => cw.word)}
            onChange={handleCustomWordsChange}
            placeholder={t('gitAgent.privacyCustomWordsPlaceholder') || '输入敏感词后按 Enter 或逗号添加...'}
            disabled={!redactionOptions.enabled}
          />
          <p className="text-xs text-ink-soft leading-relaxed">
            以标签形式管理多个项目敏感代号，支持通配符（如 <code className="font-mono text-ink">PROJ_*</code>、<code className="font-mono text-ink">secret_?</code>），按 Enter
            或逗号添加，支持粘贴批量录入。
          </p>
        </div>
      </SettingsSectionCard>

      {/* Card 4: Allowlist */}
      <SettingsSectionCard title={t('gitAgent.privacyAllowList')} description="配置即使命中内置脱敏规则也不被掩盖的豁免词汇">
        <div className={cn('flex flex-col gap-2', !redactionOptions.enabled && 'pointer-events-none opacity-50')}>
          <TagInput
            value={redactionOptions.allowList}
            onChange={handleAllowListChange}
            placeholder={t('gitAgent.privacyAllowListPlaceholder') || '输入豁免词后按 Enter 或逗号添加...'}
            disabled={!redactionOptions.enabled}
          />
          <p className="text-xs text-ink-soft leading-relaxed">
            配置白名单标签，支持域名与名称通配符（如 <code className="font-mono text-ink">*.internal.net</code>、<code className="font-mono text-ink">public-*</code>
            ），命中后将安全豁免脱敏。
          </p>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
