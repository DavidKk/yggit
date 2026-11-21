'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LuArrowLeft, LuSave, LuTrash2 } from 'react-icons/lu'

import { useConfirm } from '@/components/confirm/ConfirmProvider'
import { useT } from '@/components/i18n/LocaleProvider'
import { Button, TextInput } from '@/components/sk'
import { useContextMenuConfig } from '@/lib/git/context-menu-config'

import { SettingsSectionCard } from './SettingsSectionCard'

export function AgentMenuActionEditor({ actionId }: { actionId: string }) {
  const t = useT()
  const confirm = useConfirm()
  const router = useRouter()
  const [config, setConfig] = useContextMenuConfig()
  const action = config.agentActions.find((item) => item.id === actionId)
  const isNew = actionId === 'new'
  const [draft, setDraft] = useState<{ label: string; description: string; prompt: string } | null>(null)
  const value = draft ?? { label: action?.label ?? '', description: action?.description ?? '', prompt: action?.prompt ?? '' }
  const back = () => router.replace('/settings/menus')

  return (
    <SettingsSectionCard title={t(isNew ? 'gitAgent.newAction' : 'gitAgent.editAction')} description={t('gitAgent.menuActionsDesc')}>
      {!isNew && !action ? (
        <p className="text-xs text-ink-soft">{t('gitAgent.actionNotFound')}</p>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!value.label.trim() || !value.prompt.trim()) return
            const updated = {
              id: isNew ? `agent_custom_${crypto.randomUUID()}` : actionId,
              label: value.label.trim(),
              description: value.description.trim(),
              prompt: value.prompt.trim(),
              enabled: action?.enabled ?? true,
            }
            setConfig({
              ...config,
              agentActions: isNew ? [...config.agentActions, updated] : config.agentActions.map((item) => (item.id === actionId ? updated : item)),
            })
            back()
          }}
        >
          <label className="grid gap-1.5 text-xs text-ink">
            {t('gitAgent.actionTitle')}
            <TextInput required fullWidth value={value.label} onChange={(event) => setDraft({ ...value, label: event.target.value })} />
          </label>
          <label className="grid gap-1.5 text-xs text-ink">
            {t('gitAgent.actionDescription')}
            <TextInput fullWidth value={value.description} onChange={(event) => setDraft({ ...value, description: event.target.value })} />
          </label>
          <label className="grid gap-1.5 text-xs text-ink">
            {t('gitAgent.actionPrompt')}
            <textarea
              required
              rows={6}
              value={value.prompt}
              onChange={(event) => setDraft({ ...value, prompt: event.target.value })}
              className="w-full resize-y rounded-md border border-line bg-panel-2 p-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <Button onClick={back}>
              <LuArrowLeft aria-hidden="true" />
              {t('gitAgent.backToMenus')}
            </Button>
            {action && (
              <Button
                variant="fail"
                onClick={() =>
                  void confirm({
                    title: t('gitAgent.deleteActionConfirm', { name: action.label }),
                    description: t('gitAgent.deleteActionHint'),
                    confirmLabel: t('gitAgent.deleteAction', { name: action.label }),
                    confirmVariant: 'fail',
                    onConfirm: () => {
                      setConfig({ ...config, agentActions: config.agentActions.filter((item) => item.id !== actionId) })
                      back()
                    },
                  })
                }
              >
                <LuTrash2 aria-hidden="true" />
                {t('gitAgent.deleteAction', { name: action.label })}
              </Button>
            )}
            <Button type="submit" variant="accent" disabled={!value.label.trim() || !value.prompt.trim()}>
              <LuSave aria-hidden="true" />
              {t('common.save')}
            </Button>
          </div>
        </form>
      )}
    </SettingsSectionCard>
  )
}
