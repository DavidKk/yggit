'use client'

import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react'

import { repoName } from '@/components/git/log-page/gitLogUtils'
import type { useT } from '@/components/i18n/LocaleProvider'
import { getDriverMode, getGitDriver } from '@/lib/git/driver'
import { saveLastGitUrl } from '@/lib/git/last-git-url'
import { makeShareUrl } from '@/lib/git/resolver'
import { addTemporaryRepo, parseRemoteUrl } from '@/lib/git/temporary-store'
import { GIT_WORKTREE_HASH, type GitCommit, type GitLogView, type GitProjectView, type GitSelection } from '@/lib/git/types'

export function useGitLogRepoLoader({
  view,
  projects,
  selectedHash,
  selectedFile,
  applyView,
  setView,
  setCommits,
  setHasMore,
  setSelection,
  setSelectedHash,
  setSelectedFile,
  setSelectedStatus,
  setLineageHashes,
  setConflictViewActive,
  setError,
  setBusy,
  setProgressStage,
  t,
}: {
  view: GitLogView | null
  projects: GitProjectView[]
  selectedHash: string
  selectedFile: string
  applyView: (next: GitLogView) => void
  setView: Dispatch<SetStateAction<GitLogView | null>>
  setCommits: Dispatch<SetStateAction<GitCommit[]>>
  setHasMore: Dispatch<SetStateAction<boolean>>
  setSelection: (next: GitSelection) => void
  setSelectedHash: Dispatch<SetStateAction<string>>
  setSelectedFile: Dispatch<SetStateAction<string>>
  setSelectedStatus: Dispatch<SetStateAction<string>>
  setLineageHashes: Dispatch<SetStateAction<string[] | null>>
  setConflictViewActive: Dispatch<SetStateAction<boolean>>
  setError: Dispatch<SetStateAction<string>>
  setBusy: Dispatch<SetStateAction<boolean>>
  setProgressStage: Dispatch<SetStateAction<string>>
  t: ReturnType<typeof useT>
}) {
  async function load(repo: string) {
    if (!repo || !repo.trim()) {
      setView(null)
      setCommits([])
      setHasMore(false)
      setSelection({ kind: 'all' })
      setSelectedHash('')
      setSelectedFile('')
      setError('')
      setBusy(false)
      setProgressStage('')
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('repo')
        url.searchParams.delete('url')
        url.searchParams.delete('hash')
        url.searchParams.delete('file')
        window.history.replaceState(null, '', url.pathname.includes('/git') ? '/git' : url.pathname)
      }
      return
    }
    setBusy(true)
    setError('')
    setProgressStage('正在准备加载项目...')
    try {
      const driver = getGitDriver()
      const body = await driver.readLog({
        repo,
        onProgress: (stage) => setProgressStage(stage),
      })
      applyView(body)
    } catch (loadError) {
      setView(null)
      setCommits([])
      setHasMore(false)
      setSelection({ kind: 'all' })
      setSelectedHash('')
      setSelectedFile('')
      setError(loadError instanceof Error ? loadError.message : t('git.errors.readGit'))
    } finally {
      setBusy(false)
      setProgressStage('')
    }
  }

  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (view && view.repo) {
      const parsed = parseRemoteUrl(view.repo)
      if (parsed) {
        const isSaved = projects.some((p) => (p.httpsUrl && p.httpsUrl === parsed.remoteUrl) || p.name === parsed.name)
        if (!isSaved) {
          addTemporaryRepo(parsed)
        }
      }
    }
  }, [view, projects])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const targetUrl = params.get('url') || params.get('repo')
    if (targetUrl) {
      const parsed = parseRemoteUrl(targetUrl)
      if (parsed) {
        const existing = projects.find((p) => (p.httpsUrl && p.httpsUrl === parsed.remoteUrl) || p.name === parsed.name)
        if (existing?.localPath) {
          void loadRef.current(existing.localPath)
        } else {
          addTemporaryRepo(parsed)
          void loadRef.current(parsed.remoteUrl)
        }
      } else {
        void loadRef.current(targetUrl)
      }
    } else if (getDriverMode() === 'edge') {
      const pathParts = window.location.pathname.split('/').filter(Boolean)
      if (pathParts[0] === 'repo' && pathParts[1]) {
        void loadRef.current(pathParts[1])
      } else if (pathParts[0] === 'git' && pathParts.length > 1) {
        const name = pathParts.slice(1).join('/')
        void loadRef.current(name)
      } else if (view?.repo && view.repo.startsWith('/')) {
        const name = view.displayPath || repoName(view.repo)
        if (name) void loadRef.current(name)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !view?.repo) return
    const canonicalUrl = makeShareUrl(view.repo, {
      hash: selectedHash || undefined,
      remoteUrl: view.remoteUrl,
      file: selectedFile || undefined,
    })
    saveLastGitUrl(canonicalUrl)
    const current = window.location.pathname + window.location.search
    if (current !== canonicalUrl) {
      window.history.replaceState(window.history.state, '', canonicalUrl)
    }
  }, [selectedHash, selectedFile, view?.repo, view?.remoteUrl])

  useEffect(() => {
    function onOpenProject(e: Event) {
      const customEvent = e as CustomEvent<{ target: string; url: string }>
      const target = customEvent.detail?.target
      if (target) {
        void loadRef.current(target)
      }
    }
    window.addEventListener('yggit:open_project', onOpenProject)
    return () => window.removeEventListener('yggit:open_project', onOpenProject)
  }, [])

  useEffect(() => {
    function onUiNavigate(e: Event) {
      const customEvent = e as CustomEvent<{ target: string }>
      const target = customEvent.detail?.target
      if (target === 'panel_commit') {
        setSelectedHash(GIT_WORKTREE_HASH)
        setSelectedFile('')
        setSelectedStatus('')
        setLineageHashes(null)
        setConflictViewActive(false)
      } else if (target === 'panel_conflicts') {
        setConflictViewActive(true)
      }
    }
    window.addEventListener('yggit:ui_navigate', onUiNavigate)
    return () => window.removeEventListener('yggit:ui_navigate', onUiNavigate)
  }, [setConflictViewActive, setLineageHashes, setSelectedFile, setSelectedHash, setSelectedStatus])

  return { load, loadRef }
}
