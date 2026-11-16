/**
 * Resizable markdown table utility.
 * Allows interactive column width and row height adjustment with local persistence,
 * adapted from the reviewer workbench table architecture.
 */

const MIN_COL_PX = 72
const MIN_ROW_PX = 32
const STORAGE_PREFIX = 'yggit.md-table-layout.v1:'

type TableLayoutState = {
  cols: number[]
  rows: number[]
}

function hashFingerprint(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function tableFingerprint(table: HTMLTableElement): string {
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  const structure = `${table.rows.length}x${table.rows[0]?.cells.length ?? 0}`
  const text = (table.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1200)
  return hashFingerprint(`${path}|${structure}|${text}`)
}

function storageKey(fingerprint: string) {
  return `${STORAGE_PREFIX}${fingerprint}`
}

function loadLayout(fingerprint: string): TableLayoutState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(fingerprint))
    if (!raw) return null
    const parsed = JSON.parse(raw) as TableLayoutState
    if (!Array.isArray(parsed.cols) || !Array.isArray(parsed.rows)) return null
    return {
      cols: parsed.cols.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0),
      rows: parsed.rows.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0),
    }
  } catch {
    return null
  }
}

function saveLayout(fingerprint: string, state: TableLayoutState) {
  try {
    window.localStorage.setItem(storageKey(fingerprint), JSON.stringify(state))
  } catch {
    // Ignore quota / private mode limits
  }
}

function ensureColgroup(table: HTMLTableElement, columnCount: number) {
  let group = table.querySelector('colgroup')
  if (!group) {
    group = document.createElement('colgroup')
    table.insertBefore(group, table.firstChild)
  }
  while (group.children.length < columnCount) {
    group.appendChild(document.createElement('col'))
  }
  while (group.children.length > columnCount) {
    group.lastElementChild?.remove()
  }
  return group
}

function clearHandles(table: HTMLTableElement) {
  table.querySelectorAll('[data-md-table-resize]').forEach((node) => node.remove())
}

function readColWidth(col: HTMLTableColElement, fallbackCell?: HTMLElement) {
  const specified = Number.parseFloat(col.style.width)
  if (Number.isFinite(specified) && specified > 0) return specified
  const rect = col.getBoundingClientRect().width
  if (rect > 0) return rect
  return fallbackCell?.getBoundingClientRect().width || MIN_COL_PX
}

function syncTableWidth(table: HTMLTableElement, cols: HTMLTableColElement[]) {
  const total = cols.reduce((sum, col) => sum + readColWidth(col), 0)
  const width = Math.max(MIN_COL_PX * cols.length, Math.round(total))
  table.style.width = `${width}px`
  table.style.minWidth = `${width}px`
  table.style.maxWidth = 'none'
}

function collectLayout(table: HTMLTableElement, cols: HTMLTableColElement[]): TableLayoutState {
  return {
    cols: cols.map((col, index) => Math.round(readColWidth(col, table.rows[0]?.cells[index]))),
    rows: Array.from(table.rows).map((row) => {
      const specified = Number.parseFloat(row.style.height)
      if (Number.isFinite(specified) && specified > 0) return Math.round(specified)
      return Math.round(row.getBoundingClientRect().height)
    }),
  }
}

function applyRowHeight(row: HTMLTableRowElement, height: number) {
  const next = Math.max(MIN_ROW_PX, Math.round(height))
  row.style.height = `${next}px`
  Array.from(row.cells).forEach((cell) => {
    cell.style.height = `${next}px`
    cell.style.verticalAlign = 'top'
  })
}

