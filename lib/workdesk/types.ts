/**
 * Core domain types and contracts for Yggit Workdesk (Virtual Teammate).
 * Adheres to docs/technical/yggit-workdesk-architecture.md
 */

/** Git ref and commit identifier */
export interface GitRef {
  name: string
  oid?: string
}

/** Check evidence details */
export interface FindingEvidence {
  paths?: string[]
  commits?: string[]
  ruleId?: string
  details?: Record<string, unknown>
}

/** Atomic check finding */
export interface Finding {
  id: string
  fingerprint: string // Deterministic SHA-256
  repoId: string
  repoAlias: string
  kind: 'sync' | 'merge' | 'review' | 'custom'
  source: 'git' | 'rule' | 'agent'
  severity: 'blocking' | 'warning' | 'info'
  lifecycle: 'open' | 'acknowledged' | 'resolved' | 'dismissed'
  freshness: 'fresh' | 'stale' | 'unavailable'
  target?: GitRef
  sources?: GitRef[]
  scenarioId?: string
  evidence: FindingEvidence
  observedAt: number
  baseCommitOid: string
  engineVersion: string
}

/** Item within a work card (per-repository or per-branch) */
export interface WorkItem {
  id: string
  cardId: string
  repoId: string
  repoAlias: string
  name: string // e.g. "master", "feature/auth"
  summary: string // e.g. "远程领先，可安全快进"
  state: 'safe' | 'warn' | 'bad'
  findingIds: string[]
  commit?: string
  paths?: string[]
}

/** Work card presented on the 4-lane board */
export interface WorkCard {
  id: string // e.g. "sync-default-branches", "worktree-parallel-dev"
  groupKey: string
  title: string
  summary: string
  scope: string // e.g. "5 个项目"
  iconName: string // react-icons identifier
  categoryId: 'branch' | 'merge' | 'standard' | 'review' | string
  categorySource: 'rule' | 'agent' | 'user'
  state: 'prepared' | 'waiting' | 'running' | 'completed' | 'partial' | 'archived'
  itemIds: string[]
  hidden?: boolean
  createdAt: number
  updatedAt: number
}

/** Portable check recipe for sharing */
export interface CheckRecipe {
  version: 1
  repositories: Array<{
    identityDigest: string
  }>
  checks: Array<{
    repoIdentityDigest: string
    type: 'sync' | 'merge' | 'review'
    target?: string
    sources?: string[]
    ruleId?: string
  }>
}

/** Result of matching recipe repositories against local projects */
export interface RepoMatchResult {
  index: number
  identityDigest: string
  matchedProject?: {
    id: string
    name: string
    localPath: string
    httpsUrl: string
  }
  candidateProjects?: Array<{
    id: string
    name: string
    localPath: string
    httpsUrl: string
  }>
  status: 'matched' | 'multiple' | 'unmatched'
}

/** Store snapshot schema for Workdesk */
export interface WorkdeskStoreData {
  version: number
  lastChecked: number
  findings: Finding[]
  cards: WorkCard[]
  items: WorkItem[]
}
