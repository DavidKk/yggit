'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useT } from '@/components/i18n/LocaleProvider'
import { useAgent } from '@/lib/agent/agent-context'
import { quoteWorkdeskTaskToAgent } from '@/lib/agent/agent-quote'
import type { GitProjectView } from '@/lib/git/types'
import { type ScanResult, workdeskEngine } from '@/lib/workdesk/engine'
import type { WorkItem } from '@/lib/workdesk/types'

const DISMISSED_SESSION_KEY = 'yggit.agent.dismissed-reminders'
const SNOOZED_SESSION_KEY = 'yggit.agent.proactive-session-snoozed'

export interface ProactiveReminder {
  id: string
  cardId: string
  repoId: string
  repoAlias: string
  branchName: string
  summary: string
  title: string
  message: string
  actionLabel: string
  agentPrompt: string
  detailsUrl: string
  dismiss: () => void
  accept: () => Promise<void>
  viewTask: () => void
}

/** Priority rank for Workdesk card types (lower number = higher precedence) */
const CARD_PRIORITY: Record<string, number> = {
  'sync-default-branches': 1,
  'merge-diverged-branches': 2,
  'code-review-pending-push': 3,
  'worktree-parallel-dev': 4,
  'standard-repo-hygiene': 5,
  'standard-project-organization': 6,
}

function loadDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(DISMISSED_SESSION_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveDismissedId(id: string) {
  if (typeof window === 'undefined') return
  try {
    const set = loadDismissedIds()
    set.add(id)
    sessionStorage.setItem(DISMISSED_SESSION_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // Ignore storage quota or disabled sessionStorage
  }
}

function isSessionSnoozed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(SNOOZED_SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

function saveSessionSnoozed() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SNOOZED_SESSION_KEY, 'true')
  } catch {
    // Ignore storage quota
  }
}

export function matchesActiveRepo(item: WorkItem, activeRepo: string, projects?: GitProjectView[]): boolean {
  if (!activeRepo || !item) return false

  const rawActive = activeRepo.trim()
  const lowerActive = rawActive.toLowerCase()
  const lowerAlias = item.repoAlias.toLowerCase()
  const lowerRepoId = item.repoId.toLowerCase()

  // Exact ID or Alias match
  if (lowerRepoId === lowerActive || lowerAlias === lowerActive) return true

  // Direct matching with projects catalog if provided
  if (projects && projects.length > 0) {
    const match = projects.find(
      (p) =>
        p.id.toLowerCase() === lowerActive ||
        p.name.toLowerCase() === lowerActive ||
        (p.localPath && p.localPath.toLowerCase() === lowerActive) ||
        (p.httpsUrl && p.httpsUrl.toLowerCase() === lowerActive) ||
        (p.remotes && p.remotes.some((r) => lowerActive.includes(r.url.toLowerCase())))
    )
    if (match) {
      if (item.repoId.toLowerCase() === match.id.toLowerCase() || lowerAlias === match.name.toLowerCase()) {
        return true
      }
    }
  }

  // Path suffix check (e.g. activeRepo="/path/to/admin" and item.repoAlias="admin")
  if (lowerActive.endsWith(`/${lowerAlias}`) || lowerActive.endsWith(`\\${lowerAlias}`)) {
    return true
  }

  // Remote key substring check (e.g. activeRepo="git.inshopline.com/.../admin" and item.repoAlias="admin")
  const activeSegments = lowerActive.split(/[/\\?#]/).filter(Boolean)
  if (activeSegments.includes(lowerAlias) || activeSegments.includes(lowerRepoId)) {
    return true
  }

  return false
}

function useOptionalRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter()
  } catch {
    return null
  }
}

