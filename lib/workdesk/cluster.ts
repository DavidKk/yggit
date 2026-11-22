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

  // --- Group 1: Default Branch Sync (sync:default-branches) ---
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

    const scope = `${projectSet.size} 个项目`
    const isDismissed = inMemoryDismissedIds?.has(cardId) ?? false

    cards.push({
      id: cardId,
      groupKey: 'sync:default-branches',
      title: '同步默认分支',
      summary: '检查各项目默认分支与远端的同步状态，识别可安全快进的项目',
      scope,
      iconName: 'LuRefreshCw',
      categoryId: 'branch',
      categorySource: 'rule',
      state: 'prepared',
      itemIds,
      hidden: isDismissed,
      createdAt: Math.min(...syncFindings.map((f) => f.observedAt)),
      updatedAt: Math.max(...syncFindings.map((f) => f.observedAt)),
    })
  }

  // --- Group 2: Worktree & Parallel Development (worktree:parallel-dev) ---
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
    const isDismissed = inMemoryDismissedIds?.has(cardId) ?? false

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
      hidden: isDismissed,
      createdAt: Math.min(...parallelFindings.map((f) => f.observedAt)),
      updatedAt: Math.max(...parallelFindings.map((f) => f.observedAt)),
    })
  }

  // --- Group 3: Merge Scenario (if any findings) ---
  const mergeFindings = openFindings.filter((f) => f.kind === 'merge')
  if (mergeFindings.length > 0) {
    const cardId = 'merge-integration-preflight'
    const itemIds: string[] = []
    const projectSet = new Set<string>()

    for (const finding of mergeFindings) {
      const itemId = `item_merge_${finding.id}`
      itemIds.push(itemId)
      projectSet.add(finding.repoId)

      items[itemId] = {
        id: itemId,
        cardId,
        repoId: finding.repoId,
        repoAlias: finding.repoAlias,
        name: finding.target?.name || 'merge-preflight',
        summary: (finding.evidence?.details?.conclusion as string) || '跨分支合并预检',
        state: finding.severity === 'blocking' ? 'bad' : 'warn',
        findingIds: [finding.id],
        commit: finding.evidence?.commits?.[0],
        paths: finding.evidence?.paths,
      }
    }

    const isDismissed = inMemoryDismissedIds?.has(cardId) ?? false
    cards.push({
      id: cardId,
      groupKey: 'merge:integration-preflight',
      title: '跨分支合并预演核对',
      summary: '验证候选集成变更与目标分支的兼容性',
      scope: `${projectSet.size} 个项目`,
      iconName: 'LuGitMerge',
      categoryId: 'merge',
      categorySource: 'rule',
      state: 'prepared',
      itemIds,
      hidden: isDismissed,
      createdAt: Math.min(...mergeFindings.map((f) => f.observedAt)),
      updatedAt: Math.max(...mergeFindings.map((f) => f.observedAt)),
    })
  }

  return { cards, items }
}
