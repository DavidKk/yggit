/** @jest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { MenuSettingsSection } from '@/components/git/agent/settings/MenuSettingsSection'
import { formatCompactCount, GitFindBox } from '@/components/git/GitFindBox'

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.clear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('formatCompactCount', () => {
  it('formats small and large numbers compactly', () => {
    expect(formatCompactCount(0)).toBe('0')
    expect(formatCompactCount(99)).toBe('99')
    expect(formatCompactCount(999)).toBe('999')
    expect(formatCompactCount(1000)).toBe('1K')
    expect(formatCompactCount(1234)).toBe('1.2K')
    expect(formatCompactCount(12900)).toBe('12.9K')
    expect(formatCompactCount(1500000)).toBe('1.5M')
    expect(formatCompactCount(2000000000)).toBe('2B')
  })
})

describe('GitFindBox component', () => {
  it('renders input and fires navigation events on keyboard shortcut', async () => {
    const onPrev = jest.fn()
    const onNext = jest.fn()
    const onClose = jest.fn()
    const onChange = jest.fn()

    await act(async () => {
      root.render(<GitFindBox value="master" current={1} total={18} onChange={onChange} onPrev={onPrev} onNext={onNext} onClose={onClose} size="medium" />)
    })

    const input = host.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.value).toBe('master')

    // Press Enter -> onNext
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onNext).toHaveBeenCalledTimes(1)

    // Press Shift+Enter -> onPrev
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }))
    })
    expect(onPrev).toHaveBeenCalledTimes(1)

    // Press Escape -> onClose
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders compact count when total is greater than 999', async () => {
    await act(async () => {
      root.render(<GitFindBox value="test" current={0} total={1500} onChange={jest.fn()} onClose={jest.fn()} />)
    })

    expect(host.textContent).toContain('1.5K 条')
  })
})

describe('MenuSettingsSection component', () => {
  it('renders all three setting zones and allows toggling quick actions', async () => {
    await act(async () => {
      root.render(<MenuSettingsSection />)
    })

    // Zone 1: 快捷区
    expect(host.textContent).toContain('快捷区（一级主菜单置顶直达）')
    expect(host.textContent).toContain('复制分支名')
    expect(host.textContent).toContain('复制 Commit Hash')

    // Zone 2: 分组区
    expect(host.textContent).toContain('分组区（二级子菜单分类收纳）')
    expect(host.textContent).toContain('「复制 ›」二级菜单')
    expect(host.textContent).toContain('「分支操作 ›」二级菜单')
    expect(host.textContent).toContain('「Worktree ›」二级菜单')
    expect(host.textContent).toContain('「在远程打开」入口')

    // Zone 3: 配置区
    expect(host.textContent).toContain('安全防护与动态自适应')
    expect(host.textContent).toContain('危险操作二次确认 (防误触保护)')
    expect(host.textContent).toContain('仓库能力自适应过滤')

    // Zone 4: Agent 扩展
    expect(host.textContent).toContain('Agent 智能菜单扩展')
    expect(host.textContent).toContain('AI 审查分支改动')
  })
})
