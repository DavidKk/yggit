/** 顶栏下拉菜单（base-ui Menu）共用样式：语言切换、主题切换、dev 服务形态切换 */
export const dropdownTriggerClass = [
  'inline-flex h-8 cursor-pointer items-center gap-1 rounded-[0.2rem] border border-transparent bg-transparent px-2 text-[0.8125rem] font-medium text-ink-soft transition-colors duration-100',
  'hover:bg-[var(--overlay-06)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  'data-[popup-open]:bg-[var(--overlay-06)] data-[popup-open]:text-ink',
].join(' ')

export const dropdownPopupClass = 'min-w-[10rem] rounded-md border border-line bg-panel p-1 shadow-lg outline-none'

export const dropdownItemClass =
  'flex cursor-pointer items-center justify-between gap-3 rounded-[0.25rem] px-3 py-2 text-[0.8125rem] whitespace-nowrap text-ink outline-none data-[checked]:text-accent data-[highlighted]:bg-[var(--overlay-08)]'
