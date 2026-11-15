'use client'

import { type ChangeEvent, forwardRef, type InputHTMLAttributes, type MouseEvent } from 'react'
import { IoCloseOutline, IoSearchOutline } from 'react-icons/io5'

import { controlDisabled, controlDisabledShell, FORM_CONTROL_H, formControlChrome, formControlPadX } from '@/components/sk/control'
import { cn } from '@/lib/utils'

export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  invalid?: boolean
  /** 在 flex 行内占满剩余宽度（不影响默认自适应宽度） */
  fullWidth?: boolean
  /** 搜索框：左侧内嵌 search 图标（与输入同框，勿外挂独立搜索钮） */
  search?: boolean
  /** 有值时显示清除；通过受控 `onChange` 置空 */
  clearable?: boolean
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, invalid = false, fullWidth = false, search = false, clearable = false, type = 'text', disabled, value, onChange, ...rest },
  ref
) {
  const resolvedType = search ? 'search' : type
  const hasValue = value != null && String(value).length > 0
  const showClear = clearable && hasValue && !disabled

  function clearValue(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!onChange) return
    const target = { value: '' } as EventTarget & HTMLInputElement
    onChange({ target, currentTarget: target } as ChangeEvent<HTMLInputElement>)
  }

  const input = (
    <input
      ref={ref}
      type={resolvedType}
      disabled={disabled}
      value={value}
      onChange={onChange}
      aria-invalid={invalid || undefined}
      className={cn(
        search
          ? cn(
              'm-0 h-full min-h-0 min-w-0 flex-1 appearance-none rounded-none border-none bg-transparent py-0 pr-0.5 pl-0',
              'font-inherit text-[0.8125rem] leading-none text-ink outline-none',
              'disabled:cursor-not-allowed',
              // Hide native search clear; we render a shared clear control.
              '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none'
            )
          : cn(formControlChrome, formControlPadX, FORM_CONTROL_H, 'min-w-[5.5rem] focus:border-accent', controlDisabled),
        !search && fullWidth && 'w-full min-w-0 flex-1',
        !search && invalid && 'border-fail',
        !search && showClear && 'pr-7',
        !search && className
      )}
      {...rest}
      onKeyDown={(e) => {
        e.stopPropagation()
        rest.onKeyDown?.(e)
      }}
      onKeyUp={(e) => {
        e.stopPropagation()
        rest.onKeyUp?.(e)
      }}
    />
  )

  if (!search && !showClear) return input

  if (!search) {
    return (
      <span className={cn('relative inline-flex min-w-[5.5rem]', fullWidth && 'w-full min-w-0 flex-1', className)}>
        {input}
        {showClear ? (
          <button
            type="button"
            aria-label="清除"
            className="absolute top-1/2 right-1.5 inline-flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[0.15rem] border-0 bg-transparent p-0 text-ink-soft hover:text-ink"
            onMouseDown={clearValue}
          >
            <IoCloseOutline size={14} aria-hidden />
          </button>
        ) : null}
      </span>
    )
  }

  return (
    <span
      className={cn(
        formControlChrome,
        FORM_CONTROL_H,
        'inline-flex min-w-[5.5rem] items-center gap-1 pr-1.5 pl-2 focus-within:border-accent',
        fullWidth && 'w-full min-w-0 flex-1',
        invalid && 'border-fail',
        disabled && controlDisabledShell,
        className
      )}
      data-disabled={disabled || undefined}
    >
      <IoSearchOutline size={14} className="shrink-0 text-ink-soft" aria-hidden />
      {input}
      {showClear ? (
        <button
          type="button"
          aria-label="清除搜索"
          className="inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[0.15rem] border-0 bg-transparent p-0 text-ink-soft hover:text-ink"
          onMouseDown={clearValue}
        >
          <IoCloseOutline size={14} aria-hidden />
        </button>
      ) : null}
    </span>
  )
})
