import { getAgentProcessingStatus } from '@/lib/agent/status-helper'

describe('getAgentProcessingStatus', () => {
  it('returns project opening status when user asks to open project', () => {
    expect(getAgentProcessingStatus('帮我打开 test 项目')).toBe('正在准备打开并加载项目...')
    expect(getAgentProcessingStatus('open project backend')).toBe('正在准备打开并加载项目...')
    expect(getAgentProcessingStatus('切换仓库 admin')).toBe('正在准备打开并加载项目...')
  })

  it('returns branch focusing status when user asks about branch', () => {
    expect(getAgentProcessingStatus('帮我跳转到 feat/a 分支')).toBe('正在定位并聚焦目标分支...')
    expect(getAgentProcessingStatus('focus branch main')).toBe('正在定位并聚焦目标分支...')
  })

  it('returns settings opening status when user asks about settings', () => {
    expect(getAgentProcessingStatus('打开设置')).toBe('正在打开应用设置...')
    expect(getAgentProcessingStatus('进入通用偏好设置')).toBe('正在打开应用设置...')
  })

  it('returns theme switching status when user asks about theme', () => {
    expect(getAgentProcessingStatus('切换深色模式')).toBe('正在切换外观主题...')
    expect(getAgentProcessingStatus('切浅色模式')).toBe('正在切换外观主题...')
  })

  it('returns conflict analyzing status when user asks about conflicts', () => {
    expect(getAgentProcessingStatus('排查合并冲突')).toBe('正在分析代码冲突与合并状态...')
  })

  it('returns git analyzing status when user asks about commit / merge history', () => {
    expect(getAgentProcessingStatus('查询今日 merge')).toBe('正在分析 Git 仓库与提交记录...')
    expect(getAgentProcessingStatus('查看最近的提交记录')).toBe('正在分析 Git 仓库与提交记录...')
  })

  it('returns default fallback status for general inquiries', () => {
    expect(getAgentProcessingStatus('你好')).toBe('Agent 正在思考并执行操作...')
    expect(getAgentProcessingStatus('')).toBe('Agent 正在思考并执行操作...')
  })
})
