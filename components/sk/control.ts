import { cn } from '@/lib/utils'

/** 表单控件统一高度（Button md、Input、Select、NumberInput、ApiKeyInput） */
export const FORM_CONTROL_H = 'h-9'

/** 输入类控件外框：固定高度 + 舒适圆角 + 描边 + paper 底 */
export const formControlChrome = cn(
  'box-border h-9 appearance-none rounded-md border border-line bg-paper font-inherit text-xs leading-none text-ink placeholder:text-ink-soft/70 outline-none transition-colors duration-100 focus:border-accent'
)

export const formControlPadX = 'px-3'

/** 全站统一禁用态（原生控件用 `disabled:` 变体） */
export const controlDisabled = 'disabled:cursor-not-allowed disabled:opacity-45'

/** 同上，给 span 外壳等非原生控件按条件追加 */
export const controlDisabledShell = 'cursor-not-allowed opacity-45'
