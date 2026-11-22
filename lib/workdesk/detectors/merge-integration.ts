/**
 * MergeIntegrationDetector: Evaluates branch divergence and integration compatibility.
 * Adheres to docs/technical/yggit-workdesk-architecture.md §4.2
 */

import type { GitLogView, GitProjectView } from '@/lib/git/types'
import { generateFindingFingerprint } from '@/lib/workdesk/fingerprint'
import type { Finding } from '@/lib/workdesk/types'

const ENGINE_VERSION = '1.0.0'

export interface MergeIntegrationDetectorContext {
  project: GitProjectView
  logView: GitLogView
}

/**
 * Execute MergeIntegrationDetector across repository branches.
 */
export function detectMergeIntegration(ctx: MergeIntegrationDetectorContext): Finding[] {
  const { project, logView } = ctx
  const findings: Finding[] = []
  const repoId = project.id || project.name
  const repoAlias = project.label || project.name
  const branches = logView.branches || []
  const now = Date.now()

  // 1. Detect diverged branches requiring merge or rebase (ahead > 0 && behind > 0)
  for (const branch of branches) {
    if (branch.name.startsWith('origin/') || branch.gone) continue
    const ahead = branch.ahead ?? 0
    const behind = branch.behind ?? 0
    const tip = branch.tip || ''
    const upstream = branch.upstream || ''

    if (ahead > 0 && behind > 0) {
      const fingerprint = generateFindingFingerprint({
        repoIdentity: repoId,
        kind: 'merge',
        ruleId: 'merge-diverged-branch',
        targetRef: branch.name,
        sources: upstream ? [upstream] : [],
      })

      const commits: string[] = []
      if (tip) commits.push(tip)

      findings.push({
        id: `finding_merge_diverged_${repoId}_${encodeURIComponent(branch.name)}`,
        fingerprint,
        repoId,
        repoAlias,
        kind: 'merge',
        source: 'git',
        severity: 'warning',
        lifecycle: 'open',
        freshness: 'fresh',
        target: { name: branch.name, oid: tip },
        sources: upstream ? [{ name: upstream }] : [],
        scenarioId: 'merge-divergence',
        evidence: {
          commits,
          paths: [],
          ruleId: 'merge-diverged-branch',
          details: {
            branch: branch.name,
            ahead,
            behind,
            upstream,
            conclusion: `本地与远端分支分叉 (领先 ${ahead} / 落后 ${behind})，需合流或变基`,
            stateKind: 'bad',
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
