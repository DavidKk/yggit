/** @jest-environment jsdom */
import { installTableResizers } from '@/components/git/markdownTableResizer'

describe('installTableResizers', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
    window.localStorage.clear()
  })

  it('wraps un-wrapped tables and attaches col/row resize handles', () => {
    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cell 1</td>
            <td>Cell 2</td>
          </tr>
        </tbody>
      </table>
    `
    const cleanup = installTableResizers(container)

    const table = container.querySelector('table')
    expect(table).not.toBeNull()
    expect(table?.parentElement?.classList.contains('md-table-resize-wrap')).toBe(true)

    // Checks colgroup created
    const colgroup = table?.querySelector('colgroup')
    expect(colgroup).not.toBeNull()
    expect(colgroup?.querySelectorAll('col').length).toBe(2)

    // Checks col resize handles created
    const colHandles = table?.querySelectorAll('[data-md-table-resize="col"]')
    expect(colHandles?.length).toBe(2)

    // Checks row resize handles created
    const rowHandles = table?.querySelectorAll('[data-md-table-resize="row"]')
    expect(rowHandles?.length).toBe(2)

    cleanup()
    expect(table?.querySelectorAll('[data-md-table-resize]').length).toBe(0)
  })

  it('safely handles empty tables or tables without cells', () => {
    container.innerHTML = `<table><tbody></tbody></table>`
    const cleanup = installTableResizers(container)
    expect(container.querySelectorAll('[data-md-table-resize]').length).toBe(0)
    cleanup()
  })
})
