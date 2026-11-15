import { GitLogPage } from '@/components/git/GitLogPage'
import { GitUiBootScript } from '@/components/git/GitUiBootScript'
import { readGitLog } from '@/services/git/read'
import { resolveRepoSlug } from '@/services/git/resolver'

export const metadata = {
  title: 'Yggit — 仓库与提交',
  description: 'Git 仓库生命图谱与提交演进',
}

interface Props {
  params: Promise<{ slug: string[] }>
  searchParams?: Promise<{ [key: string]: string | undefined }>
}

export default async function RepoPage({ params }: Props) {
  const { slug } = await params
  const { parsed, resolved } = resolveRepoSlug(slug)

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

  return (
    <>
      <GitUiBootScript />
      <GitLogPage
        initial={initial}
        initialCommitHash={initialCommitHash}
        initialPersistence={resolved.persistence}
      />
    </>
  )
}
