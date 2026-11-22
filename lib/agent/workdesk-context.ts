/**
 * Workdesk Context Bridge for Git Agent.
 * Adheres to docs/technical/yggit-workdesk-architecture.md §6.1
 */

import { useEffect, useState } from 'react'

export interface WorkdeskContextPayload {
  source: 'workdesk'
  taskId: string
  taskTitle: string
  activeItemId?: string
  repoIdentity: string
  repoAlias: string
  targetRef?: string
  evidenceCommits: string[]
  evidencePaths: string[]
  state: 'safe' | 'warn' | 'bad'
  summary: string
}

const WORKDESK_CONTEXT_EVENT = 'yggit:workdesk_context_changed'

let currentWorkdeskContext: WorkdeskContextPayload | null = null

export function setWorkdeskContext(payload: WorkdeskContextPayload | null): void {
  currentWorkdeskContext = payload
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKDESK_CONTEXT_EVENT, { detail: payload }))
  }
}

export function getWorkdeskContext(): WorkdeskContextPayload | null {
  return currentWorkdeskContext
}

export function useWorkdeskContext(): WorkdeskContextPayload | null {
  const [context, setContext] = useState<WorkdeskContextPayload | null>(currentWorkdeskContext)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<WorkdeskContextPayload | null>).detail
      setContext(detail)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(WORKDESK_CONTEXT_EVENT, handler)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(WORKDESK_CONTEXT_EVENT, handler)
      }
    }
  }, [])

  return context
}
