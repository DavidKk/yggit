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
  cards: {
    syncDefaultBranches: {
      title: string
      summary: string
    }
    worktreeParallelDev: {
      title: string
      summary: string
    }
    mergeDivergedBranches: {
      title: string
      summary: string
    }
    standardRepoHygiene: {
      title: string
      summary: string
    }
    standardProjectOrganization: {
      title: string
      summary: string
    }
    reviewPendingCommits: {
      title: string
      summary: string
    }
  }
  organization: {
    bannerTitle: string
    bannerDesc: string
    bannerAction: string
    prompt: string
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
    sendToAgent: string
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
  detail: {
    taskList: string
    taskSet: string
    targetProject: string
    targetBranch: string
    problemBranch: string
    problemDesc: string
    causeTitle: string
    riskTitle: string
    suggestionTitle: string
    solutionTitle: string
    closeTaskSet: string
    agentAssistTitle: string
    agentAssistDesc: string
    diagnosisDesc: string
    evidenceDesc: string
    openRepo: string
    selectPrompt: string
  }
  problemTitles: {
    merge: string
    sync: string
    worktree: string
    standard: string
    organization: string
    review: string
    default: string
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
