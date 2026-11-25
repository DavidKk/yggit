/** 顶栏下拉菜单（base-ui Menu）与顶部通用功能按钮共用样式：语言切换、主题切换、dev 服务形态切换、设置 */
export const dropdownTriggerClass = [
  'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 text-xs font-medium text-ink-soft transition-all duration-150 select-none',
  'hover:border-line/70 hover:bg-hover hover:text-ink focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent',
  'data-[popup-open]:border-line/70 data-[popup-open]:bg-hover data-[popup-open]:text-ink',
].join(' ')

export const dropdownPopupClass = 'min-w-[10rem] rounded-md border border-line bg-panel p-1 shadow-lg outline-none'

export const dropdownItemClass =
  'flex cursor-pointer items-center justify-between gap-3 rounded-[0.25rem] px-3 py-2 text-[0.8125rem] whitespace-nowrap text-ink outline-none data-[checked]:text-accent data-[highlighted]:bg-[var(--overlay-08)]'
