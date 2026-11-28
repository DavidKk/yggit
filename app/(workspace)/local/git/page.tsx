import { renderGitWorkspacePage } from '../../git/_views'

export const metadata = {
  title: 'Yggit — 工作区',
  description: '查看仓库提交与图谱',
}

export default async function LocalGitWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<{ repo?: string; branch?: string; url?: string }>
} = {}) {
  return renderGitWorkspacePage({ mode: 'local', searchParams })
}
