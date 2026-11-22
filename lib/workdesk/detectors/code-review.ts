/**
 * CodeReviewDetector: Evaluates unpushed commits and uncommitted worktree changes.
 * Adheres to docs/technical/yggit-workdesk-architecture.md §4.4
 */

import type { GitLogView, GitProjectView } from '@/lib/git/types'
import { generateFindingFingerprint } from '@/lib/workdesk/fingerprint'
import type { Finding } from '@/lib/workdesk/types'

const ENGINE_VERSION = '1.0.0'

export interface CodeReviewDetectorContext {
  project: GitProjectView
  logView: GitLogView
}

/**
 * Execute CodeReviewDetector across repository branches and working tree.
 */
export function detectCodeReview(ctx: CodeReviewDetectorContext): Finding[] {
  const { project, logView } = ctx
  const findings: Finding[] = []
  const repoId = project.id || project.name
  const repoAlias = project.label || project.name
  const branches = logView.branches || []
  const now = Date.now()

  // 1. Unpushed commits ready for review / verification
  for (const branch of branches) {
    if (branch.name.startsWith('origin/') || branch.gone) continue
    const ahead = branch.ahead ?? 0
    if (ahead > 0) {
      const tip = branch.tip || ''
      const fingerprint = generateFindingFingerprint({
        repoIdentity: repoId,
        kind: 'review',
        ruleId: 'review-pending-commits',
        targetRef: branch.name,
      })

      findings.push({
        id: `finding_review_unpushed_${repoId}_${encodeURIComponent(branch.name)}`,
        fingerprint,
        repoId,
        repoAlias,
        kind: 'review',
        source: 'git',
        severity: 'info',
        lifecycle: 'open',
        freshness: 'fresh',
        target: { name: branch.name, oid: tip },
        scenarioId: 'code-review-unpushed',
        evidence: {
          commits: tip ? [tip] : [],
          paths: [],
          ruleId: 'review-pending-commits',
          details: {
            branch: branch.name,
            ahead,
            conclusion: `包含 ${ahead} 个待推送提交，建议在推送或合流前复核`,
            stateKind: 'safe',
          },
        },
        observedAt: now,
        baseCommitOid: tip,
        engineVersion: ENGINE_VERSION,
      })
    }
  }

  // 2. Uncommitted worktree changes requiring inspection
  if (logView.worktree && (logView.worktree.files ?? 0) > 0) {
    const wt = logView.worktree
    const currentBranchName = logView.branch || logView.head || 'working-tree'
    const fingerprint = generateFindingFingerprint({
      repoIdentity: repoId,
      kind: 'review',
      ruleId: 'review-worktree-changes',
      targetRef: currentBranchName,
    })

    const headCommit = logView.commits?.[0]?.hash || ''

    findings.push({
      id: `finding_review_worktree_${repoId}`,
      fingerprint,
      repoId,
      repoAlias,
      kind: 'review',
      source: 'git',
      severity: (wt.files ?? 0) > 10 ? 'warning' : 'info',
      lifecycle: 'open',
      freshness: 'fresh',
      target: { name: currentBranchName, oid: headCommit },
      scenarioId: 'code-review-worktree',
      evidence: {
        commits: headCommit ? [headCommit] : [],
        paths: [],
        ruleId: 'review-worktree-changes',
        details: {
          files: wt.files,
          insertions: wt.insertions,
          deletions: wt.deletions,
          conclusion: `工作区有 ${wt.files} 个未提交修改 (+${wt.insertions ?? 0} / -${wt.deletions ?? 0})，建议自查后提交`,
          stateKind: 'warn',
        },
      },
      observedAt: now,
      baseCommitOid: headCommit,
      engineVersion: ENGINE_VERSION,
    })
  }

  return findings
}
