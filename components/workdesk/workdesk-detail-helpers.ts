import type { MessageKey } from '@/lib/i18n'
import type { WorkItem } from '@/lib/workdesk/types'

export type CrAnalysisResult = {
  cause: string
  risk: string
  suggestion: string
  solution: string
}

export function getCrAnalysis(cardId: string, _item: WorkItem, locale = 'zh'): CrAnalysisResult {
  const isEn = locale.startsWith('en')

  if (cardId === 'merge-diverged-branches' || cardId.includes('merge') || cardId.includes('diverged')) {
    return isEn
      ? {
          cause: 'Local branch has unpushed commits while remote branch has advanced with changes from others, diverging from different baselines.',
          risk: 'Direct force-pushing risks losing others commits; delaying integration increases differences and conflict scope, making future rebasing harder.',
          suggestion: 'Fetch remote changes and rebase (git rebase) or merge (git merge), resolve any conflicts, and push after verification.',
          solution:
            '1. Fetch remote tracking branch: git fetch origin\n2. Rebase to maintain linear history: git rebase origin/<targetBranch> (resolve conflicts if any, then git rebase --continue)\n3. Verify builds and tests locally before pushing to remote.',
        }
      : {
          cause: '本地分支存在未推送的提交，同时远端主分支已被他人合并推进，导致两端基于不同的提交基线产生了分叉。',
          risk: '若直接强制推送会导致远端他人提交丢失；若长期搁置不合流，代码差异与潜在冲突面积将持续扩大，增加后续合并回归难度。',
          suggestion: '建议拉取远端最新提交后执行变基 (git rebase) 或合并 (git merge)，解决潜在冲突并在验证通过后推送到远端。',
          solution:
            '1. 拉取远端主干最新变更：git fetch origin\n2. 推荐执行变基合流以保持提交历史线性整洁：git rebase origin/<targetBranch>（若存在冲突则比对解决后执行 git rebase --continue）\n3. 本地构建与验证通过后推送到远端仓库。',
        }
  }

  if (cardId === 'sync-default-branches' || cardId.includes('sync')) {
    return isEn
      ? {
          cause: 'Remote default branch has new features or hotfixes merged by team members, while local default branch is currently behind.',
          risk: 'Branching off an outdated base may develop against obsolete code, leading to unnecessary baseline conflicts when creating PRs.',
          suggestion: 'Run a safe fast-forward pull (git pull --ff-only) on the default branch to sync to the latest state.',
          solution:
            '1. Ensure clean working directory (no uncommitted changes)\n2. Switch to default branch and pull: git pull --ff-only\n3. If non-fast-forward local changes exist, isolate them into a feature branch first.',
        }
      : {
          cause: '远端默认分支已有团队新功能或热修复代码合并入库，本地默认分支当前落后于远端。',
          risk: '在陈旧的主分支基线上切出新分支开发，可能导致基于已废弃代码开发，后续提 PR 时会产生不必要的大量基线冲突。',
          suggestion: '建议在当前默认分支上执行安全快进拉取 (git pull --ff-only) 同步至最新状态。',
          solution: '1. 确认本地工作目录干净（无未提交的改动）\n2. 切换至默认分支执行安全快进拉取：git pull --ff-only\n3. 若存在不可快进的本地私有改动，创建特性分支隔离后再拉取。',
        }
  }

  if (cardId === 'worktree-parallel-dev' || cardId.includes('worktree')) {
    return isEn
      ? {
          cause: 'Separate worktrees previously established for parallel feature development or urgent hotfixes have not been unregistered after completion.',
          risk: 'Multiple worktrees consume disk space and hold internal Git branch locks; remaining idle makes it easy to accidentally modify code in outdated directories.',
          suggestion: 'Inspect delivery status of worktrees; if merged and released, remove them promptly to keep the workspace clean.',
          solution:
            '1. Inspect development progress and untracked files in worktrees\n2. Remove delivered worktrees: git worktree remove <path>\n3. Run git worktree prune to clear stale metadata references.',
        }
      : {
          cause: '先前为并行处理多需求或紧急补丁建立了独立 Worktree 工作树，在任务结束后未被及时注销或收拢。',
          risk: '多工作树持续占用磁盘空间与 Git 内部分支锁；长时间闲置容易导致在过期工作目录中误改代码或误提变更。',
          suggestion: '建议检查各个独立工作树的代码交付状态，若已合并上线请及时注销移除，保持工作区干净清爽。',
          solution:
            '1. 检查各个独立 Worktree 目录中的开发进度与未提交文件\n2. 对已完成交付的 Worktree 执行移除清理：git worktree remove <path>\n3. 运行 git worktree prune 清除失效的元数据引用。',
        }
  }

  if (cardId === 'standard-project-organization' || cardId.includes('organization')) {
    return isEn
      ? {
          cause: 'Too many repositories accumulated in a single flat group or root directory, lacking layered categorization by business domain or SDK.',
          risk: 'High search cost during multi-repo collaboration; lack of clear boundaries when updating or inspecting projects.',
          suggestion: 'Use Yggi to smartly group and organize repositories by application architecture.',
          solution: '1. Organize repository domains (core backend, web frontend, shared SDK, devops)\n2. Plan group hierarchy and categorize in Workdesk settings.',
        }
      : {
          cause: '单一分组或根目录下累积了过多仓库，缺乏按业务域、微服务或 SDK 的分层分类。',
          risk: '团队多仓库并行协作时检索成本高，批量更新或检查时缺乏清晰边界，容易引发误操作或权限混乱。',
          suggestion: '建议使用 Yggi 按业务模块或应用形态进行智能分类分组治理。',
          solution: '1. 梳理当前分组中的仓库业务域（如核心后端、Web 前端、公用 SDK、运维脚本）\n2. 规划子分组层级并在工作台设置中执行批量归类整理。',
        }
  }

  if (cardId === 'standard-repo-hygiene' || cardId.includes('hygiene') || cardId.includes('standard')) {
    return isEn
      ? {
          cause: 'Current branch name does not adhere to conventional prefix formats (such as missing feature/, bugfix/, hotfix/).',
          risk: 'Non-standard branch naming creates collaboration confusion and prevents CI/CD pipelines from accurately discerning change intent.',
          suggestion: 'Rename the branch following semantic conventions (e.g., feature/<branch-name> or fix/<issue-name>).',
          solution:
            '1. Clarify branch responsibility and choose standard naming\n2. Rename local branch: git branch -m <oldBranch> feature/<new-name>\n3. Push new branch to remote and set tracking, removing obsolete remote branch.',
        }
      : {
          cause: '当前分支命名未遵循约定的规范格式（如缺少 feature/、bugfix/、hotfix/ 等语义前缀）。',
          risk: '非标准命名会导致团队协作混乱或 CI/CD 自动化流水线无法精确识别变更意图，增加代码审计与维护成本。',
          suggestion: '建议按照标准语义分支规范将分支重命名（例如 feature/<branch-name> 或 fix/<issue-name>）。',
          solution:
            '1. 明确分支职责并确定标准命名（例如 feature/<name> 或 bugfix/<name>）\n2. 重命名本地分支：git branch -m <oldBranch> feature/<new-name>\n3. 推送规范命名分支至远端并建立跟踪，清理废弃的旧分支。',
        }
  }

  if (cardId === 'code-review-pending-push' || cardId.includes('review') || cardId.includes('push')) {
    return isEn
      ? {
          cause: 'Local commits or staged changes exist but have not been pushed to the remote repository.',
          risk: 'Unpushed code only exists on local disk with single-point failure risk; collaborators cannot see current progress.',
          suggestion: 'Review commit log and file diffs, then push to corresponding remote branch when ready.',
          solution:
            '1. Review local unpushed commits: git log origin/<branch>..HEAD\n2. Check staged and unstaged changes for debug code or secrets\n3. Push to remote: git push origin <branch>.',
        }
      : {
          cause: '本地已生成新提交或存在已暂存变更，但尚未同步推送至远端托管平台。',
          risk: '未推送的代码仅存在于本地机器，存在单点丢失风险；其他协作者无法感知你当前的开发进展，可能引发重复开发。',
          suggestion: '建议复核改动提交记录与文件差异，确认无误后及时推送到对应远端分支。',
          solution:
            '1. 复核本地未推送的提交记录：git log origin/<branch>..HEAD\n2. 检查暂存区与未暂存改动，确保敏感信息或临时调试代码已剔除\n3. 验证通过后推送到远端：git push origin <branch>。',
        }
  }

  return isEn
    ? {
        cause: 'Deviations from standard collaborative workflows detected in local workspace or branch state.',
        risk: 'Unresolved issues may block subsequent integration builds or team collaboration.',
        suggestion: 'Refer to inspection results to review and sync or merge accordingly.',
        solution: 'Fetch remote state, inspect differences, and execute merge or standards alignment.',
      }
    : {
        cause: '检测到本地工作区或分支状态与预期的协同规范存在偏差。',
        risk: '未及时处理可能在后续集成构建或团队协作时产生阻碍。',
        suggestion: '请参考检查结论进行复核并执行相应同步或合流操作。',
        solution: '拉取远端状态，核对差异并执行合流或规范调整。',
      }
}

