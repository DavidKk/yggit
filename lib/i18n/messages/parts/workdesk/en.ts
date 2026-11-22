import type { WorkdeskMessages } from './types'

export const workdeskEn: { workdesk: WorkdeskMessages } = {
  workdesk: {
    title: 'Workdesk',
    topbarTitle: 'Workdesk',
    emptyTitle: 'No Git tasks require attention',
    emptyDesc: 'All connected repositories are healthy and in sync',
    lane: {
      branch: 'Branch Maintenance',
      merge: 'Merge & Integration',
      standard: 'Engineering Standards',
      review: 'Code Review',
    },
    cards: {
      syncDefaultBranches: {
        title: 'Sync Default Branches',
        summary: 'Inspect default branch sync with remote to identify fast-forwardable repositories',
      },
      worktreeParallelDev: {
        title: 'Inspect Parallel Worktrees',
        summary: 'Monitor independent worktrees and feature branches health',
      },
      mergeDivergedBranches: {
        title: 'Review Diverged & Merge Branches',
        summary: 'Identify diverged branches requiring merge or rebase',
      },
      standardRepoHygiene: {
        title: 'Standards & Branch Naming Hygiene',
        summary: 'Inspect branches and commits for compliance with engineering standards',
      },
      reviewPendingCommits: {
        title: 'Pending Commits & Changes Review',
        summary: 'Inspect unpushed commits and modified files ready for code review',
      },
    },
    status: {
      safe: 'Safe to apply',
      warn: 'Needs verification',
      bad: 'Needs resolution',
      dismissed: 'Card removed',
      unverified: 'Needs verification',
    },
    scope: {
      projects: '{count} projects',
      projectsWorktrees: '{projects} projects · {worktrees} Worktrees',
      worktrees: '{count} worktrees',
    },
    action: {
      back: 'Back to tasks',
      dismiss: 'Remove card from workdesk',
      undoDismiss: 'Undo',
      viewInGit: 'View in Git',
      openCommit: 'View commit & branch DAG',
      openDiff: 'View file content & Diff',
      checkNow: 'Check Now',
      refresh: 'Refresh',
      importRecipe: 'Import check recipe',
      exportRecipe: 'Export check recipe',
    },
    evidence: {
      title: 'Related Git evidence (click to navigate)',
      commit: 'Commit {oid}',
      file: 'File {path}',
      conclusion: 'Conclusion',
      noEvidence: 'No navigable Git evidence available',
      details: 'Details',
      worktreePath: 'Worktree path: {path}',
      aheadBehind: '{ahead} ahead / {behind} behind',
    },
    agent: {
      prompt: 'Ask Git Agent below for assistance',
      badge: 'Git Agent',
      syncPlanConfirm: 'Fast-forward plan prepared. Please review the repositories to be updated.',
    },
    import: {
      title: 'Import Team Check Recipe',
      subtitle: 'Portable Check recipe validation and local matching',
      matchedCount: 'Matched {matched} / {total} projects',
      verifyMatched: 'Verify matched projects',
      pendingMatch: 'Pending association',
      matched: 'Matched',
      noMatchHint: 'This repository does not match the shared check project',
      invalidRecipe: 'Invalid or corrupted check recipe payload',
      selectDirectory: 'Select check directory',
      checkInProgress: 'Running local rule checks...',
    },
    lastChecked: 'Last checked: {time}',
    justNow: 'just now',
    minutesAgo: '{minutes}m ago',
  },
}
