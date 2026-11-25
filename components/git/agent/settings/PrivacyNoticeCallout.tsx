'use client'

import React from 'react'
import { LuShieldAlert } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'

export function PrivacyNoticeCallout() {
  const t = useT()

  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-ink shadow-xs dark:bg-amber-500/15">
      <LuShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <div className="font-semibold text-ink dark:text-amber-300">{t('gitAgent.privacyNoticeTitle')}</div>
        <p className="leading-relaxed text-ink dark:text-amber-100">{t('gitAgent.privacyNoticeBody')}</p>
      </div>
    </div>
  )
}
