'use client'

import { useState } from 'react'
import { LuCheck, LuX } from 'react-icons/lu'

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

/**
 * Custom masked token input without type="password", preventing browser password manager prompts.
 * Strictly adheres to write-only security: once saved, tokens cannot be re-revealed in plaintext.
 */
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
  const sealed = configured && !editing && !value
  const hasValue = sealed || Boolean(value)

  return (
    <div className={cn('relative w-full', className)}>
      <TextInput
        id={id}
        name="custom_api_secret_token"
        data-webmcp-sensitive=""
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
        data-form-type="other"
        fullWidth
        disabled={disabled}
        autoFocus={autoFocus}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={sealed ? '••••••••' : value}
        readOnly={sealed}
        style={{
          ...({ WebkitTextSecurity: sealed || value ? 'disc' : 'none' } as React.CSSProperties),
        }}
        placeholder={placeholder ?? t('gitAgent.apiKeyPlaceholder') ?? '输入 Token 或 API 密钥…'}
        aria-label={ariaLabel ?? t('gitAgent.apiKey') ?? 'API 密钥'}
        className="pr-20 font-mono"
        onFocus={() => {
          if (!disabled && !sealed) setEditing(true)
        }}
        onBlur={() => {
          if (!value.trim()) setEditing(false)
        }}
        onChange={(event) => onChange(event.target.value)}
      />

      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {sealed && (
          <span className="flex items-center gap-1 rounded bg-ok/10 px-1.5 py-0.5 text-[10px] font-medium text-ok select-none pointer-events-none">
            <LuCheck className="size-3" aria-hidden="true" />
            已配置
          </span>
        )}

        {hasValue && !disabled && (
          <Button
            size="mini"
            variant="plain"
            title={sealed ? '清除已存配置并重新输入' : t('gitAgent.clearKey') || '清除'}
            aria-label={t('gitAgent.clearKey') || '清除密钥'}
            onClick={() => {
              onClear()
              setEditing(false)
            }}
          >
            <LuX className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}
