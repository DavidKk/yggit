import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { ROOT_PATH } from '@/constants/paths'
import type { AddRemoteProjectOptions } from '@/lib/git/driver/types'
import { normalizeRemote, projectId } from '@/lib/git/identity'
import { isPrivateRemote } from '@/lib/git/project-access'
import { listRemoteGroup, remoteGroupLocation } from '@/lib/git/remote-groups'
import type { GitProjectCatalog, GitProjectGroup, GitProjectHost, GitProjectView, GitRemoteSource } from '@/lib/git/types'
import { assertSafeOutboundUrl } from '@/lib/security/ssrf'

import { discoverGitRepos } from './discover'

const execFileAsync = promisify(execFile)
const DIR = path.join(ROOT_PATH, 'data', 'git-projects')
const CATALOG = path.join(DIR, 'catalog.json')
const CREDENTIALS = path.join(DIR, 'credentials.json')
const LAST = path.join(DIR, 'last.json')
const DEFAULT_FOLDERS = ['工作项目', '个人项目'] as const
/** Used when the last folder is deleted but projects still need a home. Never equals a just-deleted name. */
const UNGROUPED_FOLDER = '未分类'

type StoredProject = {
  id: string
  name: string
  label?: string
  group: GitProjectGroup
  host: GitProjectHost
  remoteKey: string
  httpsUrl: string
  localPath: string
  credentialId: string
  remotes?: GitRemoteSource[]
}

type CatalogFile = {
  folders?: string[]
  projects?: StoredProject[]
}

type StoredCredential = {
  id: string
  host: Exclude<GitProjectHost, 'local'>
  baseUrl: string
  label: string
  token: string
}

type RemoteProject = {
  name: string
  remoteKey: string
  httpsUrl: string
  group: GitProjectGroup
  host: Exclude<GitProjectHost, 'local'>
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2))
}

function normalizeFolderName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function readCatalogFile(): CatalogFile {
  return readJson<CatalogFile>(CATALOG, {})
}

function readCatalog(): StoredProject[] {
  const parsed = readCatalogFile()
  return Array.isArray(parsed.projects) ? parsed.projects : []
}

function readFolders(): string[] {
  const parsed = readCatalogFile()
  const stored = Array.isArray(parsed.folders) ? parsed.folders.map(normalizeFolderName).filter(Boolean) : []
  const hasStoredFolders = Array.isArray(parsed.folders)
  const fromProjects = readCatalog()
    .map((item) => normalizeFolderName(item.group))
    .filter(Boolean)
  const merged: string[] = []
  // Seed defaults only on first run (no folders key yet). After that, respect deletions of 工作项目/个人项目.
  const seed = hasStoredFolders ? stored : [...DEFAULT_FOLDERS]
  for (const name of [...seed, ...fromProjects]) {
    if (name && !merged.includes(name)) merged.push(name)
  }
  return merged
}

function catalogWasCleared(): boolean {
  const parsed = readCatalogFile()
  return Array.isArray(parsed.folders) && parsed.folders.length === 0 && readCatalog().length === 0
}

function writeCatalog(projects: StoredProject[], folders = readFolders()) {
  const names: string[] = []
  for (const name of folders.map(normalizeFolderName).filter(Boolean)) {
    if (!names.includes(name)) names.push(name)
  }
  if (projects.length > 0 && names.length === 0) {
    names.push(UNGROUPED_FOLDER)
  }
  for (const project of projects) {
    let group = normalizeFolderName(project.group)
    // If no group is assigned, fallback to first available folder or 未分类
    if (!group) {
      group = names[0] || UNGROUPED_FOLDER
      project.group = group
      continue
    }
    project.group = group
    if (!names.includes(group)) names.push(group)
  }
  writeJson(CATALOG, { folders: names, projects })
}

function readCredentials(): StoredCredential[] {
  const parsed = readJson<{ credentials?: StoredCredential[] }>(CREDENTIALS, {})
  return Array.isArray(parsed.credentials) ? parsed.credentials : []
}

function writeCredentials(credentials: StoredCredential[]) {
  writeJson(CREDENTIALS, { credentials })
}