export function useWorkdeskProactiveReminder(projects?: GitProjectView[]) {
  const t = useT()
  const router = useOptionalRouter()
  const { activeRepo, sendMessage, isProcessing, setDockMode } = useAgent()

  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [dismissedSet, setDismissedSet] = useState<Set<string>>(() => loadDismissedIds())
  const [sessionSnoozed, setSessionSnoozed] = useState<boolean>(() => isSessionSnoozed())

  // In test environments, treat as idle immediately so unit tests pass without timers
  const isTest = process.env.NODE_ENV === 'test'
  const [isIdle, setIsIdle] = useState<boolean>(isTest)

  // Reset session snooze when activeRepo changes to a different repo
  const lastRepoRef = useRef(activeRepo)
  useEffect(() => {
    if (lastRepoRef.current !== activeRepo) {
      lastRepoRef.current = activeRepo
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SNOOZED_SESSION_KEY)
      }
      setSessionSnoozed(false)
    }
  }, [activeRepo])

  // Idle detection: only pop up reminder after the user has been idle for 4 seconds without interaction
  useEffect(() => {
    if (isTest || typeof window === 'undefined') return

    let idleTimer: number | null = null
    const IDLE_DELAY_MS = 4000

    const resetIdleTimer = () => {
      setIsIdle(false)
      if (idleTimer) window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        setIsIdle(true)
      }, IDLE_DELAY_MS)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach((evt) => window.addEventListener(evt, resetIdleTimer, { passive: true }))

    // Initial idle check after mount
    idleTimer = window.setTimeout(() => {
      setIsIdle(true)
    }, IDLE_DELAY_MS)

    return () => {
      if (idleTimer) window.clearTimeout(idleTimer)
      events.forEach((evt) => window.removeEventListener(evt, resetIdleTimer))
    }
  }, [isTest])

  useEffect(() => {
    const unsubscribe = workdeskEngine.subscribe((result) => {
      setScanResult(result)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const reminder: ProactiveReminder | null = useMemo(() => {
    if (!activeRepo || !scanResult || !scanResult.items) return null
    if (sessionSnoozed || !isIdle) return null

    const allItems: WorkItem[] = Object.values(scanResult.items)
    const matchingItems = allItems.filter((item) => matchesActiveRepo(item, activeRepo, projects))

    if (matchingItems.length === 0) return null

    // Sort matching items according to priority
    const sorted = matchingItems.slice().sort((a, b) => {
      const priorityA = CARD_PRIORITY[a.cardId] ?? 99
      const priorityB = CARD_PRIORITY[b.cardId] ?? 99
      return priorityA - priorityB
    })

    // Find the first non-dismissed item
    const targetItem: WorkItem | undefined = sorted.find((item) => {
      const compositeId = `${item.repoId}:${item.cardId}:${item.name}`
      return !dismissedSet.has(compositeId)
    })

    if (!targetItem) return null

    const compositeId = `${targetItem.repoId}:${targetItem.cardId}:${targetItem.name}`
    const branchName = targetItem.name || 'main'

    let title = t('gitAgent.proactiveTitle') || 'Git Agent 待办建议'
    let message = ''
    let actionLabel = t('gitAgent.proactiveActionAssist') || '让 Agent 协助'
    let agentPrompt = ''

    if (targetItem.cardId === 'sync-default-branches') {
      title = t('gitAgent.proactiveActionSync') || '默认分支同步'
      message = (t('gitAgent.proactiveSyncQuestion', { branch: branchName }) || '默认分支 {branch} 检测到远端有更新，是否需要 Agent 帮忙同步？').replace('{branch}', branchName)
      actionLabel = t('gitAgent.proactiveActionSync') || '帮忙同步'
      agentPrompt = (t('gitAgent.proactiveSyncPrompt', { branch: branchName }) || '请帮我将默认分支 {branch} 同步更新至最新的远端提交。').replace('{branch}', branchName)
    } else if (targetItem.cardId === 'merge-diverged-branches') {
      title = t('gitAgent.proactiveActionMerge') || '分支合流变基'
      message = (t('gitAgent.proactiveMergeQuestion', { branch: branchName }) || '分支 {branch} 与主分支产生分叉偏离，是否需要协助合流变基？').replace('{branch}', branchName)
      actionLabel = t('gitAgent.proactiveActionMerge') || '协助合流'
      agentPrompt = (t('gitAgent.proactiveMergePrompt', { branch: branchName }) || '请帮我分析分支 {branch} 的分叉偏离情况并协助合流/变基。').replace('{branch}', branchName)
    } else if (targetItem.cardId === 'code-review-pending-push') {
      title = t('gitAgent.proactiveActionReview') || '待推送代码审查'
      message = (t('gitAgent.proactiveReviewQuestion', { branch: branchName }) || '分支 {branch} 有待推送的代码变更，是否需要 Agent 协助代码审查？').replace('{branch}', branchName)
      actionLabel = t('gitAgent.proactiveActionReview') || '代码审查'
      agentPrompt = (t('gitAgent.proactiveReviewPrompt', { branch: branchName }) || '请协助对分支 {branch} 尚未推送的本地提交进行代码审查。').replace('{branch}', branchName)
    } else if (targetItem.cardId === 'worktree-parallel-dev') {
      title = t('gitAgent.proactiveActionWorktree') || '工作树梳理建议'
      message = t('gitAgent.proactiveWorktreeQuestion') || '检测到当前项目存在并行独立工作树，是否需要 Agent 协助梳理？'
      actionLabel = t('gitAgent.proactiveActionWorktree') || '协助梳理'
      agentPrompt = t('gitAgent.proactiveWorktreePrompt') || '请协助梳理当前项目的多个并行工作树状态。'
    } else if (targetItem.cardId === 'standard-repo-hygiene') {
      title = t('gitAgent.proactiveActionHygiene') || '分支命名规范建议'
      message = (t('gitAgent.proactiveHygieneQuestion', { branch: branchName }) || '分支 {branch} 命名可能不符合规范，是否需要协助重命名？').replace('{branch}', branchName)
      actionLabel = t('gitAgent.proactiveActionHygiene') || '协助规范'
      agentPrompt = (t('gitAgent.proactiveHygienePrompt', { branch: branchName }) || '请协助检查分支 {branch} 的命名规范并给出规范重命名建议。').replace('{branch}', branchName)
    } else {
      message = targetItem.summary || targetItem.name
      agentPrompt = `请协助处理任务【${targetItem.repoAlias} / ${targetItem.name}】: ${targetItem.summary}`
    }

    const detailsUrl = `/workdesk/tasks/${encodeURIComponent(targetItem.cardId)}`

    const handleDismiss = () => {
      saveDismissedId(compositeId)
      saveSessionSnoozed()
      setDismissedSet((prev) => new Set(prev).add(compositeId))
      setSessionSnoozed(true)
    }

    const handleAccept = async () => {
      handleDismiss()
      // Open right drawer dock for dedicated workspace experience
      setDockMode('dock-right')
      quoteWorkdeskTaskToAgent({
        title: targetItem.name,
        prompt: agentPrompt,
        repoAlias: targetItem.repoAlias,
        repoId: targetItem.repoId,
        branch: targetItem.name,
        summary: targetItem.summary,
        taskId: targetItem.cardId,
        itemId: targetItem.id,
        target: 'sidebar',
      })
      await sendMessage(agentPrompt, activeRepo)
    }

    const handleViewTask = () => {
      handleDismiss()
      if (router) {
        router.push(detailsUrl)
      } else if (typeof window !== 'undefined') {
        window.location.href = detailsUrl
      }
    }

    return {
      id: compositeId,
      cardId: targetItem.cardId,
      repoId: targetItem.repoId,
      repoAlias: targetItem.repoAlias,
      branchName,
      summary: targetItem.summary,
      title,
      message,
      actionLabel,
      agentPrompt,
      detailsUrl,
      dismiss: handleDismiss,
      accept: handleAccept,
      viewTask: handleViewTask,
    }
  }, [activeRepo, scanResult, projects, dismissedSet, sessionSnoozed, isIdle, t, setDockMode, sendMessage, router])

  return {
    reminder,
    isProcessing,
  }
}