function installSingleTableResizer(table: HTMLTableElement): () => void {
  clearHandles(table)
  table.style.tableLayout = 'fixed'

  const firstRow = table.rows[0]
  if (!firstRow || firstRow.cells.length === 0) return () => clearHandles(table)

  const columnCount = firstRow.cells.length
  const group = ensureColgroup(table, columnCount)
  const cols = Array.from(group.children) as HTMLTableColElement[]
  const fingerprint = tableFingerprint(table)
  const saved = loadLayout(fingerprint)

  // Seed column widths from saved state or computed widths
  Array.from(firstRow.cells).forEach((cell, index) => {
    const savedWidth = saved?.cols[index]
    const width = Math.max(MIN_COL_PX, Math.round(savedWidth && savedWidth > 0 ? savedWidth : cell.getBoundingClientRect().width || 120))
    cols[index].style.width = `${width}px`
  })
  syncTableWidth(table, cols)

  if (saved?.rows.length) {
    Array.from(table.rows).forEach((row, index) => {
      const savedHeight = saved.rows[index]
      if (savedHeight && savedHeight >= MIN_ROW_PX) applyRowHeight(row, savedHeight)
    })
  }

  const persist = () => saveLayout(fingerprint, collectLayout(table, cols))
  const cleanups: Array<() => void> = []

  // Column resize handles
  Array.from(firstRow.cells).forEach((cell, index) => {
    cell.style.position = 'relative'
    const handle = document.createElement('div')
    handle.dataset.mdTableResize = 'col'
    handle.className = 'md-table-resize-col'
    handle.title = 'Drag to resize column width'
    cell.appendChild(handle)

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      handle.setPointerCapture(event.pointerId)
      handle.dataset.active = 'true'
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const startX = event.clientX
      const startWidth = readColWidth(cols[index], firstRow.cells[index])
      const hasNeighbor = index < cols.length - 1
      const neighborStart = hasNeighbor ? readColWidth(cols[index + 1], firstRow.cells[index + 1]) : 0

      const onPointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX
        if (hasNeighbor) {
          const total = startWidth + neighborStart
          let next = Math.max(MIN_COL_PX, Math.round(startWidth + delta))
          let neighborNext = Math.max(MIN_COL_PX, total - next)
          if (neighborNext < MIN_COL_PX) {
            neighborNext = MIN_COL_PX
            next = Math.max(MIN_COL_PX, total - MIN_COL_PX)
          }
          cols[index].style.width = `${next}px`
          cols[index + 1].style.width = `${neighborNext}px`
        } else {
          const next = Math.max(MIN_COL_PX, Math.round(startWidth + delta))
          cols[index].style.width = `${next}px`
          syncTableWidth(table, cols)
        }
      }

      const onPointerUp = () => {
        handle.releasePointerCapture(event.pointerId)
        handle.dataset.active = 'false'
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        syncTableWidth(table, cols)
        persist()
        handle.removeEventListener('pointermove', onPointerMove)
        handle.removeEventListener('pointerup', onPointerUp)
        handle.removeEventListener('pointercancel', onPointerUp)
      }

      handle.addEventListener('pointermove', onPointerMove)
      handle.addEventListener('pointerup', onPointerUp)
      handle.addEventListener('pointercancel', onPointerUp)
    }

    handle.addEventListener('pointerdown', onPointerDown)
    cleanups.push(() => handle.removeEventListener('pointerdown', onPointerDown))
  })

  // Row height handles on the last cell of each row
  Array.from(table.rows).forEach((row) => {
    const anchor = row.cells[row.cells.length - 1]
    if (!anchor) return
    anchor.style.position = 'relative'
    const handle = document.createElement('div')
    handle.dataset.mdTableResize = 'row'
    handle.className = 'md-table-resize-row'
    handle.title = 'Drag to resize row height'
    anchor.appendChild(handle)

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      handle.setPointerCapture(event.pointerId)
      handle.dataset.active = 'true'
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'

      const startY = event.clientY
      const startHeight = Math.max(MIN_ROW_PX, Math.round(row.getBoundingClientRect().height || MIN_ROW_PX))

      const onPointerMove = (moveEvent: PointerEvent) => {
        applyRowHeight(row, startHeight + moveEvent.clientY - startY)
      }

      const onPointerUp = () => {
        handle.releasePointerCapture(event.pointerId)
        handle.dataset.active = 'false'
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        persist()
        handle.removeEventListener('pointermove', onPointerMove)
        handle.removeEventListener('pointerup', onPointerUp)
        handle.removeEventListener('pointercancel', onPointerUp)
      }

      handle.addEventListener('pointermove', onPointerMove)
      handle.addEventListener('pointerup', onPointerUp)
      handle.addEventListener('pointercancel', onPointerUp)
    }

    handle.addEventListener('pointerdown', onPointerDown)
    cleanups.push(() => handle.removeEventListener('pointerdown', onPointerDown))
  })

  return () => {
    for (const cleanup of cleanups) cleanup()
    clearHandles(table)
  }
}

/**
 * Searches for all tables within the container and installs column/row resize handles.
 * Ensures each table is safely wrapped in an overflow container.
 */
export function installTableResizers(container: HTMLElement): () => void {
  const tables = Array.from(container.querySelectorAll('table'))
  const cleanups: Array<() => void> = []

  tables.forEach((table) => {
    // Ensure table is inside an overflow container
    if (!table.parentElement?.classList.contains('md-table-resize-wrap')) {
      const wrap = document.createElement('div')
      wrap.className =
        'md-table-resize-wrap my-5 w-full overflow-x-auto rounded-lg border border-line bg-[color-mix(in_oklab,var(--panel)_70%,transparent)] shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
      wrap.setAttribute('tabindex', '0')
      wrap.setAttribute('aria-label', 'Table, scrollable horizontally')
      table.parentNode?.insertBefore(wrap, table)
      wrap.appendChild(table)
    }

    const signature = `${table.rows.length}x${table.rows[0]?.cells.length ?? 0}`
    if (table.dataset.mdResizeSig === signature && table.querySelector('[data-md-table-resize]')) {
      return
    }
    table.dataset.mdResizeSig = signature
    const cleanup = installSingleTableResizer(table)
    cleanups.push(cleanup)
  })

  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}
