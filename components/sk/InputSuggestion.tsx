'use client'

import { type ChangeEvent, type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoCheckmark, IoChevronDown } from 'react-icons/io5'

import { controlDisabled, controlDisabledShell, formControlChrome } from '@/components/sk/control'
import { FormMessageDropdown } from '@/components/sk/FormMessageDropdown'
import { ScrollArea } from '@/components/sk/ScrollArea'
import { type FloatingPanelWidthMode, useFloatingPanel } from '@/components/sk/useFloatingPanel'
import { cn } from '@/lib/utils'

const PANEL_MAX_HEIGHT_PX = 240

export interface InputSuggestionOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface InputSuggestionAction {
  label?: string
  title?: string
  icon?: ReactNode
  loading?: boolean
  disabled?: boolean
  onClick: () => void | Promise<void>
}

export interface InputSuggestionProps {
  id?: string
  name?: string
  value: string
  options: InputSuggestionOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  error?: React.ReactNode
  warn?: React.ReactNode
  className?: string
  'aria-label'?: string
  autoComplete?: string
  panelWidth?: FloatingPanelWidthMode
  fullWidth?: boolean
  action?: InputSuggestionAction
}

function optionMatches(option: InputSuggestionOption, needle: string) {
  if (!needle) return true
  return `${option.label}\n${option.value}`.toLowerCase().includes(needle)
}

/**
 * Public InputSuggestion component:
 * Combines free typing with live-filtered suggestions in a single cohesive control.
 * Typing automatically filters options, selecting an option picks it, and custom text works directly.
 */
