import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { StudioShell } from '@/components/homepage/HomepageDevStudio'

export const metadata = {
  title: 'Yggit — Homepage Dev Studio',
  description: '世界树动效工坊与源图检视（仅在本地开发模式可用）',
}

export default function DevStudioLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return <StudioShell>{children}</StudioShell>
}
