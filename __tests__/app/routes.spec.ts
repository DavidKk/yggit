import { describe, expect, it, jest } from '@jest/globals'

describe('页面路由契约', () => {
  it('/ 导出 Yggit 首页', async () => {
    jest.mock('@/components/git/GitLogPage', () => ({ GitLogPage: () => null }))
    const { default: Home } = await import('@/app/page')
    expect(typeof Home).toBe('function')
  })
})