export function localizeWorkdeskSummary(summary: string, t: (key: MessageKey, params?: Record<string, string | number>) => string): string {
  const s = summary.trim()
  if (!s) return s

  if (s.startsWith('分支命名未遵循规范')) {
    return t('workdesk.findings.branchNaming' as MessageKey)
  }
  if (s === '已与远程保持同步') return t('workdesk.findings.syncUpToDate' as MessageKey)
  if (s.startsWith('待核查（缺少远程跟踪分支')) return t('workdesk.findings.syncUnverified' as MessageKey)
  if (s.startsWith('本地与远程分叉')) return t('workdesk.findings.syncDiverged' as MessageKey)
  if (s === '本地工作区有未提交变更') return t('workdesk.findings.dirtyWorkspace' as MessageKey)
  if (s.startsWith('分支已被其他活动 Worktree 检出')) return t('workdesk.findings.checkedOutElsewhere' as MessageKey)
  if (s.startsWith('远程领先，可安全快进')) return t('workdesk.findings.remoteAhead' as MessageKey)
  if (s.startsWith('本地领先，包含未推送提交')) return t('workdesk.findings.localAhead' as MessageKey)
  if (s === '并行开发进行中') return t('workdesk.findings.parallelInProgress' as MessageKey)
  if (s.startsWith('本地分支与远端分叉')) return t('workdesk.findings.mergeDivergedFallback' as MessageKey)
  if (s === '未遵循团队研发规范') return t('workdesk.findings.standardFallback' as MessageKey)
  if (s === '待复核的提交或工作区改动') return t('workdesk.findings.reviewFallback' as MessageKey)

  const commitConvMatch = s.match(/^未推送提交不符合 Conventional Commits 规范 \("(.+)"\)$/)
  if (commitConvMatch) {
    return t('workdesk.findings.commitConvention' as MessageKey, { subject: commitConvMatch[1] })
  }

  const mergeDivMatch = s.match(/^本地与远端分支分叉 \(领先 (\d+) \/ 落后 (\d+)\)/)
  if (mergeDivMatch) {
    return t('workdesk.findings.mergeDiverged' as MessageKey, { ahead: mergeDivMatch[1], behind: mergeDivMatch[2] })
  }

  const pendingMatch = s.match(/^包含 (\d+) 个待推送提交/)
  if (pendingMatch) {
    return t('workdesk.findings.pendingCommits' as MessageKey, { count: pendingMatch[1] })
  }

  const uncommittedMatch = s.match(/^工作区有 (\d+) 个未提交修改 \(\+(\d+) \/ -(\d+)\)/)
  if (uncommittedMatch) {
    return t('workdesk.findings.uncommittedChanges' as MessageKey, {
      files: uncommittedMatch[1],
      ins: uncommittedMatch[2],
      del: uncommittedMatch[3],
    })
  }

  const worktreeMatch = s.match(/^独立工作树正在开发 \((.+)\)$/)
  if (worktreeMatch) {
    return t('workdesk.findings.activeWorktree' as MessageKey, { target: worktreeMatch[1] })
  }

  const staleMatch = s.match(/^分支超过 14 天未活动 \(领先 (\d+) \/ 落后 (\d+)\)$/)
  if (staleMatch) {
    return t('workdesk.findings.staleBranch' as MessageKey, { ahead: staleMatch[1], behind: staleMatch[2] })
  }

  const featureMatch = s.match(/^特性分支领先 (\d+) \/ 落后 (\d+) 个提交$/)
  if (featureMatch) {
    return t('workdesk.findings.featureBranchDelta' as MessageKey, { ahead: featureMatch[1], behind: featureMatch[2] })
  }

  const bloatedDetailMatch = s.match(/^分组「(.+)」堆叠了 (\d+) 个项目，且涵盖 (\d+) 个不同物理目录前缀/)
  if (bloatedDetailMatch) {
    return t('workdesk.findings.bloatedGroupDetail' as MessageKey, {
      group: bloatedDetailMatch[1],
      projects: bloatedDetailMatch[2],
      roots: bloatedDetailMatch[3],
    })
  }

  const bloatedMatch = s.match(/^分组包含 (\d+) 个项目/)
  if (bloatedMatch) {
    return t('workdesk.findings.bloatedGroup' as MessageKey, { count: bloatedMatch[1] })
  }

  return summary
}

