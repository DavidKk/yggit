import type { Metadata } from 'next'

import { DevLogsPageContent } from '@/components/dev/logs/DevLogsPageContent'

export const metadata: Metadata = {
  title: '操作与错误日志 · 开发者诊断日志',
}

export default function DevLogsOperationsPage() {
  return <DevLogsPageContent section="operations" />
}
