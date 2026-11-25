/**
 * DefaultBranchSyncDetector: Evaluates default branch sync and fast-forward safety.
 * Adheres to docs/technical/yggit-workdesk-architecture.md §4.1
 */

import type { GitBranch, GitLogView, GitProjectView } from '@/lib/git/types'
import { generateFindingFingerprint } from '@/lib/workdesk/fingerprint'
import type { Finding } from '@/lib/workdesk/types'

const ENGINE_VERSION = '1.0.0'

export interface BranchSyncDetectorContext {
  project: GitProjectView
  logView: GitLogView
}

/**
 * Identify the default branch of a project (e.g. main, master, or current head).
 */
export function resolveDefaultBranch(logView: GitLogView): GitBranch | undefined {
  const branches = logView.branches || []
  // Prefer explicit main or master, or fall back to logView.branch
  return branches.find((b) => b.name === 'main') || branches.find((b) => b.name === 'master') || branches.find((b) => b.name === logView.branch) || branches[0]
}

/**
 * Execute DefaultBranchSyncDetector for a given project log.
 */
export function detectDefaultBranchSync(ctx: BranchSyncDetectorContext): Finding | null {
  const { project, logView } = ctx
  const defaultBranch = resolveDefaultBranch(logView)
  if (!defaultBranch) return null

  const repoId = project.id || project.name
  const repoAlias = project.label || project.name
  const branchName = defaultBranch.name
  const localTip = defaultBranch.tip || ''
  const upstream = defaultBranch.upstream || ''

  // Find upstream tracking ref in logView.remotes if available
  const remoteBranch = logView.remotes?.find((r) => r.name === upstream || (upstream && r.name.endsWith(upstream)))
  const remoteTip = remoteBranch?.tip

  // Check if dirty
  const isDirty = Boolean(logView.worktree && (logView.worktree.files ?? 0) > 0)

  // Check if checked out by another worktree
  const isCheckedOutElsewhere = Boolean(logView.worktrees?.some((wt) => !wt.current && wt.branch === branchName))

  const ahead = defaultBranch.ahead ?? 0
  const behind = defaultBranch.behind ?? 0

  let severity: Finding['severity'] = 'info'
  let stateKind: 'safe' | 'warn' | 'bad' = 'safe'
  let conclusion = '已与远程保持同步'
  let freshness: Finding['freshness'] = 'fresh'

  if (!upstream && !remoteTip) {
    // Missing remote tracking branch
    severity = 'warning'
    stateKind = 'warn'
    freshness = 'unavailable'
    conclusion = '待核查（缺少远程跟踪分支或祖先证据）'
  } else if (ahead > 0 && behind > 0) {
    // Diverged
    severity = 'warning'
    stateKind = 'bad'
    conclusion = '本地与远程分叉，需人工介入处理'
  } else if (behind > 0) {
    // Remote ahead
    if (isDirty) {
      severity = 'warning'
      stateKind = 'warn'
      conclusion = '本地工作区有未提交变更'
    } else if (isCheckedOutElsewhere) {
      severity = 'warning'
      stateKind = 'warn'
      conclusion = '分支已被其他活动 Worktree 检出'
    } else {
      severity = 'info'
      stateKind = 'safe'
      conclusion = '远程领先，可安全快进'
    }
  } else if (ahead > 0) {
    // Local ahead
    severity = 'info'
    stateKind = 'warn'
    conclusion = '本地领先，包含未推送提交'
  }

  // A branch is fully synchronized if there are no incoming commits (behind === 0),
  // no outgoing unpushed commits (ahead === 0), it has an upstream tracking branch, and is not locked elsewhere.
  // Uncommitted working tree files alone do NOT constitute a remote branch sync finding when behind === 0.
  const isFullySynchronized = ahead === 0 && behind === 0 && Boolean(upstream) && !isCheckedOutElsewhere
  if (isFullySynchronized) {
    severity = 'info'
    stateKind = 'safe'
    conclusion = '已与远程保持同步'
  }

  const fingerprint = generateFindingFingerprint({
    repoIdentity: repoId,
    kind: 'sync',
    ruleId: 'default-branch-sync',
    targetRef: branchName,
    sources: upstream ? [upstream] : [],
  })

  const commits: string[] = []
  if (remoteTip) commits.push(remoteTip)
  if (localTip && localTip !== remoteTip) commits.push(localTip)

  return {
    id: `finding_sync_${repoId}_${branchName}`,
    fingerprint,
    repoId,
    repoAlias,
    kind: 'sync',
    source: 'git',
    severity,
    lifecycle: isFullySynchronized ? 'resolved' : 'open',
    freshness,
    target: { name: branchName, oid: localTip },
    sources: upstream ? [{ name: upstream, oid: remoteTip }] : [],
    scenarioId: 'default-branch-sync',
    evidence: {
      commits,
      paths: [],
      ruleId: 'default-branch-sync',
      details: {
        ahead,
        behind,
        isDirty,
        isCheckedOutElsewhere,
        upstream,
        conclusion,
        stateKind,
      },
    },
    observedAt: Date.now(),
    baseCommitOid: localTip,
    engineVersion: ENGINE_VERSION,
  }
}
