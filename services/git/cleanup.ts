import fs from 'node:fs'
import path from 'node:path'

import { DATA_DIR } from '@/constants/paths'
import type { WorkdeskStoreData } from '@/lib/workdesk/types'

import { deleteCachedConflictsForRepo } from './conflicts'
import { deleteBranchMarksForRepo } from './marks'

export interface RemovedProjectTarget {
  id: string
  localPath?: string
  httpsUrl?: string
}

const LAST_OPENED_FILE = path.join(DATA_DIR, 'git-projects', 'last.json')
const WORKDESK_STORE_FILE = path.join(DATA_DIR, 'git-workdesk', 'workdesk-store.json')

function collectRepoKeys(removed: RemovedProjectTarget[]): Set<string> {
  const keys = new Set<string>()
  for (const project of removed) {
    const local = project.localPath?.trim()
    if (local) {
      keys.add(local)
      keys.add(path.resolve(local))
    }
    const remote = project.httpsUrl?.trim()
    if (remote) {
      keys.add(remote)
    }
  }
  return keys
}

function clearLastOpenedIfRemoved(repoKeys: Set<string>): void {
  if (repoKeys.size === 0 || !fs.existsSync(LAST_OPENED_FILE)) return
  try {
    const parsed = JSON.parse(fs.readFileSync(LAST_OPENED_FILE, 'utf8')) as { path?: string }
    const current = typeof parsed.path === 'string' ? parsed.path.trim() : ''
    if (!current) return
    if (repoKeys.has(current) || repoKeys.has(path.resolve(current))) {
      fs.unlinkSync(LAST_OPENED_FILE)
    }
  } catch {
    // Ignore malformed or inaccessible last.json
  }
}

function pruneWorkdeskStoreForProjects(removedIds: Set<string>): void {
  if (removedIds.size === 0 || !fs.existsSync(WORKDESK_STORE_FILE)) return
  try {
    const store = JSON.parse(fs.readFileSync(WORKDESK_STORE_FILE, 'utf8')) as WorkdeskStoreData
    const prevFindings = Array.isArray(store.findings) ? store.findings : []
    const nextFindings = prevFindings.filter((f) => !removedIds.has(f.repoId))
    const prevItems = Array.isArray(store.items) ? store.items : []
    const nextItems = prevItems.filter((item) => !removedIds.has(item.repoId))

    if (nextFindings.length === prevFindings.length && nextItems.length === prevItems.length) {
      return
    }

    const removedItemIds = new Set(prevItems.filter((item) => removedIds.has(item.repoId)).map((item) => item.id))
    const nextCards = Array.isArray(store.cards)
      ? store.cards
          .map((card) => {
            const itemIds = (card.itemIds || []).filter((id) => !removedItemIds.has(id))
            return { ...card, itemIds }
          })
          .filter((card) => card.itemIds.length > 0)
      : undefined

    const nextStore: WorkdeskStoreData = {
      version: store.version || 1,
      lastChecked: store.lastChecked || Date.now(),
      findings: nextFindings,
      ...(nextCards ? { cards: nextCards } : {}),
      ...(Array.isArray(store.items) ? { items: nextItems } : {}),
    }

    fs.writeFileSync(WORKDESK_STORE_FILE, JSON.stringify(nextStore), 'utf8')
  } catch {
    // Ignore malformed or inaccessible workdesk-store.json
  }
}

/**
 * Cascade-removes orphaned cache files and snapshots belonging to projects deleted
 * from the workspace catalog (`git-conflicts`, `git-marks`, `last.json`, `git-workdesk`).
 */
export function cleanupRemovedProjectsData(removed: RemovedProjectTarget[]): void {
  if (removed.length === 0) return

  const repoKeys = collectRepoKeys(removed)
  for (const key of repoKeys) {
    deleteCachedConflictsForRepo(key)
    deleteBranchMarksForRepo(key)
  }

  clearLastOpenedIfRemoved(repoKeys)

  const removedIds = new Set(removed.map((item) => item.id.trim()).filter(Boolean))
  pruneWorkdeskStoreForProjects(removedIds)
}
