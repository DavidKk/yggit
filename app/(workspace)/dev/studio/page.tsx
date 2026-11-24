import { notFound } from 'next/navigation'

import { HomepageDevStudio } from '@/components/homepage/HomepageDevStudio'

export const metadata = {
  title: 'Yggit — Homepage Dev Studio',
  description: '世界树动效工坊与源图检视（仅在本地开发模式可用）',
}

export default function DevStudioPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return <HomepageDevStudio />
}
