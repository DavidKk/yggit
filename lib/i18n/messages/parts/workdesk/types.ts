export interface WorkdeskMessages {
  title: string
  topbarTitle: string
  emptyTitle: string
  emptyDesc: string
  lane: {
    branch: string
    merge: string
    standard: string
    review: string
  }
  status: {
    safe: string
    warn: string
    bad: string
    dismissed: string
    unverified: string
  }
  scope: {
    projects: string
    projectsWorktrees: string
    worktrees: string
  }
  action: {
    back: string
    dismiss: string
    undoDismiss: string
    viewInGit: string
    openCommit: string
    openDiff: string
    checkNow: string
    refresh: string
    importRecipe: string
    exportRecipe: string
  }
  evidence: {
    title: string
    commit: string
    file: string
    conclusion: string
    noEvidence: string
    details: string
    worktreePath: string
    aheadBehind: string
  }
  agent: {
    prompt: string
    badge: string
    syncPlanConfirm: string
  }
  import: {
    title: string
    subtitle: string
    matchedCount: string
    verifyMatched: string
    pendingMatch: string
    matched: string
    noMatchHint: string
    invalidRecipe: string
    selectDirectory: string
    checkInProgress: string
  }
  lastChecked: string
  justNow: string
  minutesAgo: string
}
