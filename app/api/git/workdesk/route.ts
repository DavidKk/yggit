import fs from 'node:fs'
import path from 'node:path'

import { DATA_DIR } from '@/constants/paths'
import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest, apiOk } from '@/initializer/response'
import type { WorkdeskStoreData } from '@/lib/workdesk/types'

export const runtime = 'nodejs'

const WORKDESK_DIR = path.join(DATA_DIR, 'git-workdesk')
const WORKDESK_FILE = path.join(WORKDESK_DIR, 'workdesk-store.json')

function ensureDir() {
  if (!fs.existsSync(WORKDESK_DIR)) {
    fs.mkdirSync(WORKDESK_DIR, { recursive: true })
  }
}

function matchesRepoFilter(entry: { repoId?: string; repoAlias?: string }, repo: string): boolean {
  const lower = repo.trim().toLowerCase()
  if (!lower) return true
  const id = (entry.repoId || '').toLowerCase()
  const alias = (entry.repoAlias || '').toLowerCase()
  if (id === lower || alias === lower) return true
  if (alias && (lower.endsWith(`/${alias}`) || lower.endsWith(`\\${alias}`))) return true
  const segments = lower.split(/[/\\?#]/).filter(Boolean)
  return Boolean((alias && segments.includes(alias)) || (id && segments.includes(id)))
}

function filterStoreByRepo(store: WorkdeskStoreData, repo: string): WorkdeskStoreData {
  const findings = Array.isArray(store.findings) ? store.findings.filter((f) => matchesRepoFilter(f, repo)) : []
  const items = Array.isArray(store.items) ? store.items.filter((item) => matchesRepoFilter(item, repo)) : []
  const allowedItemIds = new Set(items.map((item) => item.id))
  const cards = Array.isArray(store.cards)
    ? store.cards.map((card) => ({ ...card, itemIds: card.itemIds.filter((id) => allowedItemIds.has(id)) })).filter((card) => card.itemIds.length > 0)
    : []
  return { ...store, findings, items, cards }
}

export const GET = defineApiRoute('get:/api/git/workdesk', async ({ request }) => {
  try {
    if (!fs.existsSync(WORKDESK_FILE)) {
      return apiOk({ data: null })
    }
    const raw = fs.readFileSync(WORKDESK_FILE, 'utf8')
    const data = JSON.parse(raw) as WorkdeskStoreData
    const repo = new URL(request.url).searchParams.get('repo')?.trim()
    return apiOk({ data: repo ? filterStoreByRepo(data, repo) : data })
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '读取工作台数据失败')
  }
})

export const POST = defineApiRoute('post:/api/git/workdesk', async ({ request }) => {
  try {
    const data = (await request.json()) as WorkdeskStoreData
    ensureDir()
    fs.writeFileSync(WORKDESK_FILE, JSON.stringify(data), 'utf8')
    return apiOk({ ok: true })
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '保存工作台数据失败')
  }
})

export const DELETE = defineApiRoute('delete:/api/git/workdesk', async () => {
  try {
    if (fs.existsSync(WORKDESK_FILE)) {
      fs.unlinkSync(WORKDESK_FILE)
    }
    return apiOk({ ok: true })
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '清理工作台数据失败')
  }
})
