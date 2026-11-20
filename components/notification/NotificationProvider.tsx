'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoAlertCircleOutline, IoCheckmarkCircleOutline, IoCloseOutline, IoInformationCircleOutline, IoWarningOutline } from 'react-icons/io5'

import { NOTIFICATION_DURATION_MS, type NotificationItem, type NotificationType } from '@/components/notification/types'
import { cn } from '@/lib/utils'
import { stripAnsi } from '@/lib/utils/strip-ansi'

interface NotificationContextValue {
  notify: (type: NotificationType, message: string, duration?: number) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

function createNotificationId(): string {
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const iconTone: Record<NotificationType, string> = {
  success: 'text-ok',
  warning: 'text-warn',
  error: 'text-fail',
  info: 'text-accent',
}

function NotificationToast({ notification, onClose }: { notification: NotificationItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const cleanMessage = stripAnsi(notification.message).trim()
  const lines = cleanMessage.split(/\r?\n/).filter(Boolean)
  const headline = lines[0] || ''
  const details = lines.slice(1).join('\n')
  const hasDetails = lines.length > 1

  const Icon =
    notification.type === 'success'
      ? IoCheckmarkCircleOutline
      : notification.type === 'warning'
        ? IoWarningOutline
        : notification.type === 'error'
          ? IoAlertCircleOutline
          : IoInformationCircleOutline

  return (
    <div
      className={cn(
        'pointer-events-auto flex flex-col rounded-md border border-line bg-panel p-3',
        'shadow-[0_8px_24px_rgb(0_0_0_/_0.35),inset_0_1px_0_rgb(255_255_255_/_0.04)]',
        'transition-[opacity,transform] duration-200 ease-out',
        visible ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <Icon className={cn('shrink-0 mt-0.5', iconTone[notification.type])} size={16} aria-hidden />
        <span className="min-w-0 flex-1 text-sm font-medium leading-[1.35] text-ink break-words">{headline}</span>
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-ink-soft transition-[background,color] duration-150 hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-ink"
          onClick={onClose}
          aria-label="关闭通知"
        >
          <IoCloseOutline size={14} aria-hidden />
        </button>
      </div>
      {hasDetails && (
        <div className="mt-1.5 pl-6">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-[11px] text-accent hover:underline cursor-pointer select-none inline-flex items-center gap-1"
          >
            {showDetails ? '收起详情' : `查看详情 (${lines.length - 1} 行)`}
          </button>
          {showDetails && (
            <pre className="mt-1 max-h-36 overflow-y-auto rounded bg-panel-2 p-1.5 text-[11px] font-mono leading-relaxed text-ink-soft whitespace-pre-wrap break-all border border-line/60">
              {details}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function NotificationHost({ notifications, onRemove, portalContainer }: { notifications: NotificationItem[]; onRemove: (id: string) => void; portalContainer?: Element | null }) {
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    notifications.forEach((notification) => {
      if (timeoutRefs.current.has(notification.id)) return

      const timeout = setTimeout(() => {
        onRemove(notification.id)
        timeoutRefs.current.delete(notification.id)
      }, notification.duration)

      timeoutRefs.current.set(notification.id, timeout)
    })

    const activeIds = new Set(notifications.map((item) => item.id))
    timeoutRefs.current.forEach((timeout, id) => {
      if (!activeIds.has(id)) {
        clearTimeout(timeout)
        timeoutRefs.current.delete(id)
      }
    })
  }, [notifications, onRemove])

  useEffect(
    () => () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout))
      timeoutRefs.current.clear()
    },
    []
  )

  if (notifications.length === 0) return null

  const mount = portalContainer ?? (typeof document !== 'undefined' ? document.body : null)
  if (!mount) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-3 top-28 z-[60] flex w-auto max-w-none flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-[min(calc(100vw-2rem),20rem)]">
      {notifications.map((notification) => (
        <NotificationToast key={notification.id} notification={notification} onClose={() => onRemove(notification.id)} />
      ))}
    </div>,
    mount
  )
}

export function NotificationProvider({
  children,
  portalContainer,
}: {
  children: ReactNode
  /** 局内 Shadow 等：通知挂到带 token 的容器，避免落到 document.body 无样式 */
  portalContainer?: Element | null
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback((type: NotificationType, message: string, duration?: number) => {
    const item: NotificationItem = {
      id: createNotificationId(),
      type,
      message,
      duration: duration ?? NOTIFICATION_DURATION_MS[type],
      createdAt: Date.now(),
    }
    setNotifications((prev) => [...prev, item].slice(-4))
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' ? <NotificationHost notifications={notifications} onRemove={removeNotification} portalContainer={portalContainer} /> : null}
    </NotificationContext.Provider>
  )
}

export function useNotificationContext(): NotificationContextValue {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider')
  }
  return context
}

export function useOptionalNotificationContext(): NotificationContextValue | null {
  return useContext(NotificationContext)
}
