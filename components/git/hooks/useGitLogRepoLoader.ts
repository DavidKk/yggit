'use client'

import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react'

import { repoName } from '@/components/git/log-page/gitLogUtils'
import type { useT } from '@/components/i18n/LocaleProvider'
import { getDriverMode } from '@/lib/git/driver'
import { saveLastGitUrl } from '@/lib/git/last-git-url'
import { fetchRepoLogDeduplicated, getCachedRepoLog, hasGitLogViewChanged, isAbortError, prefetchTopCommitDiff, setCachedRepoLog } from '@/lib/git/log-view-cache'
import { makeShareUrl, parseRepoSlug } from '@/lib/git/resolver'
import { stripLocalPrefix, withDriverModePath } from '@/lib/git/route-mode'
import { addTemporaryRepo, parseRemoteUrl } from '@/lib/git/temporary-store'
import { GIT_WORKTREE_HASH, type GitCommit, type GitLogView, type GitProjectView, type GitSelection } from '@/lib/git/types'
import { createScopedLogger } from '@/lib/logger'

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
  onError,
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
  onError?: (message: string) => void
  setBusy: Dispatch<SetStateAction<boolean>>
  setProgressStage: Dispatch<SetStateAction<string>>
  t: ReturnType<typeof useT>
}) {
  const loadGenRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  async function load(repo: string) {
    loadGenRef.current += 1
    const gen = loadGenRef.current
    abortRef.current?.abort()
    abortRef.current = null

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
        window.history.replaceState(null, '', stripLocalPrefix(url.pathname).includes('/git') ? withDriverModePath('/git', getDriverMode()) : url.pathname)
      }
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    const loadLog = createScopedLogger('git')

    const cached = getCachedRepoLog(repo)
    if (cached) {
      setError('')
      setBusy(false)
      setProgressStage('')
      applyView(cached.view)
      prefetchTopCommitDiff(cached.view)
      // Silently revalidate in the background so switching feels instant
      void fetchRepoLogDeduplicated(repo, { signal: controller.signal })
        .then((fresh) => {
          if (gen !== loadGenRef.current) return
          if (hasGitLogViewChanged(cached.view, fresh)) {
            applyView(fresh)
          }
          prefetchTopCommitDiff(fresh)
        })
        .catch(() => {
          // Keep cached view when background refresh is aborted or transiently fails
        })
      return
    }

    setBusy(true)
    setError('')
    setProgressStage(t('git.page.preparingRepo') || 'Preparing repository...')
    try {
      const body = await fetchRepoLogDeduplicated(repo, {
        signal: controller.signal,
        onProgress: (stage) => {
          if (gen === loadGenRef.current) setProgressStage(stage)
        },
      })
      if (gen !== loadGenRef.current) return
      applyView(body)
      prefetchTopCommitDiff(body)
      loadLog.info(`Loaded repository ${body.displayPath || body.repo}`, {
        mode: getDriverMode(),
        branch: body.branch,
        commits: body.commits?.length ?? 0,
      })
    } catch (loadError) {
      if (gen !== loadGenRef.current || isAbortError(loadError)) return
      loadLog.error(`Failed to load repository ${repo}`, loadError)
      setView(null)
      setCommits([])
      setHasMore(false)
      setSelection({ kind: 'all' })
      setSelectedHash('')
      setSelectedFile('')
      const msg = loadError instanceof Error ? loadError.message : t('git.errors.readGit')
      setError(msg)
      onError?.(msg)
    } finally {
      if (gen === loadGenRef.current) {
        setBusy(false)
        setProgressStage('')
      }
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
    } else if (view?.repo && !view.repo.startsWith('/') && getDriverMode() !== 'edge') {
      // Remote repository already resolved on SSR; keep it and warm the in-memory cache.
      setCachedRepoLog(view.repo, view)
    } else if (getDriverMode() === 'edge') {
      const pathParts = stripLocalPrefix(window.location.pathname).split('/').filter(Boolean)
      if (pathParts[0] === 'repo' && pathParts[1]) {
        void loadRef.current(pathParts[1])
      } else if (pathParts[0] === 'git' && pathParts.length > 1) {
        const parsedSlug = parseRepoSlug(pathParts.slice(1), params.get('remote') || undefined)
        const target =
          parsedSlug?.remoteUrl ||
          (parsedSlug?.owner && parsedSlug?.repo ? `https://github.com/${parsedSlug.owner}/${parsedSlug.repo}` : parsedSlug?.repoKey) ||
          pathParts.slice(1).join('/')
        void loadRef.current(target)
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
