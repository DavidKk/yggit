import { defineApiRoute } from '@/initializer/controller'
import { apiBadRequest } from '@/initializer/response'
import {
  addRemoteProject,
  clearGitFolder,
  createGitFolder,
  deleteGitFolder,
  importLocalProjects,
  listGitCatalog,
  moveGitProject,
  rememberLocalProject,
  removeGitProject,
  renameGitFolder,
  setProjectLabel,
} from '@/services/git/projects'
import { resolveGitRepo } from '@/services/git/read'

export const runtime = 'nodejs'

export const GET = defineApiRoute('get:/api/git/projects', async () => {
  return listGitCatalog()
})

export const POST = defineApiRoute('post:/api/git/projects', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as {
    action?: unknown
    folder?: unknown
    group?: unknown
    id?: unknown
    name?: unknown
    label?: unknown
    beforeId?: unknown
    path?: unknown
    paths?: unknown
    discover?: unknown
    url?: unknown
    token?: unknown
    syncAccount?: unknown
  } | null
  try {
    if (body?.action === 'createFolder') {
      return createGitFolder(String(body.folder || ''))
    }
    if (body?.action === 'renameFolder') {
      return renameGitFolder(String(body.folder || ''), String(body.name || ''))
    }
    if (body?.action === 'clearFolder') {
      return clearGitFolder(String(body.folder || ''))
    }
    if (body?.action === 'setProjectLabel') {
      return setProjectLabel(String(body.id || ''), String(body.label || ''))
    }
    if (body?.action === 'deleteFolder') {
      return deleteGitFolder(String(body.folder || ''))
    }
    if (body?.action === 'moveProject') {
      return moveGitProject(String(body.id || ''), String(body.group || ''), typeof body.beforeId === 'string' ? body.beforeId : undefined)
    }
    if (body?.action === 'removeProject') {
      return removeGitProject(String(body.id || ''))
    }
    if (typeof body?.url === 'string' && body.url.trim()) {
      const result = await addRemoteProject({
        url: body.url,
        token: typeof body.token === 'string' ? body.token : undefined,
        syncAccount: body.syncAccount === true,
      })
      return { projects: result.projects, folders: result.folders, projectId: result.projectId }
    }
    const many = Array.isArray(body?.paths)
      ? body.paths.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : typeof body?.path === 'string' && body.path.trim()
        ? [body.path]
        : []
    if (many.length > 0) {
      const result = await importLocalProjects({ paths: many, discover: body?.discover !== false })
      return {
        project: result.imported[result.imported.length - 1],
        imported: result.imported,
        projects: result.projects,
        folders: result.folders,
        openPath: result.openPath,
        count: result.imported.length,
      }
    }
    const repo = await resolveGitRepo(typeof body?.path === 'string' ? body.path : undefined)
    const project = await rememberLocalProject(repo)
    const catalog = listGitCatalog()
    return { project, projects: catalog.projects, folders: catalog.folders, openPath: project.localPath, count: 1 }
  } catch (error) {
    return apiBadRequest(error instanceof Error ? error.message : '无法添加仓库')
  }
})
