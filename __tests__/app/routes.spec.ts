import { describe, expect, it, jest } from '@jest/globals'

describe('页面路由契约', () => {
  it('/ 导出 Yggit 官方首页', async () => {
    const { default: Home } = await import('@/app/page')
    expect(typeof Home).toBe('function')
  })

  it('/git 导出 Git 工作区页面', async () => {
    jest.mock('@/components/git/GitLogPage', () => ({ GitLogPage: () => null }))
    const { default: GitWorkspacePage } = await import('@/app/(workspace)/git/page')
    expect(typeof GitWorkspacePage).toBe('function')
  })

  it('/git/[...slug] 导出 Git 仓库与提交页面', async () => {
    const { default: GitSlugPage } = await import('@/app/(workspace)/git/[...slug]/page')
    expect(typeof GitSlugPage).toBe('function')
  })

  it('/settings 导出设置中心页面', async () => {
    const { default: SettingsPage } = await import('@/app/(workspace)/settings/page')
    expect(typeof SettingsPage).toBe('function')
  })

  it('/privacy 导出隐私设置独立页面', async () => {
    const { default: PrivacyPage } = await import('@/app/(workspace)/privacy/page')
    expect(typeof PrivacyPage).toBe('function')
  })

  it('/settings/privacy 导出隐私设置子路由页面', async () => {
    const { default: SettingsPrivacyPage } = await import('@/app/(workspace)/settings/privacy/page')
    expect(typeof SettingsPrivacyPage).toBe('function')
  })

  it('/settings/general 导出通用偏好子路由页面', async () => {
    const { default: SettingsGeneralPage } = await import('@/app/(workspace)/settings/general/page')
    expect(typeof SettingsGeneralPage).toBe('function')
  })

  it('/settings/menus 导出右键菜单子路由页面', async () => {
    const { default: SettingsMenusPage } = await import('@/app/(workspace)/settings/menus/page')
    expect(typeof SettingsMenusPage).toBe('function')
  })

  it('/settings/models 导出模型接入子路由页面', async () => {
    const { default: SettingsModelsPage } = await import('@/app/(workspace)/settings/models/page')
    expect(typeof SettingsModelsPage).toBe('function')
  })

  it('/settings/models/new 导出新建模型接入页面', async () => {
    const { default: NewModelPage } = await import('@/app/(workspace)/settings/models/new/page')
    expect(typeof NewModelPage).toBe('function')
  })

  it('/settings/models/[id] 导出编辑模型接入页面', async () => {
    const { default: EditModelPage } = await import('@/app/(workspace)/settings/models/[id]/page')
    expect(typeof EditModelPage).toBe('function')
  })

  it('/repo/[...slug] 导出兼容重定向页面', async () => {
    const { default: LegacyRepoRedirectPage } = await import('@/app/repo/[...slug]/page')
    expect(typeof LegacyRepoRedirectPage).toBe('function')
  })
})
