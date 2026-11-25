import { cn } from '@/lib/utils'

/** Unified desktop form control height: 32px (Button md/icon, TextInput, Select, NumberInput, FilterToggle) */
export const FORM_CONTROL_H = 'h-8'

/** Unified input chrome: fixed 32px height, 6px radius, 1px border, paper background */
export const formControlChrome = cn(
  'box-border h-8 appearance-none rounded-md border border-line bg-paper font-inherit text-xs leading-none text-ink placeholder:text-ink-soft/70 outline-none transition-colors duration-100 focus:border-accent'
)

export const formControlPadX = 'px-2.5'

/** Unified disabled state for native controls */
export const controlDisabled = 'disabled:cursor-not-allowed disabled:opacity-45'

/** Unified disabled state for non-native wrapper shells */
export const controlDisabledShell = 'cursor-not-allowed opacity-45'
