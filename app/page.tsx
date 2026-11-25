import type { Metadata } from 'next'

import { LandingPage } from '@/components/landing/LandingPage'
import { PRODUCT_DISPLAY_NAME } from '@/constants/brand'

export const metadata: Metadata = {
  title: `${PRODUCT_DISPLAY_NAME} — 现代化生命树架构 Git 图谱与版本管理工作台`,
  description: '让每一次代码提交、分支演进与合并脉络都清晰可见。双引擎原生驱动，毫秒级 DAG 拓扑渲染，端侧零存留 AI 代码审查与智能工作台。',
  keywords: [
    'Git',
    'Git 图谱',
    'Git 可视化',
    'Git 客户端',
    'DAG 拓扑',
    '版本控制',
    '世界树',
    'Yggdrasil',
    '代码审查',
    'Workdesk',
    'Virtual Teammate',
    'WebAssembly Git',
    'Git Visualization',
  ],
  authors: [{ name: 'Yggit Team' }],
  creator: 'Yggit Team',
  publisher: PRODUCT_DISPLAY_NAME,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://yggit.dev'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${PRODUCT_DISPLAY_NAME} — 现代化生命树架构 Git 图谱与版本管理工作台`,
    description: '让每一次代码提交、分支演进与合并脉络都清晰可见。双引擎原生驱动，毫秒级 DAG 拓扑渲染，端侧零存留 AI 代码审查与智能工作台。',
    url: '/',
    siteName: PRODUCT_DISPLAY_NAME,
    images: [
      {
        url: '/world-tree-assets/hero/hero_day_master_1672x941.webp',
        width: 1672,
        height: 941,
        alt: 'Yggit World Tree Git Visualization',
      },
    ],
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PRODUCT_DISPLAY_NAME} — 现代化生命树架构 Git 图谱与版本管理工作台`,
    description: '让每一次代码提交、分支演进与合并脉络都清晰可见。双引擎原生驱动，毫秒级 DAG 拓扑渲染。',
    images: ['/world-tree-assets/hero/hero_day_master_1672x941.webp'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: PRODUCT_DISPLAY_NAME,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'All',
  description: '现代化生命树架构 Git 图谱与版本管理工作台。让每一次代码提交、分支演进与合并脉络都清晰可见。双引擎原生驱动，毫秒级 DAG 拓扑渲染。',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Organic Life-Tree Git DAG Visualization',
    'Dual-Engine Architecture (Local native + Edge WebAssembly)',
    'Zero-Storage AI Virtual Teammate',
    '4-Column Adaptive Git Workdesk',
    'Seamless Branch & Remote Synchronization',
  ],
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingPage />
    </>
  )
}
