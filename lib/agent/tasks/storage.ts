import { TASKS_DATABASE } from '@/lib/storage/databases'

import type { AgentTask, AgentTaskStep } from './types'

const memoryTasks: AgentTask[] = []
type TasksListener = () => void
const listeners = new Set<TasksListener>()

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      // Ignore
    }
  }
}

function openTasksDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(TASKS_DATABASE, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('agent_tasks')) {
          const store = db.createObjectStore('agent_tasks', { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt')
          store.createIndex('status', 'status')
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function createTask(params: { title: string; prompt: string; model: string; repo?: string }): Promise<AgentTask> {
  const task: AgentTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: params.title,
    prompt: params.prompt,
    status: 'running',
    repo: params.repo,
    model: params.model,
    createdAt: Date.now(),
    steps: [],
  }

  memoryTasks.unshift(task)
  if (memoryTasks.length > 200) memoryTasks.pop()

  const db = await openTasksDb()
  if (db) {
    try {
      const tx = db.transaction('agent_tasks', 'readwrite')
      tx.objectStore('agent_tasks').put(task)
    } catch {
      // Ignore
    }
  }

  notifyListeners()
  return task
}

export async function addStepToTask(taskId: string, step: Omit<AgentTaskStep, 'id' | 'timestamp'>): Promise<void> {
  const fullStep: AgentTaskStep = {
    ...step,
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  }

  const target = memoryTasks.find((t) => t.id === taskId)
  if (target) {
    target.steps.push(fullStep)
  }

  const db = await openTasksDb()
  if (db && target) {
    try {
      const tx = db.transaction('agent_tasks', 'readwrite')
      tx.objectStore('agent_tasks').put(target)
    } catch {
      // Ignore
    }
  }

  notifyListeners()
}

export async function completeTask(
  taskId: string,
  result?: {
    tokenUsage?: { promptTokens: number; completionTokens: number; cachedTokens?: number; totalTokens: number }
  }
): Promise<void> {
  const target = memoryTasks.find((t) => t.id === taskId)
  if (target) {
    target.status = 'completed'
    target.completedAt = Date.now()
    target.durationMs = target.completedAt - target.createdAt
    if (result?.tokenUsage) target.tokenUsage = result.tokenUsage
  }

  const db = await openTasksDb()
  if (db && target) {
    try {
      const tx = db.transaction('agent_tasks', 'readwrite')
      tx.objectStore('agent_tasks').put(target)
    } catch {
      // Ignore
    }
  }

  notifyListeners()
}

export async function failTask(taskId: string, error: string): Promise<void> {
  const target = memoryTasks.find((t) => t.id === taskId)
  if (target) {
    target.status = 'failed'
    target.completedAt = Date.now()
    target.durationMs = target.completedAt - target.createdAt
    target.error = error
  }

  const db = await openTasksDb()
  if (db && target) {
    try {
      const tx = db.transaction('agent_tasks', 'readwrite')
      tx.objectStore('agent_tasks').put(target)
    } catch {
      // Ignore
    }
  }

  notifyListeners()
}

export async function listTasks(limit = 100): Promise<AgentTask[]> {
  const db = await openTasksDb()
  if (!db) return [...memoryTasks].slice(0, limit)

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('agent_tasks', 'readonly')
      const store = tx.objectStore('agent_tasks')
      const index = store.index('createdAt')
      const req = index.openCursor(null, 'prev')
      const list: AgentTask[] = []

      req.onsuccess = () => {
        const cursor = req.result
        if (cursor && list.length < limit) {
          list.push(cursor.value)
          cursor.continue()
        } else {
          // Sync with memory
          for (const item of list) {
            if (!memoryTasks.some((t) => t.id === item.id)) {
              memoryTasks.push(item)
            }
          }
          resolve(list)
        }
      }
      req.onerror = () => resolve([...memoryTasks].slice(0, limit))
    } catch {
      resolve([...memoryTasks].slice(0, limit))
    }
  })
}

export async function clearAllTasks(): Promise<void> {
  memoryTasks.length = 0
  const db = await openTasksDb()
  if (db) {
    try {
      const tx = db.transaction('agent_tasks', 'readwrite')
      tx.objectStore('agent_tasks').clear()
    } catch {
      // Ignore
    }
  }
  notifyListeners()
}

export function subscribeTasks(listener: TasksListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
