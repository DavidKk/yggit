import type { WorkdeskMessages } from './types'

export const workdeskZh: { workdesk: WorkdeskMessages } = {
  workdesk: {
    title: '工作台',
    topbarTitle: '工作台',
    emptyTitle: '目前没有需要你处理的 Git 工作',
    emptyDesc: '所有接入仓库分支状态健康，无未同步改动或分叉',
    lane: {
      branch: '分支维护',
      merge: '合并集成',
      standard: '研发规范',
      review: '代码审查',
    },
    cards: {
      syncDefaultBranches: {
        title: '同步默认分支',
        summary: '检查各项目默认分支与远端的同步状态，识别可安全快进的项目',
      },
      worktreeParallelDev: {
        title: '检查并行开发工作',
        summary: '巡检各项目的独立 Worktree 与特性分支健康度',
      },
      mergeDivergedBranches: {
        title: '核对分叉与待合并分支',
        summary: '检测本地与远端分叉或存在潜在冲突的分支，指引合并或变基',
      },
      standardRepoHygiene: {
        title: '研发规范与分支命名巡检',
        summary: '巡检未遵循团队约定的分支命名及规范校验',
      },
      standardProjectOrganization: {
        title: '多仓库分组与架构治理巡检',
        summary: '巡检单分组堆叠的大量仓库，由 Agent 辅助归类整理',
      },
      reviewPendingCommits: {
        title: '待推送提交与变更复核',
        summary: '巡检本地已就绪但未推送的提交与工作区改动，支持快速复核',
      },
    },
    organization: {
      bannerTitle: '智能项目分类与架构治理',
      bannerDesc: '由 Git Agent 深度分析各项目路径与 Remote，输出结构化分组方案',
      bannerAction: '使用 Agent 规划分组',
      prompt: '请帮我分析当前分组中堆叠的项目，并提供智能分组整理方案',
    },
    status: {
      safe: '可处理',
      warn: '需核查',
      bad: '需处理',
      dismissed: '已移除卡片',
      unverified: '待核查',
    },
    scope: {
      projects: '{count} 个项目',
      projectsWorktrees: '{projects} 个项目 · {worktrees} Worktrees',
      worktrees: '{count} 个工作树',
    },
    action: {
      back: '返回任务卡片',
      dismiss: '从工作台移除卡片',
      undoDismiss: '撤销',
      viewInGit: '在 Git 中查看',
      openCommit: '查看提交及分支关系',
      openDiff: '查看文件内容与 Diff',
      checkNow: '立即检查',
      refresh: '刷新',
      importRecipe: '导入检查方案',
      exportRecipe: '导出检查方案',
    },
    evidence: {
      title: '相关 Git 内容 (点击直接定位)',
      commit: '提交 {oid}',
      file: '文件 {path}',
      conclusion: '检查结论',
      noEvidence: '暂无可导航的 Git 证据',
      details: '详细信息',
      worktreePath: 'Worktree 目录: {path}',
      aheadBehind: '领先 {ahead} / 落后 {behind} 个提交',
    },
    agent: {
      prompt: '需要协助时，使用下方 Git Agent 药丸',
      badge: 'Git Agent',
      syncPlanConfirm: '批量快进计划已就绪，请核对待执行的项目列表',
    },
    import: {
      title: '导入同事的检查方案',
      subtitle: '便携检查配方 (Portable Check) 验证与本地匹配',
      matchedCount: '已匹配 {matched} / {total} 个项目',
      verifyMatched: '验证已匹配项目',
      pendingMatch: '待关联',
      matched: '已匹配',
      noMatchHint: '该仓库与分享的检查项目不匹配',
      invalidRecipe: '无效或损坏的检查方案载荷',
      selectDirectory: '选择检查目录',
      checkInProgress: '正在运行本地规则检查...',
    },
    lastChecked: '上次检查: {time}',
    justNow: '刚刚',
    minutesAgo: '{minutes} 分钟前',
  },
}
