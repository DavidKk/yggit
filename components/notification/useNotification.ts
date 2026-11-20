'use client'

import { useCallback, useMemo } from 'react'

import { useOptionalNotificationContext } from '@/components/notification/NotificationProvider'
import { NOTIFICATION_DURATION_MS } from '@/components/notification/types'

export function useNotification() {
  const ctx = useOptionalNotificationContext()
  const notify = useMemo(() => ctx?.notify ?? (() => {}), [ctx?.notify])

  const success = useCallback((message: string, duration = NOTIFICATION_DURATION_MS.success) => notify('success', message, duration), [notify])
  const error = useCallback((message: string, duration = NOTIFICATION_DURATION_MS.error) => notify('error', message, duration), [notify])
  const warning = useCallback((message: string, duration = NOTIFICATION_DURATION_MS.warning) => notify('warning', message, duration), [notify])
  const info = useCallback((message: string, duration = NOTIFICATION_DURATION_MS.info) => notify('info', message, duration), [notify])

  return useMemo(() => ({ success, error, warning, info }), [success, error, warning, info])
}
