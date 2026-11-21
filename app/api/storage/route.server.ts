import fs from 'node:fs'
import path from 'node:path'

import { DATA_DIR } from '@/constants/paths'
import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest, apiOk } from '@/initializer/response'
import { requireDisk } from '@/services/disk-ops'

export const runtime = 'nodejs'

export interface StorageCategoryItem {
  name: string
  label: string
  desc: string
  path: string
  bytes: number
  clearable: boolean
}

export interface LocalStorageInfo {
  isLocal: boolean
  dataPath: string
  totalBytes: number
  items: StorageCategoryItem[]
  [key: string]: unknown
}

const KNOWN_CATEGORIES: Record<string, { label: string; desc: string; clearable: boolean }> = {
  'git-conflicts': {
    label: '冲突分析与三方合并缓存',
    desc: '本地 Git 冲突预检、三方合并比对和已解析状态的历史缓存',
    clearable: true,
  },
  'git-projects': {
    label: '本地项目索引与配置',
    desc: '本地仓库列表、分组架构及 Git 访问凭据配置',
    clearable: false,
  },
  'git-marks': {
    label: '分支与提交标记',
    desc: '自定义提交书签、分支别名与高亮标记数据',
    clearable: false,
  },
  'translate-cache': {
    label: '本地翻译缓存',
    desc: '多语言词条离线翻译缓存',
    clearable: true,
  },
  'translate-jobs': {
    label: '翻译任务队列',
    desc: '离线翻译任务记录与队列状态',
    clearable: true,
  },
  shell: {
    label: '终端会话缓存',
    desc: '本地交互式终端进程历史会话缓存',
    clearable: true,
  },
}

function getDirectorySize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0
  try {
    const stat = fs.statSync(dirPath)
    if (!stat.isDirectory()) return stat.size
    let total = 0
    const files = fs.readdirSync(dirPath)
    for (const file of files) {
      const fullPath = path.join(dirPath, file)
      try {
        const fileStat = fs.statSync(fullPath)
        if (fileStat.isDirectory()) {
          total += getDirectorySize(fullPath)
        } else {
          total += fileStat.size
        }
      } catch {
        // ignore unreadable files
      }
    }
    return total
  } catch {
    return 0
  }
}

function clearDirectoryContents(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return
  const files = fs.readdirSync(dirPath)
  for (const file of files) {
    if (file === '.gitkeep') continue
    const fullPath = path.join(dirPath, file)
    try {
      fs.rmSync(fullPath, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}

export const GET = defineApiRoute('get:/api/storage', async () => {
  const denied = requireDisk()
  if (denied) return denied

  const dataDir = DATA_DIR
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true })
    } catch {
      // ignore
    }
  }

  const items: StorageCategoryItem[] = []
  let totalBytes = 0

  if (fs.existsSync(dataDir)) {
    const entries = fs.readdirSync(dataDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.gitkeep') continue
      const fullPath = path.join(dataDir, entry.name)
      if (entry.isDirectory()) {
        const bytes = getDirectorySize(fullPath)
        totalBytes += bytes
        const meta = KNOWN_CATEGORIES[entry.name] || {
          label: entry.name,
          desc: '本地数据与运行时缓存',
          clearable: false,
        }
        items.push({
          name: entry.name,
          label: meta.label,
          desc: meta.desc,
          path: fullPath,
          bytes,
          clearable: meta.clearable,
        })
      }
    }
  }

  // Sort: non-zero bytes first, then alphabetically
  items.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))

  const info: LocalStorageInfo = {
    isLocal: true,
    dataPath: dataDir,
    totalBytes,
    items,
  }

  return apiOk(info)
})

export const POST = defineApiRoute('post:/api/storage', async ({ request }) => {
  const denied = requireDisk()
  if (denied) return denied

  const body = (await request.json().catch(() => ({}))) as {
    action?: 'clearCache' | 'clearItem'
    name?: string
  }

  const dataDir = DATA_DIR

  if (body.action === 'clearCache') {
    // Clear all clearable cache directories
    for (const [name, meta] of Object.entries(KNOWN_CATEGORIES)) {
      if (meta.clearable) {
        clearDirectoryContents(path.join(dataDir, name))
      }
    }
    return apiOk({ success: true })
  }

  if (body.action === 'clearItem' && body.name) {
    const meta = KNOWN_CATEGORIES[body.name]
    if (!meta || !meta.clearable) {
      return apiBadRequest('该目录不支持清理或为关键配置数据')
    }
    clearDirectoryContents(path.join(dataDir, body.name))
    return apiOk({ success: true })
  }

  return apiBadRequest('未知操作类型')
})
