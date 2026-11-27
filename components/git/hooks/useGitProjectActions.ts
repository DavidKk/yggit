'use client'

import type { Dispatch, SetStateAction } from 'react'

import type { useT } from '@/components/i18n/LocaleProvider'
import { readApiErrorMessage } from '@/lib/api-error'
import { getDriverMode, getGitDriver } from '@/lib/git/driver'
import type { AddRemoteProjectOptions } from '@/lib/git/driver/types'
import { isFileSystemAccessSupported } from '@/lib/git/indexeddb-handles'
import type { GitCommit, GitLogView, GitProjectView, GitSelection } from '@/lib/git/types'

export function useGitProjectActions({
  view,
  scope,
  t,
  notification,
  applyCatalog,
  refreshProjects,
  closeMenu,
  load,
  setPicking,
  setBusy,
  setProgressStage,
  setError,
  setView,
  setCommits,
  setHasMore,
  setSelection,
  setSelectedHash,
  setSelectedFile,
}: {
  view: GitLogView | null
  scope: string
  t: ReturnType<typeof useT>
  notification: { success: (msg: string) => void; error: (msg: string) => void }
  applyCatalog: (body: { projects?: GitProjectView[]; folders?: string[] }) => void
  refreshProjects: () => Promise<void>
  closeMenu: () => void
  load: (repo: string) => Promise<void>
  setPicking: Dispatch<SetStateAction<boolean>>
  setBusy: Dispatch<SetStateAction<boolean>>
  setProgressStage: Dispatch<SetStateAction<string>>
  setError: Dispatch<SetStateAction<string>>
  setView: Dispatch<SetStateAction<GitLogView | null>>
  setCommits: Dispatch<SetStateAction<GitCommit[]>>
  setHasMore: Dispatch<SetStateAction<boolean>>
  setSelection: (next: GitSelection) => void
  setSelectedHash: Dispatch<SetStateAction<string>>
  setSelectedFile: Dispatch<SetStateAction<string>>
}) {
  function reportError(message: string) {
    setError(message)
    if (message) notification.error(message)
  }

  async function pickFolders(prompt: string, multiple = false) {
    setPicking(true)
    try {
      const response = await fetch('/api/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'folder', prompt, multiple }),
      })
      const body = (await response.json()) as { ok?: boolean; path?: string; paths?: string[]; cancelled?: boolean }
      if (body.cancelled) return [] as string[]
      const paths = Array.isArray(body.paths)
        ? body.paths.map((item) => String(item || '').trim()).filter(Boolean)
        : String(body.path || '').trim()
          ? [String(body.path).trim()]
          : []
      if (!response.ok || body.ok === false || paths.length === 0) {
        reportError(
          getDriverMode() === 'edge' && (!response.ok || body.ok === false) ? t('git.errors.unsupportedFileSystemAccess') : readApiErrorMessage(body, t('git.errors.openFolder'))
        )
        return [] as string[]
      }
      return paths
    } catch {
      reportError(getDriverMode() === 'edge' ? t('git.errors.unsupportedFileSystemAccess') : t('git.errors.openFolder'))
      return [] as string[]
    } finally {
      setPicking(false)
    }
  }

  async function pickFolder(prompt: string) {
    const paths = await pickFolders(prompt, false)
    return paths[0] || ''
  }

  async function chooseFolder() {
    setError('')
    if (getDriverMode() === 'edge') {
      if (isFileSystemAccessSupported() && window.showDirectoryPicker) {
        try {
          const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
          if (handle) {
            setBusy(true)
            setProgressStage('Scanning Git repositories...')
            const { discoverEdgeGitRepos } = await import('@/lib/git/driver/edge-discover')
            const discovered = await discoverEdgeGitRepos(handle)
            if (discovered.length === 0) {
              reportError(t('git.errors.noReposFound'))
              return
            }

            const driver = getGitDriver('edge')
            let firstProject: GitProjectView | null = null
            let importedCount = 0

            for (const repo of discovered) {
              try {
                const project = await driver.addProject({
                  pathOrUrl: repo.relativePath,
                  handle: repo.handle,
                  name: repo.name,
                })
                if (!firstProject) firstProject = project
                importedCount++
              } catch {
                // Skip individual invalid or duplicate repo entries
              }
            }

            if (!firstProject) {
              reportError(t('git.errors.noReposFound'))
              return
            }

            await refreshProjects()
            closeMenu()
            if (importedCount > 1) {
              notification.success(t('git.project.importedCount', { count: importedCount }) || `Imported ${importedCount} Git repositories`)
            }
            await load(firstProject.id || firstProject.name)
            return
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.name === 'AbortError') return
          reportError(e instanceof Error ? e.message : t('git.errors.openFolder'))
          return
        } finally {
          setBusy(false)
          setProgressStage('')
        }
      } else {
        const picked = await pickFolders(t('git.pickFolder.multi'), true)
        if (picked.length === 0) return
        setBusy(true)
        try {
          const response = await fetch('/api/git/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths: picked, discover: true }),
          })
          const body = (await response.json()) as {
            ok?: boolean
            projects?: GitProjectView[]
            folders?: string[]
            openPath?: string
            count?: number
          }
          if (!response.ok || body.ok === false || !body.openPath) {
            reportError(readApiErrorMessage(body, t('git.errors.noReposFound')))
            return
          }
          applyCatalog(body)
          closeMenu()
          await load(body.openPath)
        } catch {
          reportError(t('git.errors.unsupportedFileSystemAccess'))
        } finally {
          setBusy(false)
        }
        return
      }
      return
    }

    const picked = await pickFolders(t('git.pickFolder.multi'), true)
    if (picked.length === 0) return
    setBusy(true)
    try {
      const response = await fetch('/api/git/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: picked, discover: true }),
      })
      const body = (await response.json()) as {
        ok?: boolean
        projects?: GitProjectView[]
        folders?: string[]
        openPath?: string
        count?: number
      }
      if (!response.ok || body.ok === false || !body.openPath) {
        setError(readApiErrorMessage(body, t('git.errors.noReposFound')))
        return
      }
      applyCatalog(body)
      closeMenu()
      await load(body.openPath)
    } catch {
      setError(t('git.errors.noReposFound'))
    } finally {
      setBusy(false)
    }
  }

  async function addRemote(input: AddRemoteProjectOptions) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.addRemoteProject(input)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('git.errors.addRemoteFailed')
    } finally {
      setBusy(false)
    }
  }

  async function createFolder(name: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.createFolder(name)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('git.errors.createFolderFailed')
    } finally {
      setBusy(false)
    }
  }

  async function moveProject(id: string, group: string, beforeId?: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.moveProject(id, group, beforeId)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('git.errors.moveFailed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteFolder(name: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const result = await driver.deleteFolder(name)
      applyCatalog(result.catalog)
      return { error: '', removedCount: result.removedCount }
    } catch (err) {
      return { error: err instanceof Error ? err.message : t('git.errors.deleteFolderFailed') }
    } finally {
      setBusy(false)
    }
  }

  async function renameFolder(oldName: string, newName: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.renameFolder(oldName, newName)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('git.errors.renameFolderFailed')
    } finally {
      setBusy(false)
    }
  }

  async function clearFolder(name: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.clearFolder(name)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('git.errors.clearFolderFailed')
    } finally {
      setBusy(false)
    }
  }

  async function setProjectLabel(id: string, label: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.setProjectLabel(id, label)
      applyCatalog(catalog)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('git.errors.setLabelFailed')
    } finally {
      setBusy(false)
    }
  }

  async function removeProject(id: string) {
    setBusy(true)
    try {
      const driver = getGitDriver()
      const catalog = await driver.removeProject(id)
      applyCatalog(catalog)
      if (view?.repo === id || scope === id) {
        setView(null)
        setCommits([])
        setHasMore(false)
        setSelection({ kind: 'all' })
        setSelectedHash('')
        setSelectedFile('')
        setError('')
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/git')
        }
      }
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('git.errors.removeProjectFailed')
    } finally {
      setBusy(false)
    }
  }

  async function cloneProject(project: GitProjectView) {
    if (getDriverMode() === 'edge') {
      setError(t('git.errors.cloneEdgeUnsupported'))
      return ''
    }
    const parent = await pickFolder(t('git.pickFolder.clone'))
    if (!parent) return ''
    setBusy(true)
    try {
      const response = await fetch('/api/git/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: project.id, parent }),
      })
      const body = (await response.json()) as { ok?: boolean; path?: string; projects?: GitProjectView[]; folders?: string[] }
      if (!response.ok || body.ok === false || !body.path) return readApiErrorMessage(body, t('git.errors.cloneFailed'))
      applyCatalog(body)
      closeMenu()
      await load(body.path)
      return ''
    } catch {
      return t('git.errors.cloneFailed')
    } finally {
      setBusy(false)
    }
  }

  return {
    chooseFolder,
    addRemote,
    createFolder,
    moveProject,
    deleteFolder,
    renameFolder,
    clearFolder,
    setProjectLabel,
    removeProject,
    cloneProject,
  }
}
