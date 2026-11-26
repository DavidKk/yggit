import { redirect } from 'next/navigation'

export default function DevLogsIndexPage() {
  redirect('/dev/logs/operations')
}
