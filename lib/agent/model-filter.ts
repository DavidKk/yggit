/**
 * Model access control: whitelist and blacklist rules.
 * Rules:
 * - Empty whitelist = all models permitted ("不填就是所有").
 * - Non-empty whitelist = only specified models permitted ("填了就是指定").
 * - Blacklist has absolute priority over whitelist ("黑名单比白名单优先，设置了黑名单，白名单设置了也不显示").
 */

export interface ModelFilterOptions {
  whitelist: string[]
  blacklist: string[]
}

export const DEFAULT_MODEL_FILTER: ModelFilterOptions = {
  whitelist: [],
  blacklist: [],
}

export const MODEL_FILTER_STORAGE_KEY = 'yggit.agent.model-filter.v1'

export function matchesModelPattern(pattern: string, modelId: string): boolean {
  const p = pattern.trim().toLowerCase()
  const m = modelId.trim().toLowerCase()
  if (!p || !m) return false
  if (p === '*' || p === m) return true
  if (p.includes('*')) {
    const regexStr = '^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
    try {
      return new RegExp(regexStr, 'i').test(m)
    } catch {
      return p === m
    }
  }
  return p === m
}

export function isModelAllowed(modelId: string, filter?: ModelFilterOptions): boolean {
  if (!filter) return true
  const normId = modelId.trim()
  if (!normId) return false

  const blacklist = (filter.blacklist || []).map((s) => s.trim()).filter(Boolean)
  const whitelist = (filter.whitelist || []).map((s) => s.trim()).filter(Boolean)

  // 1. Blacklist check: highest priority, blocks model even if in whitelist
  const isBlacklisted = blacklist.some((pattern) => matchesModelPattern(pattern, normId))
  if (isBlacklisted) {
    return false
  }

  // 2. Whitelist check: empty means all permitted
  if (whitelist.length === 0) {
    return true
  }

  // 3. Whitelist specified: must match at least one whitelist pattern
  return whitelist.some((pattern) => matchesModelPattern(pattern, normId))
}

export function filterAllowedModels<T extends { id: string }>(models: T[], filter?: ModelFilterOptions): T[] {
  if (!filter) return models
  return models.filter((m) => isModelAllowed(m.id, filter))
}

/** Returns models in the whitelist that are overridden and blocked by the blacklist. */
export function getModelFilterConflicts(filter?: ModelFilterOptions): string[] {
  if (!filter) return []
  const blacklist = (filter.blacklist || []).map((s) => s.trim()).filter(Boolean)
  const whitelist = (filter.whitelist || []).map((s) => s.trim()).filter(Boolean)
  if (blacklist.length === 0 || whitelist.length === 0) return []

  return whitelist.filter((w) => blacklist.some((b) => matchesModelPattern(b, w)))
}
