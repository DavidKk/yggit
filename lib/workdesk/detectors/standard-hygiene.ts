/**
 * StandardHygieneDetector: Evaluates branch naming standards and commit conventions.
 * Adheres to docs/technical/yggit-workdesk-architecture.md §4.4
 */

import type { GitLogView, GitProjectView } from '@/lib/git/types'
import { generateFindingFingerprint } from '@/lib/workdesk/fingerprint'
import type { Finding } from '@/lib/workdesk/types'

const ENGINE_VERSION = '1.0.0'

// Recognized standard branch prefixes and primary branches
const STANDARD_BRANCH_PATTERN =
  /^(main|master|develop|dev|test(\/.*)?|staging|uat|prod|release(\/.*)?|hotfix\/.*|fix\/.*|feat\/.*|feature\/.*|chore\/.*|refactor\/.*|docs\/.*|merge\/.*|local\/.*|build\/.*|ci\/.*|perf\/.*)$/i

// Conventional commits subject pattern (e.g., feat: ..., fix(scope): ...)
const CONVENTIONAL_COMMIT_PATTERN = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9_\-./]+\))?!?: .+/i

export interface StandardHygieneDetectorContext {
  project: GitProjectView
  logView: GitLogView
}

/**
 * Execute StandardHygieneDetector across repository branches and commits.
 */
export function detectStandardHygiene(ctx: StandardHygieneDetectorContext): Finding[] {
  const { project, logView } = ctx
  const findings: Finding[] = []
  const repoId = project.id || project.name
  const repoAlias = project.label || project.name
  const branches = logView.branches || []
  const now = Date.now()

  // 1. Branch naming standard violation
  for (const branch of branches) {
    if (branch.name.startsWith('origin/') || branch.gone) continue
    if (!STANDARD_BRANCH_PATTERN.test(branch.name)) {
      const tip = branch.tip || ''
      const fingerprint = generateFindingFingerprint({
        repoIdentity: repoId,
        kind: 'custom',
        ruleId: 'standard-branch-naming',
        targetRef: branch.name,
      })

      findings.push({
        id: `finding_standard_branch_${repoId}_${encodeURIComponent(branch.name)}`,
        fingerprint,
        repoId,
        repoAlias,
        kind: 'custom',
        source: 'rule',
        severity: 'info',
        lifecycle: 'open',
        freshness: 'fresh',
        target: { name: branch.name, oid: tip },
        scenarioId: 'standard-naming',
        evidence: {
          commits: tip ? [tip] : [],
          paths: [],
          ruleId: 'standard-branch-naming',
          details: {
            branch: branch.name,
            conclusion: '分支命名未遵循规范 (建议使用 feat/, fix/, chore/ 等前缀)',
            stateKind: 'warn',
          },
        },
        observedAt: now,
        baseCommitOid: tip,
        engineVersion: ENGINE_VERSION,
      })
    }
  }

  // 2. Commit message convention check on unpushed commits of current branch
  const currentBranch = branches.find((b) => b.current)
  if (currentBranch && (currentBranch.ahead ?? 0) > 0 && logView.commits && logView.commits.length > 0) {
    const unpushedCount = Math.min(currentBranch.ahead ?? 0, 5)
    const recentCommits = logView.commits.slice(0, unpushedCount)
    const nonCompliantCommits = recentCommits.filter((c) => !CONVENTIONAL_COMMIT_PATTERN.test(c.subject || ''))

    if (nonCompliantCommits.length > 0) {
      const topCommit = nonCompliantCommits[0]
      const fingerprint = generateFindingFingerprint({
        repoIdentity: repoId,
        kind: 'custom',
        ruleId: 'standard-commit-message',
        targetRef: currentBranch.name,
      })

      findings.push({
        id: `finding_standard_commit_${repoId}_${encodeURIComponent(currentBranch.name)}`,
        fingerprint,
        repoId,
        repoAlias,
        kind: 'custom',
        source: 'rule',
        severity: 'info',
        lifecycle: 'open',
        freshness: 'fresh',
        target: { name: currentBranch.name, oid: topCommit.hash },
        scenarioId: 'standard-commits',
        evidence: {
          commits: nonCompliantCommits.map((c) => c.hash),
          paths: [],
          ruleId: 'standard-commit-message',
          details: {
            branch: currentBranch.name,
            nonCompliantCount: nonCompliantCommits.length,
            sampleSubject: topCommit.subject,
            conclusion: `未推送提交不符合 Conventional Commits 规范 ("${topCommit.subject.slice(0, 40)}")`,
            stateKind: 'warn',
          },
        },
        observedAt: now,
        baseCommitOid: topCommit.hash,
        engineVersion: ENGINE_VERSION,
      })
    }
  }

  return findings
}
