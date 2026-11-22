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

export const GET = defineApiRoute('get:/api/git/workdesk', async () => {
  try {
    if (!fs.existsSync(WORKDESK_FILE)) {
      return apiOk({ data: null })
    }
    const raw = fs.readFileSync(WORKDESK_FILE, 'utf8')
    const data = JSON.parse(raw)
    return apiOk({ data })
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '读取工作台数据失败')
  }
})

export const POST = defineApiRoute('post:/api/git/workdesk', async ({ request }) => {
  try {
    const data = (await request.json()) as WorkdeskStoreData
    ensureDir()
    fs.writeFileSync(WORKDESK_FILE, JSON.stringify(data, null, 2), 'utf8')
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
