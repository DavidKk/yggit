import { SKILLS_DATABASE } from '@/lib/storage/databases'

import { PRESET_SKILLS } from './presets'
import type { SkillDescriptor } from './types'

let memorySkills: SkillDescriptor[] | null = null
type SkillsChangeListener = () => void
const listeners = new Set<SkillsChangeListener>()

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      // Ignore
    }
  }
}

function openSkillsDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(SKILLS_DATABASE, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('skills')) {
          db.createObjectStore('skills', { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function listSkills(): Promise<SkillDescriptor[]> {
  const db = await openSkillsDb()
  if (!db) {
    if (!memorySkills) memorySkills = [...PRESET_SKILLS]
    return memorySkills
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('skills', 'readonly')
      const store = tx.objectStore('skills')
      const req = store.getAll()
      req.onsuccess = async () => {
        let skills = req.result as SkillDescriptor[]
        if (!skills || skills.length === 0) {
          // Initialize with presets
          await initializePresetSkills()
          skills = [...PRESET_SKILLS]
        }
        memorySkills = skills
        resolve(skills)
      }
      req.onerror = () => resolve([...PRESET_SKILLS])
    } catch {
      resolve([...PRESET_SKILLS])
    }
  })
}

export async function initializePresetSkills(): Promise<void> {
  const db = await openSkillsDb()
  if (!db) return
  try {
    const tx = db.transaction('skills', 'readwrite')
    const store = tx.objectStore('skills')
    for (const preset of PRESET_SKILLS) {
      store.put(preset)
    }
  } catch {
    // Ignore
  }
}

export async function saveSkill(skill: SkillDescriptor): Promise<void> {
  const updated: SkillDescriptor = {
    ...skill,
    updatedAt: Date.now(),
  }

  const db = await openSkillsDb()
  if (db) {
    try {
      const tx = db.transaction('skills', 'readwrite')
      tx.objectStore('skills').put(updated)
    } catch {
      // Fallback
    }
  }

  if (memorySkills) {
    const idx = memorySkills.findIndex((s) => s.id === updated.id)
    if (idx !== -1) {
      memorySkills[idx] = updated
    } else {
      memorySkills.push(updated)
    }
  }

  notifyListeners()
}

export async function deleteSkill(id: string): Promise<void> {
  const db = await openSkillsDb()
  if (db) {
    try {
      const tx = db.transaction('skills', 'readwrite')
      tx.objectStore('skills').delete(id)
    } catch {
      // Fallback
    }
  }

  if (memorySkills) {
    memorySkills = memorySkills.filter((s) => s.id !== id)
  }

  notifyListeners()
}

export async function toggleSkill(id: string, enabled: boolean): Promise<void> {
  const skills = await listSkills()
  const target = skills.find((s) => s.id === id)
  if (!target) return
  await saveSkill({ ...target, enabled })
}

export function subscribeSkills(listener: SkillsChangeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