function toView(project: StoredProject): GitProjectView {
  return {
    id: project.id,
    // Local checkouts (incl. linked worktrees) show the folder name, not the shared remote repo name.
    name: project.localPath ? folderName(project.localPath) : project.name,
    label: project.label,
    group: project.group,
    host: project.host,
    localPath: project.localPath,
    httpsUrl: project.httpsUrl,
    local: Boolean(project.localPath),
    remote: Boolean(project.httpsUrl) || Boolean(project.remotes && project.remotes.length > 0),
    authorized: Boolean(project.credentialId),
    remotes: project.remotes,
  }
}

export function readLastOpenedRepo(): string {
  const parsed = readJson<{ path?: string }>(LAST, {})
  return typeof parsed.path === 'string' ? parsed.path.trim() : ''
}

export function writeLastOpenedRepo(repo: string) {
  const pathName = repo.trim()
  if (!pathName) return
  writeJson(LAST, { path: pathName })
}

export function listGitProjects(): GitProjectView[] {
  const folders = readFolders()
  const folderRank = new Map(folders.map((name, index) => [name, index]))
  // Keep catalog array order within a folder so drag-reorder can persist.
  return readCatalog()
    .map(toView)
    .slice()
    .sort((a, b) => (folderRank.get(a.group) ?? 999) - (folderRank.get(b.group) ?? 999))
}

export function listGitFolders(): string[] {
  return readFolders()
}

export function listGitCatalog(): GitProjectCatalog {
  return { projects: listGitProjects(), folders: listGitFolders() }
}

export function createGitFolder(name: string): GitProjectCatalog {
  const folder = normalizeFolderName(name)
  if (!folder) throw new Error('填写文件夹名称')
  if (folder.includes('/') || folder.includes('\\')) throw new Error('文件夹名称不能包含路径分隔符')
  const folders = readFolders()
  if (folders.includes(folder)) throw new Error('文件夹已存在')
  writeCatalog(readCatalog(), [...folders, folder])
  return listGitCatalog()
}

export function renameGitFolder(oldName: string, newName: string): GitProjectCatalog {
  const from = normalizeFolderName(oldName)
  const to = normalizeFolderName(newName)
  if (!from || !to) throw new Error('文件夹名称不能为空')
  if (to.includes('/') || to.includes('\\')) throw new Error('文件夹名称不能包含路径分隔符')
  if (from === to) return listGitCatalog()

  const folders = readFolders()
  if (folders.includes(to)) throw new Error('文件夹已存在')

  const projects = readCatalog()
  for (const p of projects) {
    if (normalizeFolderName(p.group) === from) {
      p.group = to
    }
  }

  const updatedFolders = folders.map((f) => (normalizeFolderName(f) === from ? to : f))
  writeCatalog(projects, updatedFolders)
  return listGitCatalog()
}

export function clearGitFolder(name: string): GitProjectCatalog {
  const folder = normalizeFolderName(name)
  if (!folder) throw new Error('选择文件夹')
  const projects = readCatalog()
  for (const p of projects) {
    if (normalizeFolderName(p.group) === folder) {
      p.group = UNGROUPED_FOLDER
    }
  }
  const folders = readFolders()
  if (!folders.includes(UNGROUPED_FOLDER)) folders.push(UNGROUPED_FOLDER)
  writeCatalog(projects, folders)
  return listGitCatalog()
}

export function setProjectLabel(id: string, label: string): GitProjectCatalog {
  const projects = readCatalog()
  const p = projects.find((item) => item.id === id)
  if (!p) throw new Error('找不到该项目')
  p.label = label.trim() || undefined
  writeCatalog(projects)
  return listGitCatalog()
}

