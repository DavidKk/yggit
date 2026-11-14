import type { KeyboardEvent } from 'react'

function focusTreeId(from: EventTarget & Element, id: string) {
  const root = from.closest('[data-git-tree-root]')
  const target = root?.querySelector<HTMLElement>(`[data-git-tree-id="${CSS.escape(id)}"]`)
  target?.focus()
}

/** VS Code–style: ← collapse when expanded, → expand when collapsed. */
export function handleTreeExpandKey(event: KeyboardEvent, expanded: boolean, setExpanded: (next: boolean) => void) {
  if (event.key === 'ArrowLeft') {
    if (!expanded) return false
    event.preventDefault()
    setExpanded(false)
    return true
  }
  if (event.key === 'ArrowRight') {
    if (expanded) return false
    event.preventDefault()
    setExpanded(true)
    return true
  }
  return false
}

/** ← on a collapsed/leaf row: move focus to parent folder. */
export function handleTreeParentKey(event: KeyboardEvent, parentId: string | undefined) {
  if (event.key !== 'ArrowLeft' || !parentId) return false
  event.preventDefault()
  focusTreeId(event.currentTarget, parentId)
  return true
}
