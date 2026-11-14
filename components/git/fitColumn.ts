/** Measure untruncated content width for Excel-style column autofit. */
export function measureCellsFit(root: HTMLElement, selector: string): number {
  let max = 0
  root.querySelectorAll(selector).forEach((node) => {
    const el = node as HTMLElement
    const clone = el.cloneNode(true) as HTMLElement
    clone.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;display:inline-flex;width:max-content;max-width:none;overflow:visible;height:auto'
    clone.querySelectorAll('.truncate').forEach((item) => {
      const target = item as HTMLElement
      target.style.maxWidth = 'none'
      target.style.overflow = 'visible'
      target.style.textOverflow = 'clip'
      target.style.whiteSpace = 'nowrap'
    })
    root.appendChild(clone)
    max = Math.max(max, clone.scrollWidth)
    clone.remove()
  })
  return Math.ceil(max)
}

/** Measure label + its offset inside a panel (sidebar / tree). */
export function measurePanelFit(root: HTMLElement, selector: string, padEnd = 12): number {
  let max = 0
  const rootLeft = root.getBoundingClientRect().left
  root.querySelectorAll(selector).forEach((node) => {
    const el = node as HTMLElement
    const clone = el.cloneNode(true) as HTMLElement
    const font = getComputedStyle(el)
    clone.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;max-width:none;width:max-content;display:inline-block'
    clone.style.font = font.font
    clone.style.letterSpacing = font.letterSpacing
    root.appendChild(clone)
    const textW = clone.getBoundingClientRect().width
    clone.remove()
    max = Math.max(max, el.getBoundingClientRect().left - rootLeft + textW + padEnd)
  })
  return Math.ceil(max)
}