export function moveGitProject(id: string, group: string, beforeId?: string): GitProjectCatalog {
  const folder = normalizeFolderName(group)
  if (!folder) throw new Error('选择文件夹')
  const projects = readCatalog()
  const index = projects.findIndex((item) => item.id === id)
  if (index < 0) throw new Error('找不到这个项目')
  const [project] = projects.splice(index, 1)
  project.group = folder
  const folders = readFolders()
  if (!folders.includes(folder)) folders.push(folder)

  const before = typeof beforeId === 'string' ? beforeId.trim() : ''
  if (before && before !== id) {
    const at = projects.findIndex((item) => item.id === before)
    if (at >= 0) {
      projects.splice(at, 0, project)
      writeCatalog(projects, folders)
      return listGitCatalog()
    }
  }

  // Insert at end of this group
  let lastInGroup = -1
  for (let i = 0; i < projects.length; i += 1) {
    if (normalizeFolderName(projects[i].group) === folder) {
      lastInGroup = i
    }
  }

  if (lastInGroup >= 0) {
    projects.splice(lastInGroup + 1, 0, project)
  } else {
    projects.push(project)
  }

  writeCatalog(projects, folders)
  return listGitCatalog()
}

/**
 * Prefer 个人项目 → 工作项目 → first remaining folder → 未分组.
 * Never returns `excluding` (so deleting 个人项目/工作项目 can actually stick).
 */
export function fallbackGitFolder(excluding: string, folders = readFolders()): string {
  const removed = normalizeFolderName(excluding)
  const rest = folders.map(normalizeFolderName).filter((name) => name && name !== removed)
  if (rest.includes('个人项目')) return '个人项目'
  if (rest.includes('工作项目')) return '工作项目'
  if (rest[0]) return rest[0]
  return removed === UNGROUPED_FOLDER ? '个人项目' : UNGROUPED_FOLDER
}

export function deleteGitFolder(name: string): GitProjectCatalog & { removedCount: number } {
  const folder = normalizeFolderName(name)
  if (!folder) throw new Error('选择文件夹')
  const before = readCatalog()
  const projects = before.filter((project) => normalizeFolderName(project.group) !== folder)
  const removedCount = before.length - projects.length
  // Persist deletion: do not re-seed 工作项目/个人项目 from DEFAULT_FOLDERS.
  const folders = readFolders().filter((item) => normalizeFolderName(item) !== folder)
  writeCatalog(projects, folders)
  return { ...listGitCatalog(), removedCount }
}

export function removeGitProject(id: string): GitProjectCatalog {
  const key = id.trim()
  if (!key) throw new Error('缺少项目')
  const projects = readCatalog()
  const next = projects.filter((item) => item.id !== key)
  if (next.length === projects.length) throw new Error('找不到这个项目')
  writeCatalog(next)
  return listGitCatalog()
}

function folderName(repo: string): string {
  const parts = repo.split('/').filter(Boolean)
  return parts[parts.length - 1] || repo
}

export async function originUrl(repo: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repo, 'remote', 'get-url', 'origin'], { timeout: 8000, encoding: 'utf8' })
    return stdout.trim()
  } catch {
    return ''
  }
}

export async function getProjectRemotes(repo: string): Promise<GitRemoteSource[]> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repo, 'remote', '-v'], { timeout: 8000, encoding: 'utf8' })
    const map = new Map<string, string>()
    for (const line of stdout.split('\n')) {
      const match = line.trim().match(/^([^\s]+)\s+([^\s]+)\s+\((?:fetch|push)\)$/)
      if (match && match[1] && match[2]) {
        if (!map.has(match[1])) {
          map.set(match[1], match[2])
        }
      }
    }
    return Array.from(map.entries()).map(([name, url]) => ({
      name,
      url,
      isPrivate: isPrivateRemote(url),
    }))
  } catch {
    return []
  }
}

