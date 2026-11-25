'use client'

import React, { forwardRef, type ReactNode, useCallback, useId, useRef, useState } from 'react'
import { LuX } from 'react-icons/lu'

import { controlDisabled, controlDisabledShell, formControlChrome } from '@/components/sk/control'
import { FormMessageDropdown } from '@/components/sk/FormMessageDropdown'
import { cn } from '@/lib/utils'

export interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  error?: ReactNode
  warn?: ReactNode
  className?: string
  id?: string
  'aria-label'?: string
  maxTags?: number
  multiline?: boolean
  rows?: number
}

/**
 * Public TagInput component for calm, keyboard-friendly multi-item entry.
 * Supports:
 * - Enter / Comma separation
 * - Backspace deletion of the last item
 * - Multi-item paste (comma or newline separated)
 * - Auto-commit on blur
 * - Clickable removal buttons for each tag
 * - Optional multiline / multi-row default height
 */
export const TagInput = forwardRef<HTMLInputElement, TagInputProps>(function TagInput(
  {
    value = [],
    onChange,
    placeholder = '输入内容后按 Enter 添加...',
    disabled = false,
    invalid = false,
    error,
    warn,
    className,
    id,
    'aria-label': ariaLabel,
    maxTags,
    multiline = false,
    rows,
  },
  forwardedRef
) {
  const resolvedInvalid = invalid || Boolean(error)
  const resolvedWarn = !resolvedInvalid && Boolean(warn)
  const generatedId = useId()
  const inputId = id || generatedId
  const internalInputRef = useRef<HTMLInputElement>(null)
  const inputRef = (forwardedRef as React.RefObject<HTMLInputElement>) || internalInputRef

  const [inputValue, setInputValue] = useState('')

  const isMultiline = multiline || (typeof rows === 'number' && rows > 1)
  const multilineHeightClass = rows ? (rows >= 5 ? 'min-h-36' : rows === 4 ? 'min-h-32' : rows === 3 ? 'min-h-24' : 'min-h-16') : isMultiline ? 'min-h-24' : 'min-h-8'

  const commitValue = useCallback(
    (raw: string) => {
      const trimmed = raw.trim().replace(/^[,;，；\s]+|[,;，；\s]+$/g, '')
      if (!trimmed) {
        setInputValue('')
        return
      }
      if (maxTags && value.length >= maxTags) return

      // Split by commas, semicolons or newlines to allow batch paste or typing
      const tokens = trimmed
        .split(/[,;，；\n]+/)
        .map((t) => t.trim())
        .filter(Boolean)

      const toAdd = tokens.filter((t) => !value.some((tag) => tag.toLowerCase() === t.toLowerCase()))
      if (toAdd.length > 0) {
        onChange([...value, ...toAdd])
      }
      setInputValue('')
    },
    [value, onChange, maxTags]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === '，' || e.key === '；' || (e.key === 'Tab' && inputValue.trim())) {
      if (e.key === 'Tab') {
        commitValue(inputValue)
      } else {
        e.preventDefault()
        commitValue(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      e.preventDefault()
      onChange(value.slice(0, -1))
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return
    const text = e.clipboardData.getData('text')
    if (!text) return

    if (text.includes(',') || text.includes('，') || text.includes(';') || text.includes('；') || text.includes('\n')) {
      e.preventDefault()
      const newTags = text
        .split(/[\n,;，；]+/)
        .map((t) => t.trim())
        .filter(Boolean)

      const merged = [...value]
      for (const item of newTags) {
        if (!merged.some((m) => m.toLowerCase() === item.toLowerCase())) {
          if (!maxTags || merged.length < maxTags) {
            merged.push(item)
          }
        }
      }
      onChange(merged)
      setInputValue('')
    }
  }

  const handleBlur = () => {
    if (inputValue.trim()) {
      commitValue(inputValue)
    }
  }

  const removeTag = (indexToRemove: number) => {
    if (disabled) return
    onChange(value.filter((_, idx) => idx !== indexToRemove))
    inputRef.current?.focus()
  }

  const box = (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        formControlChrome,
        'h-auto flex flex-wrap gap-x-2 gap-y-1.5 px-2.5 py-1.5 cursor-text transition-colors',
        isMultiline ? cn(multilineHeightClass, 'items-start content-start max-h-56 overflow-y-auto') : 'min-h-9 items-center',
        resolvedInvalid && 'border-fail',
        resolvedWarn && 'border-warn',
        disabled && controlDisabledShell,
        !error && !warn && className
      )}
    >
      {value.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex h-6 items-center gap-1.5 rounded-md bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] border border-line/70 px-2 py-0 text-xs text-ink font-mono select-none"
        >
          <span className="max-w-[200px] truncate leading-none">{tag}</span>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(idx)
              }}
              className="text-ink-soft hover:text-danger hover:bg-danger/10 rounded p-0.5 transition-colors cursor-pointer"
              aria-label={`Remove ${tag}`}
            >
              <LuX className="size-3" aria-hidden="true" />
            </button>
          )}
        </span>
      ))}

      <input
        ref={inputRef}
        id={inputId}
        type="text"
        disabled={disabled}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={handleBlur}
        placeholder={value.length === 0 ? placeholder : '+ 添加...'}
        aria-label={ariaLabel || placeholder}
        className={cn(
          'h-6 min-w-[5.5rem] flex-1 appearance-none border-none bg-transparent px-1 text-xs leading-normal text-ink placeholder:text-ink-soft/70 outline-none',
          controlDisabled
        )}
      />
    </div>
  )

  if (!error && !warn) return box

  return (
    <div className={cn('relative w-full', className)}>
      {box}
      <FormMessageDropdown error={error} warn={warn} />
    </div>
  )
})
