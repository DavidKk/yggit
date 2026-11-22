/**
 * Workdesk Scan Pipeline & Timer Engine.
 * Adheres to docs/technical/yggit-workdesk-architecture.md §4
 */

import { getGitDriver } from '@/lib/git/driver'
import { projectOpenTarget } from '@/lib/git/project-access'
import type { GitProjectView } from '@/lib/git/types'
import { clusterFindingsToCards } from '@/lib/workdesk/cluster'
import { detectDefaultBranchSync } from '@/lib/workdesk/detectors/branch-sync'
import { detectWorktreeParallel } from '@/lib/workdesk/detectors/worktree-parallel'
import { getDismissedCardIds, loadWorkdeskStore, saveWorkdeskStore } from '@/lib/workdesk/storage'
import type { Finding, WorkCard, WorkdeskStoreData, WorkItem } from '@/lib/workdesk/types'

export interface ScanResult {
  lastChecked: number
  findings: Finding[]
  cards: WorkCard[]
  items: Record<string, WorkItem>
}

type ScanListener = (result: ScanResult) => void

const SCAN_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes default
const CONCURRENCY_LIMIT = 3

class WorkdeskEngine {
  private timer: ReturnType<typeof setInterval> | null = null
  private isScanning = false
  private listeners = new Set<ScanListener>()
  private cachedResult: ScanResult | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // Check if expired
          if (!this.cachedResult || Date.now() - this.cachedResult.lastChecked > SCAN_INTERVAL_MS) {
            this.scan().catch(() => {})
          }
        }
      })
    }
  }

  public subscribe(listener: ScanListener): () => void {
    this.listeners.add(listener)
    if (this.cachedResult) {
      listener(this.cachedResult)
    }
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(result: ScanResult) {
    this.cachedResult = result
    for (const listener of this.listeners) {
      try {
        listener(result)
      } catch {
        // ignore
      }
    }
  }

  /**
   * Fast pass (L1 cache load)
   */
  public async loadInitial(): Promise<ScanResult | null> {
    if (this.cachedResult) return this.cachedResult
    const stored = await loadWorkdeskStore()
    if (stored && Array.isArray(stored.cards)) {
      const itemsMap: Record<string, WorkItem> = {}
      for (const item of stored.items || []) {
        itemsMap[item.id] = item
      }
      const initialResult: ScanResult = {
        lastChecked: stored.lastChecked || Date.now(),
        findings: stored.findings || [],
        cards: stored.cards,
        items: itemsMap,
      }
      this.cachedResult = initialResult
      return initialResult
    }
    return null
  }

  /**
   * Start 5-minute background refresh timer
   */
  public startTimer(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return // Pause when tab is hidden
      }
      this.scan().catch(() => {})
    }, SCAN_INTERVAL_MS)
  }

  public stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Run full scan across all connected projects
   */
  public async scan(specificProjects?: GitProjectView[]): Promise<ScanResult> {
    if (this.isScanning) {
      if (this.cachedResult) return this.cachedResult
    }
    this.isScanning = true

    try {
      const driver = getGitDriver()
      const catalog = await driver.getProjects()
      const projectsToScan = specificProjects || catalog.projects || []

      const allFindings: Finding[] = []

      // Batch with concurrency limit
      for (let i = 0; i < projectsToScan.length; i += CONCURRENCY_LIMIT) {
        const batch = projectsToScan.slice(i, i + CONCURRENCY_LIMIT)
        await Promise.all(
          batch.map(async (project) => {
            const target = projectOpenTarget(project)
            if (!target) return
            try {
              const logView = await driver.readLog({
                repo: target,
                skip: 0,
                take: 20,
              })

              // 1. Default branch sync detection
              const syncFinding = detectDefaultBranchSync({ project, logView })
              if (syncFinding) {
                allFindings.push(syncFinding)
              }

              // 2. Parallel worktree & feature branch detection
              const parallelFindings = detectWorktreeParallel({ project, logView })
              allFindings.push(...parallelFindings)
            } catch {
              // Gracefully handle unreadable or unavailable repository
            }
          })
        )
      }

      // Cluster findings
      const dismissedIds = getDismissedCardIds()
      const { cards, items } = clusterFindingsToCards(allFindings, dismissedIds)

      const now = Date.now()
      const result: ScanResult = {
        lastChecked: now,
        findings: allFindings,
        cards,
        items,
      }

      // Persist snapshot
      const storeData: WorkdeskStoreData = {
        version: 1,
        lastChecked: now,
        findings: allFindings,
        cards,
        items: Object.values(items),
      }
      await saveWorkdeskStore(storeData)

      this.notify(result)
      return result
    } finally {
      this.isScanning = false
    }
  }
}

export const workdeskEngine = new WorkdeskEngine()