export async function rememberLocalProject(repo: string, options?: { create?: boolean }): Promise<GitProjectView> {
  const absolute = path.resolve(repo.trim())
  const origin = await originUrl(absolute)
  const remote = normalizeRemote(origin)
  const remotesList = await getProjectRemotes(absolute)
  const projects = readCatalog()
  const label = folderName(absolute)
  // Identity is the local worktree path. Linked worktrees share origin but must stay distinct.
  const byPath = projects.find((item) => item.localPath === absolute)
  if (byPath) {
    byPath.name = label
    if (remote) {
      byPath.remoteKey = remote.key
      byPath.httpsUrl = remote.httpsUrl
      byPath.host = remote.kind
    }
    if (remotesList.length > 0) {
      byPath.remotes = remotesList
    }
    writeCatalog(projects)
    return toView(byPath)
  }

  // First local checkout may claim a remote-only catalog row; later worktrees create new rows.
  const remoteOnly = remote ? projects.find((item) => item.remoteKey === remote.key && !item.localPath) : undefined
  if (remoteOnly && remote) {
    remoteOnly.localPath = absolute
    remoteOnly.name = label
    remoteOnly.host = remote.kind
    remoteOnly.httpsUrl = remote.httpsUrl
    if (remotesList.length > 0) {
      remoteOnly.remotes = remotesList
    }
    writeCatalog(projects)
    return toView(remoteOnly)
  }

  // User wiped the switcher (folders: [] + no projects): stay empty until they explicitly add again.
  // `create: true` is for 添加本地 / import, which may rebuild after a wipe.
  if (catalogWasCleared() && options?.create !== true) {
    return {
      id: projectId(`local:${absolute}`),
      name: label,
      group: '',
      host: remote?.kind || 'local',
      localPath: absolute,
      httpsUrl: remote?.httpsUrl || '',
      local: true,
      remote: Boolean(remote?.httpsUrl) || remotesList.length > 0,
      authorized: false,
      remotes: remotesList.length > 0 ? remotesList : undefined,
    }
  }

  const folders = readFolders()
  const home = folders[0] || UNGROUPED_FOLDER
  const created: StoredProject = {
    id: projectId(`local:${absolute}`),
    name: label,
    group: home,
    host: remote?.kind || 'local',
    remoteKey: remote?.key || '',
    httpsUrl: remote?.httpsUrl || '',
    localPath: absolute,
    credentialId: '',
    remotes: remotesList.length > 0 ? remotesList : undefined,
  }
  projects.push(created)
  writeCatalog(projects, folders.length > 0 ? folders : [home])
  return toView(created)
}

/** Import one or more picked folders; optionally sniff nested Git repos. */
export async function importLocalProjects(input: {
  paths: string[]
  discover?: boolean
}): Promise<{ imported: GitProjectView[]; projects: GitProjectView[]; folders: string[]; openPath: string }> {
  const roots = [...new Set(input.paths.map((item) => item.trim()).filter(Boolean))]
  if (roots.length === 0) throw new Error('请选择至少一个文件夹')
  const repos = input.discover === false ? roots : discoverGitRepos(roots)
  if (repos.length === 0) throw new Error('这些文件夹下没有找到 Git 仓库')
  const imported: GitProjectView[] = []
  for (const repo of repos) {
    imported.push(await rememberLocalProject(repo, { create: true }))
  }
  const openPath = imported[imported.length - 1]?.localPath || repos[repos.length - 1]
  return { imported, ...listGitCatalog(), openPath }
}

function upsertRemote(projects: StoredProject[], remote: RemoteProject, credentialId: string) {
  const id = projectId(remote.remoteKey)
  const existing = projects.find((item) => item.id === id || item.remoteKey === remote.remoteKey)
  if (existing) {
    existing.remoteKey = remote.remoteKey
    existing.httpsUrl = remote.httpsUrl
    existing.host = remote.host
    if (credentialId) existing.credentialId = credentialId
    if (!existing.name) existing.name = remote.name
    // Keep the user's folder assignment when syncing.
    return
  }
  projects.push({
    id,
    name: remote.name,
    group: remote.group,
    host: remote.host,
    remoteKey: remote.remoteKey,
    httpsUrl: remote.httpsUrl,
    localPath: '',
    credentialId,
  })
}

function scrub(message: string, token: string): string {
  return token ? message.split(token).join('***') : message
}

