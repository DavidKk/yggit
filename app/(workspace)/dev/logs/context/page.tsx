import type { Metadata } from 'next'

import { DevLogsPageContent } from '@/components/dev/logs/DevLogsPageContent'

export const metadata: Metadata = {
  title: 'Agent 上下文追踪 · 开发者诊断日志',
}

export default function DevLogsContextPage() {
  return <DevLogsPageContent section="context" />
}
