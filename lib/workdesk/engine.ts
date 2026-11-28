/**
 * Workdesk Scan Pipeline & Serial Idle Scheduler.
 * Adheres to docs/technical/yggit-workdesk-architecture.md §4
 */

import { getDriverMode, getGitDriver } from '@/lib/git/driver'
import { projectOpenTarget } from '@/lib/git/project-access'
import type { GitLogView, GitProjectView } from '@/lib/git/types'
import { createScopedLogger } from '@/lib/logger'
import { clusterFindingsToCards } from '@/lib/workdesk/cluster'
import { detectDefaultBranchSync } from '@/lib/workdesk/detectors/branch-sync'
import { detectCodeReview } from '@/lib/workdesk/detectors/code-review'
import { detectMergeIntegration } from '@/lib/workdesk/detectors/merge-integration'
import { detectOrganizationHygiene } from '@/lib/workdesk/detectors/organization-hygiene'
import { detectStandardHygiene } from '@/lib/workdesk/detectors/standard-hygiene'
import { detectWorktreeParallel } from '@/lib/workdesk/detectors/worktree-parallel'
import { computeEdgeRepoSignature, FINGERPRINT_FORCE_RECHECK_MS, loadProbeFingerprints, type RepoProbeFingerprint, saveProbeFingerprints } from '@/lib/workdesk/fingerprint-cache'
import { isForegroundBusy, subscribeForegroundPause, waitForIdleWindow } from '@/lib/workdesk/scheduler'
import { getDismissedCardIds, loadWorkdeskStore, saveWorkdeskStore } from '@/lib/workdesk/storage'
import type { Finding, WorkCard, WorkdeskStoreData, WorkItem } from '@/lib/workdesk/types'

export interface ScanResult {
  lastChecked: number
  findings: Finding[]
  cards: WorkCard[]
  items: Record<string, WorkItem>
}

export interface WorkdeskScanOptions {
  specificProjects?: GitProjectView[]
  force?: boolean
}

type ScanListener = (result: ScanResult) => void

export const WORKDESK_SCAN_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes default

/** Persist only open findings; cards and items are deterministically derived on load. */
function buildPersistedWorkdeskStore(lastChecked: number, findings: Finding[]): WorkdeskStoreData {
  return {
    version: 1,
    lastChecked,
    findings: findings.filter((finding) => finding.lifecycle === 'open'),
  }
}