export function getItemCardSummary(summary: string, t?: (key: MessageKey, params?: Record<string, string | number>) => string): string {
  const localized = t ? localizeWorkdeskSummary(summary, t) : summary
  const aheadBehindMatch = localized.match(/((?:领先|ahead)\s*\d+\s*(?:\/|\band\b)?\s*(?:落后|behind)\s*\d+|\d+\s*ahead\s*\/\s*\d+\s*behind)/i)
  if (aheadBehindMatch) {
    return aheadBehindMatch[1]
  }
  const aheadMatch = localized.match(/((?:领先|ahead)\s*\d+|\d+\s*ahead)/i)
  if (aheadMatch) {
    return aheadMatch[1]
  }
  const behindMatch = localized.match(/((?:落后|behind)\s*\d+|\d+\s*behind)/i)
  if (behindMatch) {
    return behindMatch[1]
  }
  const firstClause = localized.split(/[，,。；;]/)[0]?.trim()
  return firstClause || localized
}

export function getItemProblemTitle(cardId: string, item: WorkItem, t: (key: MessageKey) => string): string {
  if (cardId === 'merge-diverged-branches' || cardId.includes('merge')) {
    return t('workdesk.problemTitles.merge' as MessageKey)
  }
  if (cardId === 'sync-default-branches' || cardId.includes('sync')) {
    return t('workdesk.problemTitles.sync' as MessageKey)
  }
  if (cardId === 'worktree-parallel-dev' || cardId.includes('worktree')) {
    return t('workdesk.problemTitles.worktree' as MessageKey)
  }
  if (cardId === 'standard-project-organization' || cardId.includes('organization')) {
    return t('workdesk.problemTitles.organization' as MessageKey)
  }
  if (cardId === 'standard-repo-hygiene' || cardId.includes('hygiene') || cardId.includes('standard')) {
    return t('workdesk.problemTitles.standard' as MessageKey)
  }
  if (cardId === 'code-review-pending-push' || cardId.includes('review') || cardId.includes('push')) {
    return t('workdesk.problemTitles.review' as MessageKey)
  }
  const firstClause = item.summary.split(/[，,。；;]/)[0]?.trim()
  return firstClause || t('workdesk.problemTitles.default' as MessageKey)
}