async function fetchJson(url: string, headers: Record<string, string>, token: string): Promise<unknown> {
  const safeUrl = await assertSafeOutboundUrl(url)
  const response = await fetch(safeUrl.toString(), { headers, redirect: 'error', signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(scrub(`授权失败（${response.status}）`, token))
  return response.json()
}

async function listRemoteProjects(host: Exclude<GitProjectHost, 'local'>, baseUrl: string, token: string): Promise<RemoteProject[]> {
  const root = baseUrl.replace(/\/$/, '')
  const found: RemoteProject[] = []
  if (host === 'gitlab') {
    for (let page = 1; page <= 3; page += 1) {
      const body = (await fetchJson(`${root}/api/v4/projects?membership=true&simple=true&per_page=50&page=${page}`, { 'PRIVATE-TOKEN': token }, token)) as Array<{
        name?: string
        path_with_namespace?: string
        http_url_to_repo?: string
        namespace?: { kind?: string }
      }>
      if (!Array.isArray(body) || body.length === 0) break
      for (const item of body) {
        const remote = normalizeRemote(String(item.http_url_to_repo || ''))
        if (!remote) continue
        found.push({
          name: item.name || remote.name,
          remoteKey: remote.key,
          httpsUrl: remote.httpsUrl,
          host: 'gitlab',
          group: item.namespace?.kind === 'user' ? '个人项目' : '工作项目',
        })
      }
      if (body.length < 50) break
    }
    return found
  }
  const api = root === 'https://github.com' ? 'https://api.github.com' : `${root}/api/v3`
  for (let page = 1; page <= 3; page += 1) {
    const body = (await fetchJson(
      `${api}/user/repos?per_page=50&page=${page}&affiliation=owner,collaborator,organization_member`,
      { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'yggdrasil' },
      token
    )) as Array<{
      name?: string
      clone_url?: string
      owner?: { type?: string }
    }>
    if (!Array.isArray(body) || body.length === 0) break
    for (const item of body) {
      const remote = normalizeRemote(String(item.clone_url || ''))
      if (!remote) continue
      found.push({
        name: item.name || remote.name,
        remoteKey: remote.key,
        httpsUrl: remote.httpsUrl,
        host: 'github',
        group: item.owner?.type === 'Organization' ? '工作项目' : '个人项目',
      })
    }
    if (body.length < 50) break
  }
  return found
}

function baseUrlForHost(host: string): string {
  return `https://${host.toLowerCase().replace(/\/$/, '')}`
}

function findCredential(host: Exclude<GitProjectHost, 'local'>, baseUrl: string): StoredCredential | undefined {
  const root = baseUrl.replace(/\/$/, '')
  return readCredentials().find((item) => item.host === host && item.baseUrl === root)
}

async function saveCredential(input: { host: Exclude<GitProjectHost, 'local'>; baseUrl: string; token: string }): Promise<StoredCredential> {
  const token = input.token.trim()
  const baseUrl = input.baseUrl.trim().replace(/\/$/, '')
  if (!token) throw new Error('填写 Access Token')
  if (!/^https:\/\//i.test(baseUrl)) throw new Error('服务地址需要以 https:// 开头')
  const userProbe = input.host === 'gitlab' ? `${baseUrl}/api/v4/user` : baseUrl === 'https://github.com' ? 'https://api.github.com/user' : `${baseUrl}/api/v3/user`
  const headers: Record<string, string> =
    input.host === 'gitlab' ? { 'PRIVATE-TOKEN': token } : { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'yggdrasil' }
  const user = (await fetchJson(userProbe, headers, token)) as { username?: string; login?: string }
  const credentials = readCredentials()
  const existing = findCredential(input.host, baseUrl)
  const credential: StoredCredential = existing || { id: projectId(`${input.host}:${baseUrl}:${Date.now()}`), host: input.host, baseUrl, label: '', token: '' }
  credential.token = token
  credential.label = user.username || user.login || baseUrl
  if (!existing) credentials.push(credential)
  writeCredentials(credentials)
  return credential
}

export async function authorizeGitHost(input: { host: Exclude<GitProjectHost, 'local'>; baseUrl: string; token: string }): Promise<GitProjectCatalog> {
  const baseUrl = input.baseUrl.trim().replace(/\/$/, '')
  const credential = await saveCredential({ host: input.host, baseUrl, token: input.token })
  const projects = await listRemoteProjects(input.host, baseUrl, credential.token)
  const catalog = readCatalog()
  for (const remote of projects) upsertRemote(catalog, remote, credential.id)
  writeCatalog(catalog)
  return listGitCatalog()
}

/** Add one remote by URL; optional token for private hosts; syncAccount lists every repo on that host. */
export async function addRemoteProject(input: AddRemoteProjectOptions): Promise<GitProjectCatalog & { projectId: string }> {
  if (input.importGroup) {
    if (input.provider !== 'github' && input.provider !== 'gitlab') throw new Error('REMOTE_GROUP_INVALID_PROVIDER')
    const group = normalizeFolderName(input.group || '')
    if (!group) throw new Error('REMOTE_GROUP_FOLDER_REQUIRED')
    const location = remoteGroupLocation({ ...input, provider: input.provider })
    const existingCredential = findCredential(input.provider, location.origin)
    const token = input.token?.trim() || existingCredential?.token
    const remotes = await listRemoteGroup({ ...input, provider: input.provider, token })
    if (!remotes.length) throw new Error('REMOTE_GROUP_EMPTY')
    const credential = token && input.token?.trim() ? await saveCredential({ host: input.provider, baseUrl: location.origin, token }) : existingCredential
    const catalog = readCatalog()
    for (const remote of remotes) {
      upsertRemote(catalog, { ...remote, group }, credential?.id || '')
      const project = catalog.find((item) => item.remoteKey === remote.remoteKey)
      if (project) project.group = group
    }
    writeCatalog(catalog, [...new Set([...readFolders(), group])])
    return { ...listGitCatalog(), projectId: projectId(remotes[0].remoteKey) }
  }
  const remote = normalizeRemote(input.url)
  if (!remote) throw new Error('填写有效的仓库地址（https 或 git@）')
  const baseUrl = baseUrlForHost(remote.host)
  const token = input.token?.trim() || ''
  let credential = findCredential(remote.kind, baseUrl)
  if (token) credential = await saveCredential({ host: remote.kind, baseUrl, token })
  if (input.syncAccount) {
    if (!credential?.token) throw new Error('同步账号需要 Access Token')
    const catalog = await authorizeGitHost({ host: remote.kind, baseUrl, token: credential.token })
    return { ...catalog, projectId: projectId(remote.key) }
  }
  const catalog = readCatalog()
  const folders = readFolders()
  const targetGroup = folders[0] || UNGROUPED_FOLDER
  upsertRemote(
    catalog,
    {
      name: remote.name,
      remoteKey: remote.key,
      httpsUrl: remote.httpsUrl,
      host: remote.kind,
      group: targetGroup,
    },
    credential?.id || ''
  )
  writeCatalog(catalog, folders.length > 0 ? folders : [targetGroup])
  return { ...listGitCatalog(), projectId: projectId(remote.key) }
}

export async function cloneGitProject(id: string, parent: string): Promise<string> {
  const projects = readCatalog()
  const project = projects.find((item) => item.id === id)
  if (!project?.httpsUrl) throw new Error('这个项目没有远程地址')
  const credential = project.credentialId ? readCredentials().find((item) => item.id === project.credentialId) : undefined
  const destParent = parent.trim()
  if (!destParent) throw new Error('选择保存位置')
  const dest = path.join(destParent, project.name)
  if (fs.existsSync(dest)) throw new Error('目标文件夹已存在')
  const token = credential?.token || ''
  const args = token ? ['-c', `http.extraheader=Authorization: Bearer ${token}`, 'clone', '--', project.httpsUrl, dest] : ['clone', '--', project.httpsUrl, dest]
  try {
    await execFileAsync('git', args, { timeout: 120000, encoding: 'utf8' })
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: string }).stderr || '') : ''
    const hint = token ? scrub(stderr || '克隆失败', token) : `${stderr || '克隆失败'}。私有库请先在「添加远程」里填写 Access Token。`
    throw new Error(hint.trim() || '克隆失败')
  }
  project.localPath = dest
  writeCatalog(projects)
  return dest
}
