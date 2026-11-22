/**
 * WorktreeParallelDetector: Evaluates parallel worktrees and stagnant feature branches.
 * Adheres to docs/technical/yggit-workdesk-architecture.md §4.3
 */

import type { GitLogView, GitProjectView } from '@/lib/git/types'
import { generateFindingFingerprint } from '@/lib/workdesk/fingerprint'
import type { Finding } from '@/lib/workdesk/types'

import { resolveDefaultBranch } from './branch-sync'

const ENGINE_VERSION = '1.0.0'
const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export interface WorktreeParallelDetectorContext {
  project: GitProjectView
  logView: GitLogView
}

/**
 * Execute WorktreeParallelDetector across worktrees and feature branches.
 */
export function detectWorktreeParallel(ctx: WorktreeParallelDetectorContext): Finding[] {
  const { project, logView } = ctx
  const findings: Finding[] = []
  const repoId = project.id || project.name
  const repoAlias = project.label || project.name
  const defaultBranch = resolveDefaultBranch(logView)
  const defaultBranchName = defaultBranch?.name || 'main'

  // 1. Check parallel worktrees (if more than 1 worktree exists)
  const worktrees = logView.worktrees || []
  if (worktrees.length > 1) {
    for (const wt of worktrees) {
      if (wt.current) continue // main repo worktree
      const fingerprint = generateFindingFingerprint({
        repoIdentity: repoId,
        kind: 'sync',
        ruleId: 'worktree-parallel',
        targetRef: wt.branch || wt.path,
      })

      findings.push({
        id: `finding_wt_${repoId}_${encodeURIComponent(wt.branch || wt.path)}`,
        fingerprint,
        repoId,
        repoAlias,
        kind: 'sync',
        source: 'git',
        severity: 'info',
        lifecycle: 'open',
        freshness: 'fresh',
        target: { name: wt.branch || wt.path, oid: wt.head },
        evidence: {
          paths: [wt.path],
          commits: wt.head ? [wt.head] : [],
          ruleId: 'worktree-parallel',
          details: {
            path: wt.path,
            branch: wt.branch,
            conclusion: `独立工作树正在开发 (${wt.branch || wt.path})`,
            stateKind: 'safe',
          },
        },
        observedAt: Date.now(),
        baseCommitOid: wt.head || '',
        engineVersion: ENGINE_VERSION,
      })
    }
  }

  // 2. Check active feature branches (ahead of default branch or stale)
  const branches = logView.branches || []
  const now = Date.now()

  for (const branch of branches) {
    if (branch.name === defaultBranchName) continue
    if (branch.name.startsWith('origin/') || branch.gone) continue

    const ahead = branch.ahead ?? 0
    const behind = branch.behind ?? 0
    const tip = branch.tip || ''

    // Find the latest commit on this branch to evaluate freshness
    const tipCommit = logView.commits?.find((c) => c.hash === tip)
    let isStale = false
    if (tipCommit && tipCommit.date) {
      const commitTime = new Date(tipCommit.date).getTime()
      if (!isNaN(commitTime) && now - commitTime > STALE_THRESHOLD_MS) {
        isStale = true
      }
    }

    if (ahead > 0 || behind > 0 || isStale) {
      const fingerprint = generateFindingFingerprint({
        repoIdentity: repoId,
        kind: 'sync',
        ruleId: 'feature-branch-health',
        targetRef: branch.name,
      })

      const stateKind = isStale ? 'warn' : ahead > 0 && behind > 0 ? 'bad' : 'safe'
      const conclusion = isStale ? `分支超过 14 天未活动 (领先 ${ahead} / 落后 ${behind})` : `特性分支领先 ${ahead} / 落后 ${behind} 个提交`

      findings.push({
        id: `finding_feature_${repoId}_${encodeURIComponent(branch.name)}`,
        fingerprint,
        repoId,
        repoAlias,
        kind: 'sync',
        source: 'git',
        severity: isStale ? 'warning' : 'info',
        lifecycle: 'open',
        freshness: 'fresh',
        target: { name: branch.name, oid: tip },
        evidence: {
          commits: tip ? [tip] : [],
          ruleId: 'feature-branch-health',
          details: {
            branch: branch.name,
            ahead,
            behind,
            isStale,
            conclusion,
            stateKind,
          },
        },
        observedAt: now,
        baseCommitOid: tip,
        engineVersion: ENGINE_VERSION,
      })
    }
  }

  return findings
}