function matchesProjectTarget(project: GitProjectView, normalizedTarget: string): boolean {
  const targetSegments = normalizedTarget.split(/[/\\?#]/).filter(Boolean)
  const candidates = [project.id, project.name, project.localPath, project.httpsUrl].filter(Boolean).map((v) => v.toLowerCase())
  return candidates.some((c) => c === normalizedTarget || normalizedTarget.endsWith(`/${c}`) || normalizedTarget.endsWith(`\\${c}`) || targetSegments.includes(c))
}

function prioritizeProjects(projects: GitProjectView[]): GitProjectView[] {
  let activeHint = ''
  if (typeof window !== 'undefined') {
    try {
      const searchRepo = new URLSearchParams(window.location.search).get('repo')?.trim().toLowerCase()
      activeHint = searchRepo || window.localStorage.getItem('yggit.last_git_url')?.trim().toLowerCase() || ''
    } catch {
      // Ignore storage access errors
    }
  }

  return projects.slice().sort((a, b) => {
    const aActive = activeHint && matchesProjectTarget(a, activeHint) ? 0 : 1
    const bActive = activeHint && matchesProjectTarget(b, activeHint) ? 0 : 1
    if (aActive !== bActive) return aActive - bActive

    const aWork = a.group === '工作项目' ? 0 : 1
    const bWork = b.group === '工作项目' ? 0 : 1
    return aWork - bWork
  })
}

function evaluateRepoDetectors(project: GitProjectView, logView: GitLogView): Finding[] {
  const findings: Finding[] = []
  const syncFinding = detectDefaultBranchSync({ project, logView })
  if (syncFinding) findings.push(syncFinding)
  findings.push(...detectWorktreeParallel({ project, logView }))
  findings.push(...detectMergeIntegration({ project, logView }))
  findings.push(...detectStandardHygiene({ project, logView }))
  findings.push(...detectCodeReview({ project, logView }))
  return findings
}

class WorkdeskEngine {
  private timer: ReturnType<typeof setInterval> | null = null
  private boardActiveCount = 0
  private isScanning = false
  private activeScanController: AbortController | null = null
  private pendingScanPromise: Promise<ScanResult> | null = null
  private listeners = new Set<ScanListener>()
  private cachedResult: ScanResult | null = null
  private inFlightInitialLoad: Promise<ScanResult | null> | null = null
  private emptyStoreLoaded = false
  private repoCachedResults = new Map<string, ScanResult>()
  private repoInFlightLoads = new Map<string, Promise<ScanResult | null>>()

  constructor() {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (this.boardActiveCount <= 0) return
        if (document.visibilityState === 'visible') {
          if (!this.cachedResult || Date.now() - this.cachedResult.lastChecked > WORKDESK_SCAN_INTERVAL_MS) {
            this.scan().catch(() => {})
          }
        }
      })
      window.addEventListener('yggit:driver_mode_changed', () => {
        void this.resetForModeChange()
      })
    }
  }

  public async resetForModeChange(): Promise<void> {
    this.activeScanController?.abort()
    this.activeScanController = null
    this.pendingScanPromise = null
    this.inFlightInitialLoad = null
    this.emptyStoreLoaded = false
    this.repoCachedResults.clear()
    this.repoInFlightLoads.clear()
    this.cachedResult = null
    this.isScanning = false
    const initial = await this.loadInitial()
    if (initial) {
      this.notify(initial)
    } else {
      this.notify({
        lastChecked: Date.now(),
        findings: [],
        cards: [],
        items: {},
      })
    }
    if (this.boardActiveCount > 0) {
      await this.scan().catch(() => {})
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

  private hydrateStoreSnapshot(stored: WorkdeskStoreData): ScanResult {
    const findings = Array.isArray(stored.findings) ? stored.findings : []
    const shouldRecompute = findings.length > 0 || !Array.isArray(stored.cards)
    if (shouldRecompute) {
      const { cards, items } = clusterFindingsToCards(findings, getDismissedCardIds())
      return {
        lastChecked: stored.lastChecked || Date.now(),
        findings,
        cards,
        items,
      }
    }
    const itemsMap: Record<string, WorkItem> = {}
    for (const item of stored.items || []) {
      itemsMap[item.id] = item
    }
    return {
      lastChecked: stored.lastChecked || Date.now(),
      findings,
      cards: stored.cards || [],
      items: itemsMap,
    }
  }

  /** Fast pass (L1 cache load). Never triggers background network/git scans on its own. */
  public async loadInitial(): Promise<ScanResult | null> {
    if (this.cachedResult) return this.cachedResult
    if (this.emptyStoreLoaded) return null
    if (this.inFlightInitialLoad) return this.inFlightInitialLoad

    let task: Promise<ScanResult | null> | undefined = undefined
    task = (async () => {
      try {
        const stored = await loadWorkdeskStore()
        if (!stored) {
          this.emptyStoreLoaded = true
          return null
        }
        this.emptyStoreLoaded = false
        const initialResult = this.hydrateStoreSnapshot(stored)
        this.cachedResult = initialResult
        return initialResult
      } finally {
        if (this.inFlightInitialLoad === task) {
          this.inFlightInitialLoad = null
        }
      }
    })()

    this.inFlightInitialLoad = task
    return task
  }

  /** Load cached Workdesk findings scoped to a single repository (used by proactive reminders outside /workdesk). */
  public async loadInitialForRepo(repo: string): Promise<ScanResult | null> {
    const target = repo.trim()
    if (!target) return null
    if (this.cachedResult) return this.cachedResult
    if (this.emptyStoreLoaded) return null

    const key = target.toLowerCase()
    const cached = this.repoCachedResults.get(key)
    if (cached) return cached
    const inFlight = this.repoInFlightLoads.get(key)
    if (inFlight) return inFlight

    let task: Promise<ScanResult | null> | undefined = undefined
    task = (async () => {
      try {
        const stored = await loadWorkdeskStore(target)
        if (!stored) return null
        const scoped = this.hydrateStoreSnapshot(stored)
        this.repoCachedResults.set(key, scoped)
        return scoped
      } finally {
        if (this.repoInFlightLoads.get(key) === task) {
          this.repoInFlightLoads.delete(key)
        }
      }
    })()

    this.repoInFlightLoads.set(key, task)
    return task
  }

  /** Re-cluster existing in-memory findings (e.g. after undoing card dismissal) without scanning. */
  public recluster(): ScanResult | null {
    if (!this.cachedResult) return null
    const { cards, items } = clusterFindingsToCards(this.cachedResult.findings, getDismissedCardIds())
    const nextResult: ScanResult = {
      ...this.cachedResult,
      cards,
      items,
    }
    this.notify(nextResult)
    return nextResult
  }

  /** Recompute only multi-repo folder/organization hygiene findings without hitting Git repos. */
  public async recomputeOrganizationHygiene(): Promise<ScanResult | null> {
    const base = this.cachedResult || (await this.loadInitial())
    const driver = getGitDriver()
    const catalog = await driver.getProjects()
    const projects = catalog.projects || []
    const existingNonOrg = (base?.findings || []).filter((f) => f.scenarioId !== 'project-organization')
    const orgFindings = detectOrganizationHygiene({ projects })
    const nextFindings = [...existingNonOrg, ...orgFindings]
    const { cards, items } = clusterFindingsToCards(nextFindings, getDismissedCardIds())
    const now = Date.now()
    const nextResult: ScanResult = {
      lastChecked: base?.lastChecked || now,
      findings: nextFindings,
      cards,
      items,
    }
    await saveWorkdeskStore(buildPersistedWorkdeskStore(nextResult.lastChecked, nextFindings))
    this.notify(nextResult)
    return nextResult
  }

  /** Mark Workdesk board active and start background refresh timer (30 min). */
  public startTimer(): void {
    this.boardActiveCount += 1
    if (this.timer) return
    this.timer = setInterval(() => {
      if (this.boardActiveCount <= 0) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return
      }
      this.scan().catch(() => {})
    }, WORKDESK_SCAN_INTERVAL_MS)
  }

  public stopTimer(): void {
    this.boardActiveCount = Math.max(0, this.boardActiveCount - 1)
    if (this.boardActiveCount === 0 && this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Optimistically clear resolved `sync-default-branches` findings for a repo/branch
   * after `sync_branch` succeeds, then refresh ONLY that repository in the background.
   */
  public markBranchSynced(repoTarget: string, branchName?: string): void {
    const normalizedTarget = repoTarget.trim().toLowerCase()
    if (!normalizedTarget) return

    if (this.cachedResult) {
      const targetSegments = normalizedTarget.split(/[/\\?#]/).filter(Boolean)
      const matchesRepo = (repoId: string, repoAlias: string): boolean => {
        const id = repoId.toLowerCase()
        const alias = repoAlias.toLowerCase()
        return (
          id === normalizedTarget ||
          alias === normalizedTarget ||
          normalizedTarget.endsWith(`/${alias}`) ||
          normalizedTarget.endsWith(`\\${alias}`) ||
          targetSegments.includes(alias) ||
          targetSegments.includes(id)
        )
      }

      let changed = false
      const nextFindings = this.cachedResult.findings.map((f) => {
        if (f.kind !== 'sync' || f.scenarioId !== 'default-branch-sync' || f.lifecycle !== 'open') return f
        if (!matchesRepo(f.repoId, f.repoAlias)) return f
        if (branchName && f.target?.name && f.target.name !== branchName) return f
        changed = true
        return { ...f, lifecycle: 'resolved' as const }
      })

      if (changed) {
        const dismissedIds = getDismissedCardIds()
        const { cards, items } = clusterFindingsToCards(nextFindings, dismissedIds)
        const now = Date.now()
        const nextResult: ScanResult = {
          lastChecked: now,
          findings: nextFindings,
          cards,
          items,
        }
        void saveWorkdeskStore(buildPersistedWorkdeskStore(now, nextFindings))
        this.notify(nextResult)
      }
    }

    // Refresh only the affected repository rather than rescanning the entire catalog
    void getGitDriver()
      .getProjects()
      .then((catalog) => {
        const match = (catalog.projects || []).find((project) => matchesProjectTarget(project, normalizedTarget))
        if (match) {
          return this.scan({ specificProjects: [match], force: true })
        }
        return undefined
      })
      .catch(() => {})
  }

  private async probeOrReadProject(input: {
    project: GitProjectView
    target: string
    driver: ReturnType<typeof getGitDriver>
    mode: ReturnType<typeof getDriverMode>
    previousFindings: Finding[] | undefined
    fingerprintEntry: RepoProbeFingerprint | undefined
    force: boolean
    signal: AbortSignal
  }): Promise<{ findings: Finding[]; nextFingerprint?: RepoProbeFingerprint }> {
    const { project, target, driver, mode, previousFindings, fingerprintEntry, force, signal } = input
    const canReuseByAge =
      !force && previousFindings !== undefined && Boolean(fingerprintEntry?.signature) && Date.now() - (fingerprintEntry?.checkedAt || 0) < FINGERPRINT_FORCE_RECHECK_MS

    if (driver.mode === 'local' && typeof fetch === 'function') {
      try {
        const res = await fetch('/api/git/workdesk/probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo: target,
            knownSignature: canReuseByAge ? fingerprintEntry?.signature : undefined,
            force,
          }),
          signal,
        })
        if (res.ok) {
          const payload = (await res.json()) as { unchanged?: boolean; signature?: string; logView?: GitLogView }
          if (payload.unchanged && previousFindings !== undefined && payload.signature) {
            return {
              findings: previousFindings,
              nextFingerprint: { signature: payload.signature, checkedAt: Date.now() },
            }
          }
          if (payload.logView) {
            return {
              findings: evaluateRepoDetectors(project, payload.logView),
              nextFingerprint: payload.signature ? { signature: payload.signature, checkedAt: Date.now() } : undefined,
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        // Fallback to driver.readLog if probe endpoint is unavailable
      }
    }

    if (mode === 'edge' && canReuseByAge && target.startsWith('edge_') && previousFindings !== undefined) {
      const currentSig = await computeEdgeRepoSignature(target)
      if (currentSig && currentSig === fingerprintEntry?.signature) {
        return {
          findings: previousFindings,
          nextFingerprint: { signature: currentSig, checkedAt: Date.now() },
        }
      }
    }

    const logView = await driver.readLog({ repo: target, signal })
    const edgeSig = mode === 'edge' && target.startsWith('edge_') ? await computeEdgeRepoSignature(target) : null
    return {
      findings: evaluateRepoDetectors(project, logView),
      nextFingerprint: edgeSig ? { signature: edgeSig, checkedAt: Date.now() } : undefined,
    }
  }

  /**
   * Run a serial, idle-friendly Workdesk scan that pauses whenever the foreground UI
   * is busy and skips repositories whose metadata signature has not changed.
   */
  public async scan(input?: GitProjectView[] | WorkdeskScanOptions): Promise<ScanResult> {
    const options: WorkdeskScanOptions = Array.isArray(input) ? { specificProjects: input } : input || {}
    const force = Boolean(options.force)

    if (this.isScanning && !force && this.pendingScanPromise) {
      return this.pendingScanPromise
    }
    if (this.isScanning && force) {
      this.activeScanController?.abort()
    }

    const controller = new AbortController()
    this.activeScanController = controller
    this.isScanning = true

    const run = async (): Promise<ScanResult> => {
      try {
        const driver = getGitDriver()
        const mode = getDriverMode()
        const catalog = await driver.getProjects()
        const allProjects = catalog.projects || []
        const isPartialScan = Boolean(options.specificProjects && options.specificProjects.length > 0)
        const rawQueue = isPartialScan ? options.specificProjects! : allProjects
        const projectsToScan = prioritizeProjects(rawQueue)
        const scanLog = createScopedLogger('system')
        scanLog.info(`Started Workdesk ${force ? 'forced ' : ''}scan (${projectsToScan.length} repo(s), ${mode} mode)`)

        const baseline = this.cachedResult || (await this.loadInitial())
        const activeProjectIds = new Set(allProjects.map((p) => p.id))
        const findingsByRepo = new Map<string, Finding[]>()

        for (const finding of baseline?.findings || []) {
          if (finding.scenarioId === 'project-organization') continue
          if (!activeProjectIds.has(finding.repoId)) continue
          const list = findingsByRepo.get(finding.repoId) || []
          list.push(finding)
          findingsByRepo.set(finding.repoId, list)
        }

        const fingerprintMap = loadProbeFingerprints(mode)

        for (const project of projectsToScan) {
          if (controller.signal.aborted) break
          const target = projectOpenTarget(project)
          if (!target) continue

          // Wait for idle browser slot when running full background scans
          if (!force) {
            const idleReady = await waitForIdleWindow(controller.signal)
            if (!idleReady) break
          }

          let itemController: AbortController | null = null
          let unsubscribePause: (() => void) | null = null
          try {
            itemController = new AbortController()
            const linkAbort = () => itemController?.abort()
            controller.signal.addEventListener('abort', linkAbort, { once: true })
            if (!force) {
              unsubscribePause = subscribeForegroundPause(() => {
                if (isForegroundBusy()) {
                  itemController?.abort()
                }
              })
            }

            const result = await this.probeOrReadProject({
              project,
              target,
              driver,
              mode,
              previousFindings: findingsByRepo.get(project.id),
              fingerprintEntry: fingerprintMap[project.id],
              force,
              signal: itemController.signal,
            })

            findingsByRepo.set(project.id, result.findings)
            if (result.nextFingerprint) {
              fingerprintMap[project.id] = result.nextFingerprint
            }
          } catch {
            // If aborted by foreground priority or transient repo error, preserve baseline findings
            if (!force && !controller.signal.aborted && isForegroundBusy()) {
              const resumed = await waitForIdleWindow(controller.signal)
              if (!resumed) break
            }
          } finally {
            unsubscribePause?.()
            itemController = null
          }
        }

        // Prune removed project fingerprints and persist
        for (const id of Object.keys(fingerprintMap)) {
          if (!activeProjectIds.has(id)) delete fingerprintMap[id]
        }
        saveProbeFingerprints(mode, fingerprintMap)

        const allFindings: Finding[] = []
        for (const list of findingsByRepo.values()) {
          allFindings.push(...list)
        }
        allFindings.push(...detectOrganizationHygiene({ projects: allProjects }))

        const dismissedIds = getDismissedCardIds()
        const { cards, items } = clusterFindingsToCards(allFindings, dismissedIds)
        const now = Date.now()
        const result: ScanResult = {
          lastChecked: now,
          findings: allFindings,
          cards,
          items,
        }

        await saveWorkdeskStore(buildPersistedWorkdeskStore(now, allFindings))
        this.emptyStoreLoaded = false
        this.repoCachedResults.clear()
        this.notify(result)
        scanLog.info(`Completed Workdesk scan: ${cards.length} card(s), ${allFindings.length} finding(s)`, {
          mode,
          repoCount: projectsToScan.length,
        })
        return result
      } finally {
        if (this.activeScanController === controller) {
          this.activeScanController = null
          this.isScanning = false
          this.pendingScanPromise = null
        }
      }
    }

    const promise = run()
    this.pendingScanPromise = promise
    return promise
  }
}

export const workdeskEngine = new WorkdeskEngine()
