/**
 * Resolves contextual dynamic progress status for Git Agent based on user prompt.
 */
export function getAgentProcessingStatus(userPrompt?: string, t?: (key: any, params?: any) => string): string {
  const p = (userPrompt || '').toLowerCase()
  if (p.includes('项目') || p.includes('仓库') || p.includes('project') || p.includes('repo')) {
    return t ? t('gitAgent.processingProject') || '正在准备打开并加载项目...' : '正在准备打开并加载项目...'
  }
  if (p.includes('分支') || p.includes('branch')) {
    return t ? t('gitAgent.processingBranch') || '正在定位并聚焦目标分支...' : '正在定位并聚焦目标分支...'
  }
  if (p.includes('设置') || p.includes('setting') || p.includes('偏好') || p.includes('配置') || p.includes('接入') || p.includes('模型')) {
    return t ? t('gitAgent.processingSettings') || '正在打开应用设置...' : '正在打开应用设置...'
  }
  if (p.includes('主题') || p.includes('深色') || p.includes('浅色') || p.includes('dark') || p.includes('theme') || p.includes('mode')) {
    return t ? t('gitAgent.processingTheme') || '正在切换外观主题...' : '正在切换外观主题...'
  }
  if (p.includes('冲突') || p.includes('conflict')) {
    return t ? t('gitAgent.processingConflict') || '正在分析代码冲突与合并状态...' : '正在分析代码冲突与合并状态...'
  }
  if (p.includes('diff') || p.includes('对比') || p.includes('代码') || p.includes('修改')) {
    return t ? t('gitAgent.processingCode') || '正在检索代码与变更细节...' : '正在检索代码与变更细节...'
  }
  if (
    p.includes('merge') ||
    p.includes('合并') ||
    p.includes('commit') ||
    p.includes('提交') ||
    p.includes('log') ||
    p.includes('记录') ||
    p.includes('排查') ||
    p.includes('分析')
  ) {
    return t ? t('gitAgent.analyzingLog') || '正在分析 Git 仓库与提交记录...' : '正在分析 Git 仓库与提交记录...'
  }
  return t ? t('gitAgent.processingDefault') || 'Agent 正在思考并执行操作...' : 'Agent 正在思考并执行操作...'
}
