/**
 * Deterministic clustering algorithm mapping Finding[] to WorkCard[] and WorkItem[].
 * Adheres to docs/technical/yggit-workdesk-architecture.md §4.5
 */

import type { Finding, WorkCard, WorkItem } from '@/lib/workdesk/types'

export interface ClusterResult {
  cards: WorkCard[]
  items: Record<string, WorkItem>
}

/**
 * Cluster raw findings into user-facing actionable cards across the 4 lanes:
 * - branch: 分支维护
 * - merge: 合并集成
 * - standard: 研发规范
 * - review: 代码审查
 */
export function clusterFindingsToCards(findings: Finding[], inMemoryDismissedIds?: Set<string>): ClusterResult {
  const items: Record<string, WorkItem> = {}
  const cards: WorkCard[] = []

  // Filter open findings
  const openFindings = findings.filter((f) => f.lifecycle === 'open')

  // --- Group 1: Default Branch Sync (Lane: branch) ---
  const syncFindings = openFindings.filter((f) => f.evidence?.ruleId === 'default-branch-sync')
  if (syncFindings.length > 0) {
    const cardId = 'sync-default-branches'
    const itemIds: string[] = []
    const projectSet = new Set<string>()

    for (const finding of syncFindings) {
      const itemId = `item_sync_${finding.repoId}_${encodeURIComponent(finding.target?.name || 'default')}`
      itemIds.push(itemId)
      projectSet.add(finding.repoId)

      const stateKind = (finding.evidence?.details?.stateKind as 'safe' | 'warn' | 'bad') || 'safe'
      const conclusion = (finding.evidence?.details?.conclusion as string) || '远程领先，可安全快进'

      items[itemId] = {
        id: itemId,
        cardId,
        repoId: finding.repoId,
        repoAlias: finding.repoAlias,
        name: finding.target?.name || 'main',
        summary: conclusion,
        state: stateKind,
        findingIds: [finding.id],
        commit: finding.evidence?.commits?.[0],
        paths: finding.evidence?.paths,
      }
    }

    cards.push({
      id: cardId,
      groupKey: 'sync:default-branches',
      title: '同步默认分支',
      summary: '检查各项目默认分支与远端的同步状态，识别可安全快进的项目',
      scope: `${projectSet.size} 个项目`,
      iconName: 'LuRefreshCw',
      categoryId: 'branch',
      categorySource: 'rule',
      state: 'prepared',
      itemIds,
      hidden: inMemoryDismissedIds?.has(cardId) ?? false,
      createdAt: Math.min(...syncFindings.map((f) => f.observedAt)),
      updatedAt: Math.max(...syncFindings.map((f) => f.observedAt)),
    })
  }

  // --- Group 2: Worktree & Parallel Development (Lane: branch) ---
  const parallelFindings = openFindings.filter((f) => f.evidence?.ruleId === 'worktree-parallel' || f.evidence?.ruleId === 'feature-branch-health')
  if (parallelFindings.length > 0) {
    const cardId = 'worktree-parallel-dev'
    const itemIds: string[] = []
    const projectSet = new Set<string>()
    let worktreeCount = 0

    for (const finding of parallelFindings) {
      const isWt = finding.evidence?.ruleId === 'worktree-parallel'
      if (isWt) worktreeCount++
      const itemId = `item_parallel_${finding.id}`
      itemIds.push(itemId)
      projectSet.add(finding.repoId)

      const stateKind = (finding.evidence?.details?.stateKind as 'safe' | 'warn' | 'bad') || 'safe'
      const conclusion = (finding.evidence?.details?.conclusion as string) || '并行开发进行中'
      const itemName = (finding.evidence?.details?.branch as string) || finding.target?.name || 'feature'

      items[itemId] = {
        id: itemId,
        cardId,
        repoId: finding.repoId,
        repoAlias: finding.repoAlias,
        name: itemName,
        summary: conclusion,
        state: stateKind,
        findingIds: [finding.id],
        commit: finding.evidence?.commits?.[0],
        paths: finding.evidence?.paths,
      }
    }

    const scope = worktreeCount > 0 ? `${projectSet.size} 个项目 · ${worktreeCount} Worktrees` : `${projectSet.size} 个项目`

    cards.push({
      id: cardId,
      groupKey: 'worktree:parallel-dev',
      title: '检查并行开发工作',
      summary: '巡检各项目的独立 Worktree 与特性分支健康度',
      scope,
      iconName: 'LuGitFork',
      categoryId: 'branch',
      categorySource: 'rule',
      state: 'prepared',
      itemIds,
      hidden: inMemoryDismissedIds?.has(cardId) ?? false,
      createdAt: Math.min(...parallelFindings.map((f) => f.observedAt)),
      updatedAt: Math.max(...parallelFindings.map((f) => f.observedAt)),
    })
  }

  // --- Group 3: Merge & Diverged Branches (Lane: merge) ---
  const mergeFindings = openFindings.filter((f) => f.kind === 'merge')
  if (mergeFindings.length > 0) {
    const cardId = 'merge-diverged-branches'
    const itemIds: string[] = []
    const projectSet = new Set<string>()

    for (const finding of mergeFindings) {
      const itemId = `item_merge_${finding.id}`
      itemIds.push(itemId)
      projectSet.add(finding.repoId)

      const stateKind = (finding.evidence?.details?.stateKind as 'safe' | 'warn' | 'bad') || 'warn'
      const conclusion = (finding.evidence?.details?.conclusion as string) || '本地分支与远端分叉，需合并或变基'

      items[itemId] = {
        id: itemId,
        cardId,
        repoId: finding.repoId,
        repoAlias: finding.repoAlias,
        name: finding.target?.name || 'diverged',
        summary: conclusion,
        state: stateKind,
        findingIds: [finding.id],
        commit: finding.evidence?.commits?.[0],
        paths: finding.evidence?.paths,
      }
    }

    cards.push({
      id: cardId,
      groupKey: 'merge:diverged-branches',
      title: '核对分叉与待合并分支',
      summary: '检测本地与远端分叉或存在潜在冲突的分支，指引合并或变基',
      scope: `${projectSet.size} 个项目`,
      iconName: 'LuGitMerge',
      categoryId: 'merge',
      categorySource: 'rule',
      state: 'prepared',
      itemIds,
      hidden: inMemoryDismissedIds?.has(cardId) ?? false,
      createdAt: Math.min(...mergeFindings.map((f) => f.observedAt)),
      updatedAt: Math.max(...mergeFindings.map((f) => f.observedAt)),
    })
  }

  // --- Group 4: Engineering Standards & Branch Hygiene (Lane: standard) ---
  const standardFindings = openFindings.filter((f) => f.kind === 'custom' && (f.evidence?.ruleId === 'standard-branch-naming' || f.evidence?.ruleId === 'standard-commit-message'))
  if (standardFindings.length > 0) {
    const cardId = 'standard-repo-hygiene'
    const itemIds: string[] = []
    const projectSet = new Set<string>()

    for (const finding of standardFindings) {
      const itemId = `item_standard_${finding.id}`
      itemIds.push(itemId)
      projectSet.add(finding.repoId)

      const stateKind = (finding.evidence?.details?.stateKind as 'safe' | 'warn' | 'bad') || 'warn'
      const conclusion = (finding.evidence?.details?.conclusion as string) || '未遵循团队研发规范'

      items[itemId] = {
        id: itemId,
        cardId,
        repoId: finding.repoId,
        repoAlias: finding.repoAlias,
        name: finding.target?.name || 'standard',
        summary: conclusion,
        state: stateKind,
        findingIds: [finding.id],
        commit: finding.evidence?.commits?.[0],
        paths: finding.evidence?.paths,
      }
    }

    cards.push({
      id: cardId,
      groupKey: 'standard:repo-hygiene',
      title: '研发规范与分支命名巡检',
      summary: '巡检未遵循团队约定的分支命名及规范校验',
      scope: `${projectSet.size} 个项目`,
      iconName: 'LuFlag',
      categoryId: 'standard',
      categorySource: 'rule',
      state: 'prepared',
      itemIds,
      hidden: inMemoryDismissedIds?.has(cardId) ?? false,
      createdAt: Math.min(...standardFindings.map((f) => f.observedAt)),
      updatedAt: Math.max(...standardFindings.map((f) => f.observedAt)),
    })
  }

  // --- Group 5: Code Review & Pending Changes (Lane: review) ---
  const reviewFindings = openFindings.filter((f) => f.kind === 'review')
  if (reviewFindings.length > 0) {
    const cardId = 'review-pending-commits'
    const itemIds: string[] = []
    const projectSet = new Set<string>()

    for (const finding of reviewFindings) {
      const itemId = `item_review_${finding.id}`
      itemIds.push(itemId)
      projectSet.add(finding.repoId)

      const stateKind = (finding.evidence?.details?.stateKind as 'safe' | 'warn' | 'bad') || 'safe'
      const conclusion = (finding.evidence?.details?.conclusion as string) || '待复核的提交或工作区改动'

      items[itemId] = {
        id: itemId,
        cardId,
        repoId: finding.repoId,
        repoAlias: finding.repoAlias,
        name: finding.target?.name || 'review',
        summary: conclusion,
        state: stateKind,
        findingIds: [finding.id],
        commit: finding.evidence?.commits?.[0],
        paths: finding.evidence?.paths,
      }
    }

    cards.push({
      id: cardId,
      groupKey: 'review:code-review-pending',
      title: '待推送提交与变更复核',
      summary: '巡检本地已就绪但未推送的提交与工作区改动，支持快速复核',
      scope: `${projectSet.size} 个项目`,
      iconName: 'LuCircleCheck',
      categoryId: 'review',
      categorySource: 'rule',
      state: 'prepared',
      itemIds,
      hidden: inMemoryDismissedIds?.has(cardId) ?? false,
      createdAt: Math.min(...reviewFindings.map((f) => f.observedAt)),
      updatedAt: Math.max(...reviewFindings.map((f) => f.observedAt)),
    })
  }

  return { cards, items }
}
