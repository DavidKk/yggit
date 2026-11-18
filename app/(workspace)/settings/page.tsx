import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: '设置 — Yggit',
  description: '配置模型接入、隐私脱敏及系统偏好',
}

interface Props {
  searchParams?: Promise<{ tab?: string; [key: string]: string | undefined }>
}

export default async function SettingsPage({ searchParams }: Props) {
  const search = (await searchParams) || {}
  const tab = search.tab

  if (tab && ['models', 'privacy', 'general', 'menus'].includes(tab)) {
    redirect(`/settings/${tab}`)
  }

  redirect('/settings/models')
}
