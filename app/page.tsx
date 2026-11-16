import type { Metadata } from 'next'

import { LandingPage } from '@/components/landing/LandingPage'
import { PRODUCT_DISPLAY_NAME } from '@/constants/brand'

export const metadata: Metadata = {
  title: `${PRODUCT_DISPLAY_NAME} — 现代化 Git 图谱与版本管理工具`,
  description: '让每一次提交与合并脉络都清晰可见。双引擎原生驱动，毫秒级 DAG 拓扑渲染，端侧零存留 AI 代码审查。',
}

export default function Home() {
  return <LandingPage />
}
