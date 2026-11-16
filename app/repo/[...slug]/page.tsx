import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ slug: string[] }>
  searchParams?: Promise<{ [key: string]: string | undefined }>
}

export default async function LegacyRepoRedirectPage({ params, searchParams }: Props) {
  const { slug } = await params
  const search = (await searchParams) || {}

  const searchParamsInstance = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined) {
      searchParamsInstance.set(key, value)
    }
  }

  const query = searchParamsInstance.toString()
  const queryString = query ? `?${query}` : ''
  const targetPath = `/git/${slug.map((s) => encodeURIComponent(s)).join('/')}${queryString}`

  redirect(targetPath)
}
