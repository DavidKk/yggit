import { renderGitSlugPage } from '../../../git/_views'

export const metadata = {
  title: 'Yggit — 仓库与提交',
  description: 'Git 仓库生命图谱与提交演进',
}

interface Props {
  params: Promise<{ slug: string[] }>
  searchParams?: Promise<{ [key: string]: string | undefined }>
}

export default async function LocalGitSlugPage({ params, searchParams }: Props) {
  return renderGitSlugPage({ mode: 'local', params, searchParams })
}
