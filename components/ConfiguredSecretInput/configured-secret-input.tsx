'use client'

import { useState } from 'react'
import { LuEye, LuEyeOff, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button, TextInput } from '@/components/sk'
import { cn } from '@/lib/utils'

export interface ConfiguredSecretInputProps {
  configured: boolean
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder?: string
  id?: string
  className?: string
  disabled?: boolean
  autoFocus?: boolean
  'aria-label'?: string
}

/** Saved credentials and input drafts are separate, matching the ticket system. */
export function ConfiguredSecretInput({
  configured,
  value,
  onChange,
  onClear,
  placeholder,
  id = 'agent-api-key',
  className,
  disabled = false,
  autoFocus,
  'aria-label': ariaLabel,
}: ConfiguredSecretInputProps) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const sealed = configured && !editing && !value
  const hasValue = sealed || Boolean(value)

  return (
    <div className={cn('relative', className)}>
      <TextInput
        id={id}
        data-webmcp-sensitive=""
        fullWidth
        disabled={disabled}
        autoFocus={autoFocus}
        type={revealed && !sealed ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        value={sealed ? '******' : value}
        readOnly={sealed}
        placeholder={placeholder ?? t('gitAgent.apiKeyPlaceholder')}
        aria-label={ariaLabel ?? t('gitAgent.apiKey')}
        className="pr-20 font-mono"
        onFocus={() => {
          if (!disabled) setEditing(true)
        }}
        onBlur={() => {
          if (!value.trim()) setEditing(false)
          setRevealed(false)
        }}
        onChange={(event) => onChange(event.target.value)}
      />
      {hasValue && !disabled && (
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5">
          {!sealed && (
            <Button size="mini" variant="plain" aria-label={t(revealed ? 'gitAgent.hideKey' : 'gitAgent.showKey')} onClick={() => setRevealed(!revealed)}>
              {revealed ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
            </Button>
          )}
          <Button
            size="mini"
            variant="plain"
            aria-label={t('gitAgent.clearKey')}
            onClick={() => {
              onClear()
              setEditing(false)
              setRevealed(false)
            }}
          >
            <LuX aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
