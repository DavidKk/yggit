import { GitLogPage } from '@/components/git/GitLogPage'
import { GitUiBootScript } from '@/components/git/GitUiBootScript'
import { readGitLog } from '@/services/git/read'

export const metadata = {
  title: 'Yggit',
  description: '查看仓库提交',
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ repo?: string; branch?: string }> } = {}) {
  const resolved = (await searchParams) ?? {}
  const explicit = resolved.repo?.trim() || ''
  if (!explicit) {
    return (
      <>
        <GitUiBootScript />
        <GitLogPage initial={{ error: '', repo: '' }} />
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
      <GitLogPage initial={initial} />
    </>
  )
}
