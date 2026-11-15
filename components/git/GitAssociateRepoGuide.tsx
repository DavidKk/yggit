'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LuCheck, LuCopy, LuFolder, LuFolderPlus, LuHash, LuLayers } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button } from '@/components/sk'
import { copyToClipboard } from '@/lib/clipboard'
import { getDriverMode, getGitDriver } from '@/lib/git/driver'
import { getDirectoryHandle, isFileSystemAccessSupported, saveDirectoryHandle, saveRepoAlias } from '@/lib/git/indexeddb-handles'
import { makeShareUrl } from '@/lib/git/resolver'
import type { GitProjectView } from '@/lib/git/types'
import { cn } from '@/lib/utils'

interface Props {
  identity: {
    key: string
    remoteUrl?: string
    name: string
    commitHash?: string
  }
}

export function GitAssociateRepoGuide({ identity }: Props) {
  const t = useT()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing')
  const [projects, setProjects] = useState<GitProjectView[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [localPath, setLocalPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Check if this repository handle is already stored in browser storage (Edge mode)
  useEffect(() => {
    let active = true
    async function checkExistingHandle() {
      if (typeof window === 'undefined') return
      try {
        const handle = await getDirectoryHandle(identity.key)
        if (handle && active) {
          window.location.replace(`/?repo=${encodeURIComponent(handle.name)}`)
          return
        }
      } catch {
        // Continue showing association guide
      }
    }
    void checkExistingHandle()
    return () => {
      active = false
    }
  }, [identity.key])

  // Load registered projects on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const driver = getGitDriver()
        const catalog = await driver.getProjects()
        setProjects(catalog.projects)
        if (catalog.projects.length === 0) {
          setActiveTab('new')
        }
      } catch {
        setActiveTab('new')
      }
    }
    void loadProjects()
  }, [])

  const handlePickFolder = async () => {
    setPicking(true)
    setError('')
    try {
      // 1. In Edge mode or when showDirectoryPicker is supported, use Web FS
      if (getDriverMode() === 'edge' || isFileSystemAccessSupported()) {
        if (window.showDirectoryPicker) {
          try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
            if (handle) {
              setLocalPath(handle.name)
              await saveDirectoryHandle(identity.key, handle, handle.name)
              await saveRepoAlias(identity.key, handle.name)
              setPicking(false)
              return
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.name === 'AbortError') {
              setPicking(false)
              return
            }
          }
        }
        if (getDriverMode() === 'edge') {
          setError(t('git.errors.unsupportedFileSystemAccess'))
          setPicking(false)
          return
        }
      }

      // 2. Fallback to local server picker ONLY in Local mode
      const res = await fetch('/api/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'folder', prompt: t('git.associate.specifyPath') }),
      })
      const body = (await res.json()) as { ok?: boolean; path?: string; paths?: string[]; cancelled?: boolean }
      if (body.cancelled) return
      const chosen = body.path || (body.paths && body.paths[0])
      if (chosen) {
        setLocalPath(chosen)
      }
    } catch {
      setError(t('git.errors.openFolder'))
    } finally {
      setPicking(false)
    }
  }

  const handleAssociateExisting = async () => {
    if (!selectedProjectId) {
      setError(t('git.associate.selectPlaceholder'))
      return
    }

    setLoading(true)
    setError('')
    try {
      // Save alias in IndexedDB
      await saveRepoAlias(identity.key, selectedProjectId)

      const target = projects.find((p) => p.id === selectedProjectId)
      const targetPath = target?.localPath || selectedProjectId

      // Also register on local server if in Local mode
      if (getDriverMode() === 'local') {
        try {
          await fetch('/api/git/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: targetPath, discover: false }),
          })
        } catch {
          // Local mode ignore
        }
      }

      // Redirect directly to the requested commit under the matched project
      const url = makeShareUrl(targetPath, identity.commitHash, target?.httpsUrl)
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : t('git.errors.readGit'))
      setLoading(false)
    }
  }

  const handleAssociateNewFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const path = localPath.trim()
    if (!path) {
      setError(t('git.associate.specifyPath'))
      return
    }

    setLoading(true)
    setError('')
    try {
      await saveRepoAlias(identity.key, path)

      // Post to local server if in Local mode
      if (getDriverMode() === 'local') {
        try {
          const res = await fetch('/api/git/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, discover: false }),
          })
          if (!res.ok) {
            const body = await res.json()
            throw new Error(body.message || body.error || '关联失败')
          }
        } catch (err) {
          throw err
        }
      }

      const url = makeShareUrl(path, identity.commitHash, identity.remoteUrl)
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : t('git.errors.readGit'))
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-bg-canvas p-6 text-ink">
      <div className="flex w-full max-w-xl flex-col rounded-xl border border-line bg-bg p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--accent)_15%,transparent)] text-accent">
            <LuFolderPlus className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t('git.associate.title')}</h2>
            <p className="text-xs text-ink-soft">{t('git.associate.description')}</p>
          </div>
        </div>

        <div className="my-5 rounded-lg border border-line/70 bg-bg-panel/50 p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-ink-soft">{t('git.associate.remoteIdentity')}：</span>
            <div className="flex items-center gap-1.5 font-mono font-medium">
              <span>{identity.key}</span>
              <button
                type="button"
                className="opacity-70 hover:opacity-100 cursor-pointer"
                onClick={() => {
                  void copyToClipboard(identity.remoteUrl || identity.key)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
              >
                {copied ? <LuCheck className="size-3.5 text-ok" /> : <LuCopy className="size-3.5" />}
              </button>
            </div>
          </div>
          {identity.commitHash ? (
            <div className="flex items-center justify-between border-t border-line/40 pt-2">
              <span className="text-ink-soft flex items-center gap-1">
                <LuHash className="size-3.5" /> {t('git.associate.targetCommit')}：
              </span>
              <span className="font-mono text-accent">{identity.commitHash.slice(0, 10)}</span>
            </div>
          ) : null}
          {identity.remoteUrl ? (
            <div className="flex items-center justify-between border-t border-line/40 pt-2 text-[11px]">
              <span className="text-ink-soft">{t('git.associate.cloneReference')}：</span>
              <span className="font-mono text-ink-soft/80 select-all truncate max-w-[280px]">git clone {identity.remoteUrl}</span>
            </div>
          ) : null}
        </div>

        {/* Tab switch */}
        <div className="mb-4 flex gap-2 border-b border-line pb-2">
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-all',
              activeTab === 'existing' ? 'bg-accent/15 text-accent font-semibold' : 'text-ink-soft hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]'
            )}
            onClick={() => {
              setActiveTab('existing')
              setError('')
            }}
          >
            <LuLayers className="size-3.5" />
            {t('git.associate.tabExisting')} ({projects.length})
          </button>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-all',
              activeTab === 'new' ? 'bg-accent/15 text-accent font-semibold' : 'text-ink-soft hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]'
            )}
            onClick={() => {
              setActiveTab('new')
              setError('')
            }}
          >
            <LuFolder className="size-3.5" />
            {t('git.associate.tabNewFolder')}
          </button>
        </div>

        {activeTab === 'existing' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1.5">{t('git.associate.selectProject')}：</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="h-9 w-full rounded-md border border-line bg-bg px-3 text-xs outline-none focus:border-accent"
              >
                <option value="">{t('git.associate.selectPlaceholder')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.localPath ? `(${p.localPath})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {error ? <div className="text-xs text-fail bg-fail/10 p-2.5 rounded-md border border-fail/20">{error}</div> : null}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="plain"
                size="md"
                onClick={() => {
                  router.push('/')
                }}
              >
                {t('git.associate.backHome')}
              </Button>
              <Button type="button" variant="accent" size="md" loading={loading} disabled={!selectedProjectId} onClick={handleAssociateExisting} className="gap-1.5">
                <LuFolderPlus className="size-4" />
                {t('git.associate.associateAndOpen')}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAssociateNewFolder} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1.5">{t('git.associate.specifyPath')}：</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="/Users/.../your-project"
                  className="h-9 flex-1 rounded-md border border-line bg-bg px-3 text-xs font-mono outline-none focus:border-accent"
                />
                <Button type="button" variant="default" size="md" className="h-9 shrink-0 gap-1.5" loading={picking} onClick={handlePickFolder}>
                  <LuFolder className="size-3.5" />
                  {t('git.associate.browseDirectory')}
                </Button>
              </div>
            </div>

            {error ? <div className="text-xs text-fail bg-fail/10 p-2.5 rounded-md border border-fail/20">{error}</div> : null}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="plain"
                size="md"
                onClick={() => {
                  router.push('/')
                }}
              >
                {t('git.associate.backHome')}
              </Button>
              <Button type="submit" variant="accent" size="md" loading={loading} className="gap-1.5">
                <LuFolderPlus className="size-4" />
                {t('git.associate.associateAndOpen')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