export function InputSuggestion({
  id,
  name,
  value,
  options,
  onChange,
  placeholder = '选择或输入...',
  disabled = false,
  invalid = false,
  error,
  warn,
  className,
  'aria-label': ariaLabel,
  autoComplete = 'off',
  panelWidth = 'anchor',
  fullWidth = true,
  action,
}: InputSuggestionProps) {
  const generatedId = useId()
  const inputId = id || generatedId
  const listboxId = `${inputId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [mounted, setMounted] = useState(false)

  const needle = value.trim().toLowerCase()
  const filteredOptions = useMemo(() => {
    return options.filter((opt) => optionMatches(opt, needle))
  }, [needle, options])

  const hasExactMatch = useMemo(() => {
    return options.some((opt) => opt.value.toLowerCase() === needle)
  }, [needle, options])

  const panelStyle = useFloatingPanel({
    open,
    anchorRef: rootRef,
    panelRef,
    maxHeight: PANEL_MAX_HEIGHT_PX,
    widthMode: panelWidth,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setHighlight(-1)
  }, [])

  const openPanel = useCallback(() => {
    if (disabled) return
    setOpen(true)
  }, [disabled])

  useEffect(() => {
    if (!open) return
    setHighlight(filteredOptions.findIndex((opt) => !opt.disabled))
  }, [open, filteredOptions])

  const pick = useCallback(
    (chosenValue: string) => {
      onChange(chosenValue)
      close()
      inputRef.current?.focus()
    },
    [close, onChange]
  )

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      const path = typeof e.composedPath === 'function' ? e.composedPath() : []
      const inPath = (node: Node | null) => Boolean(node && (node.contains(target) || path.includes(node)))
      if (inPath(rootRef.current) || inPath(panelRef.current)) return
      close()
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [close, open])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!open) openPanel()
    onChange(event.target.value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        openPanel()
      } else {
        setHighlight((current) => {
          for (let idx = current + 1; idx < filteredOptions.length; idx += 1) {
            if (!filteredOptions[idx]?.disabled) return idx
          }
          return current
        })
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openPanel()
      } else {
        setHighlight((current) => {
          for (let idx = current - 1; idx >= 0; idx -= 1) {
            if (!filteredOptions[idx]?.disabled) return idx
          }
          return current
        })
      }
    } else if (event.key === 'Enter') {
      if (open && highlight >= 0 && filteredOptions[highlight]) {
        event.preventDefault()
        pick(filteredOptions[highlight].value)
      } else if (open) {
        close()
      }
    }
  }

  return (
    <div ref={rootRef} className={cn('relative inline-block', fullWidth && 'w-full', className)}>
      <div
        className={cn(
          formControlChrome,
          'relative flex h-9 items-center justify-between pl-3 pr-1.5 cursor-text focus-within:border-accent transition-colors',
          (invalid || Boolean(error)) && '!border-fail ring-1 !ring-fail/30 focus-within:!border-fail',
          !(invalid || Boolean(error)) && Boolean(warn) && '!border-warn ring-1 !ring-warn/30 focus-within:!border-warn',
          disabled && controlDisabledShell
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          name={name || 'agent_model_query'}
          type="text"
          value={value}
          disabled={disabled}
          onChange={handleInputChange}
          onFocus={openPanel}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete={autoComplete}
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          spellCheck={false}
          className={cn('w-full min-w-0 bg-transparent pr-2 text-xs text-ink placeholder:text-ink-soft/70 outline-none', disabled && controlDisabled)}
        />
        <div className="flex items-center shrink-0 gap-1 ml-1">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation()
              if (open) close()
              else {
                openPanel()
                inputRef.current?.focus()
              }
            }}
            className="p-1 text-ink-soft hover:text-ink hover:bg-[var(--overlay-06)] rounded-sm cursor-pointer disabled:cursor-not-allowed transition-colors"
            aria-label="Toggle suggestions"
          >
            <IoChevronDown className={cn('size-3.5 transition-transform duration-150', open && 'rotate-180')} />
          </button>
          {action ? (
            <>
              <div className="h-4 w-px bg-line/80 my-auto shrink-0" aria-hidden="true" />
              <button
                type="button"
                tabIndex={0}
                disabled={disabled || action.disabled || action.loading}
                title={action.title}
                onClick={(e) => {
                  e.stopPropagation()
                  close()
                  void action.onClick()
                }}
                className={cn(
                  'inline-flex items-center justify-center font-medium leading-none rounded text-ink-soft hover:text-ink hover:bg-[var(--overlay-08)] active:bg-[var(--overlay-12)] cursor-pointer transition-colors shrink-0 select-none',
                  action.label ? 'gap-1.5 px-2 py-1 text-[12px]' : 'size-6 p-1',
                  (disabled || action.disabled || action.loading) && 'cursor-not-allowed opacity-50'
                )}
              >
                {action.icon}
                {action.label ? <span>{action.label}</span> : null}
              </button>
            </>
          ) : null}
        </div>
      </div>
      {!open && <FormMessageDropdown error={error} warn={warn} />}

      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            id={listboxId}
            style={panelStyle}
            role="listbox"
            className="overflow-hidden rounded-md border border-line bg-panel py-1 shadow-lg backdrop-blur-md transition-opacity duration-100"
          >
            <ScrollArea className="max-h-56">
              {filteredOptions.length > 0
                ? filteredOptions.map((option, idx) => {
                    const isSelected = option.value === value
                    const isHighlighted = idx === highlight
                    return (
                      <div
                        key={option.value}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => pick(option.value)}
                        onMouseEnter={() => setHighlight(idx)}
                        className={cn(
                          'flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs select-none transition-colors',
                          isHighlighted ? 'bg-[var(--overlay-06)] text-ink' : 'text-ink-soft hover:text-ink',
                          option.disabled && 'cursor-not-allowed opacity-45'
                        )}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className={cn('truncate', isSelected && 'font-medium text-accent')}>{option.label}</span>
                          {option.description && <span className="truncate text-[11px] text-ink-soft/80">{option.description}</span>}
                        </div>
                        {isSelected && <IoCheckmark className="size-4 shrink-0 text-accent" aria-hidden />}
                      </div>
                    )
                  })
                : null}

              {/* Free typing / custom fallback indicator */}
              {!hasExactMatch && needle ? (
                <div
                  role="option"
                  aria-selected={false}
                  onClick={() => pick(value)}
                  className="flex cursor-pointer items-center justify-between border-t border-line/60 px-3 py-1.5 text-xs text-ink-soft hover:bg-[var(--overlay-06)] hover:text-ink select-none"
                >
                  <span className="truncate font-mono text-[11px]">
                    使用自定义模型: <span className="font-semibold text-accent">{value}</span>
                  </span>
                </div>
              ) : null}

              {filteredOptions.length === 0 && !needle ? <div className="px-3 py-2 text-center text-xs text-ink-soft/70">暂无可选模型建议</div> : null}
            </ScrollArea>
          </div>,
          document.body
        )}
    </div>
  )
}
