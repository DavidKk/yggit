import { GitAssociateRepoGuide } from '@/components/git/GitAssociateRepoGuide'
import { GitLogPage } from '@/components/git/GitLogPage'
import { GitUiBootScript } from '@/components/git/GitUiBootScript'
import { parseRepoSlug } from '@/lib/git/resolver'
import type { RouteDriverMode } from '@/lib/git/route-mode'
import { readGitLog } from '@/services/git/read'
import { resolveRepoSlug } from '@/services/git/resolver'

export async function renderGitWorkspacePage({ mode, searchParams }: { mode: RouteDriverMode; searchParams?: Promise<{ repo?: string; branch?: string; url?: string }> }) {
  const resolved = (await searchParams) ?? {}
  const explicit = (resolved.url || resolved.repo)?.trim() || ''

  // Edge mode runs strictly client-side via IndexedDB/GitHub; never invoke local git CLI during SSR.
  if (mode !== 'local' || !explicit) {
    return (
      <>
        <GitUiBootScript />
        <GitLogPage key={explicit || `${mode}-workspace`} initial={{ error: '', repo: '' }} />
      </>
    )
  }

  let initial: Awaited<ReturnType<typeof readGitLog>> | { error: string; repo: string }
  try {
    initial = await readGitLog({ repo: explicit, ref: '*' })
  } catch (error) {
    initial = { error: error instanceof Error ? error.message : '无法读取 Git', repo: explicit }
  }
  return (
    <>
      <GitUiBootScript />
      <GitLogPage key={explicit} initial={initial} />
    </>
  )
}

export async function renderGitSlugPage({
  mode,
  params,
  searchParams,
}: {
  mode: RouteDriverMode
  params: Promise<{ slug: string[] }>
  searchParams?: Promise<{ [key: string]: string | undefined }>
}) {
  const { slug } = await params
  const search = (await searchParams) || {}

  if (mode !== 'local') {
    const parsedEdge = parseRepoSlug(slug, search.remote)
    return (
      <>
        <GitUiBootScript />
        <GitLogPage
          key={`edge:${slug.join('/')}`}
          initial={{ error: '', repo: '' }}
          initialCommitHash={parsedEdge?.resourceType === 'commit' ? parsedEdge.resourceId : undefined}
          initialFilePath={search.file}
        />
      </>
    )
  }

  const { parsed, resolved } = resolveRepoSlug(slug, search.remote)

  if (resolved.error === 'UNRESOLVED_REMOTE' && resolved.unresolvedIdentity) {
    return (
      <>
        <GitUiBootScript />
        <GitAssociateRepoGuide identity={resolved.unresolvedIdentity} />
      </>
    )
  }

  if (resolved.error || !resolved.repoPathOrUrl) {
    return (
      <>
        <GitUiBootScript />
        <GitLogPage initial={{ error: resolved.error || '无法解析仓库', repo: '' }} />
      </>
    )
  }

  let initial: Awaited<ReturnType<typeof readGitLog>> | { error: string; repo: string }
  try {
    initial = await readGitLog({
      repo: resolved.repoPathOrUrl,
      branch: parsed.resourceType === 'branch' ? parsed.resourceId : undefined,
      ref: '*',
    })
  } catch (error) {
    initial = {
      error: error instanceof Error ? error.message : '无法读取 Git 仓库',
      repo: resolved.repoPathOrUrl,
    }
  }

  const initialCommitHash = parsed.resourceType === 'commit' ? parsed.resourceId : undefined
  const initialFilePath = search.file

  return (
    <>
      <GitUiBootScript />
      <GitLogPage
        key={resolved.repoPathOrUrl || slug.join('/')}
        initial={initial}
        initialCommitHash={initialCommitHash}
        initialFilePath={initialFilePath}
        initialPersistence={resolved.persistence}
      />
    </>
  )
}
