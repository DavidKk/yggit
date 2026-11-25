'use client'

import React, { forwardRef } from 'react'
import { LuCircleAlert, LuMinus, LuPanelRight, LuRotateCcw, LuSparkles, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Spinner, Tooltip } from '@/components/sk'
import { getAgentProcessingStatus, getToolExecutionStatus } from '@/lib/agent/status-helper'
import type { AgentChatMessage } from '@/lib/agent/types'
import { cn } from '@/lib/utils'

import { FormattedMessage } from './AgentWorkspace'

export interface GitAgentQuickCardProps {
  isOpen: boolean
  isCollapsing: boolean
  isProcessing: boolean
  lastAssistantMessage?: AgentChatMessage
  lastUserMessage?: AgentChatMessage
  onCollapseCard: (action: 'pill' | 'close') => void
  onDockRight: () => void
  onRetry?: (assistantMsgId?: string) => void
  className?: string
}

export const GitAgentQuickCard = forwardRef<HTMLDivElement, GitAgentQuickCardProps>(function GitAgentQuickCard(
  { isOpen, isCollapsing, isProcessing, lastAssistantMessage, lastUserMessage, onCollapseCard, onDockRight, onRetry, className },
  ref
) {
  const t = useT()

  if (!isOpen && !isCollapsing) return null

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t('gitAgent.quickAnswer')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onCollapseCard('close')
        }
      }}
      className={cn(
        'fixed bottom-[calc(1.25rem+48px)] left-1/2 -translate-x-1/2 z-40 w-[min(90vw,500px)] overflow-hidden rounded-2xl border border-line bg-panel/95 shadow-2xl backdrop-blur-md select-none origin-bottom transition-all duration-200 ease-in-out',
        isCollapsing
          ? 'max-h-0 opacity-0 translate-y-3 scale-[0.98] border-transparent pointer-events-none'
          : 'max-h-[380px] opacity-100 translate-y-0 scale-100 animate-in fade-in slide-in-from-bottom-2 duration-200',
        className
      )}
    >
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line/60 px-3.5 bg-panel-2/50 select-none">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
          <LuSparkles className="size-3.5 text-accent" />
          <span>{t('gitAgent.quickAnswer')}</span>
          {isProcessing && <Spinner className="size-3 ml-1" />}
        </div>

        {/* Header Controls: Dock right, Minimize to pill, Close */}
        <div className="flex items-center gap-1">
          <Tooltip content={t('gitAgent.deepDiscussion')} placement="top">
            <button
              type="button"
              onClick={onDockRight}
              className="flex size-7 items-center justify-center rounded-md text-ink-soft hover:bg-[var(--overlay-08)] hover:text-accent active:scale-95 transition-all cursor-pointer"
              aria-label={t('gitAgent.deepDiscussion')}
            >
              <LuPanelRight className="size-4" />
            </button>
          </Tooltip>
          <Tooltip content={t('gitAgent.minimizeToPill') || '收起为药丸'} placement="top">
            <button
              type="button"
              onClick={() => onCollapseCard('pill')}
              className="flex size-7 items-center justify-center rounded-md text-ink-soft hover:bg-[var(--overlay-08)] hover:text-ink active:scale-95 transition-all cursor-pointer"
              aria-label={t('gitAgent.minimizeToPill') || '收起为药丸'}
            >
              <LuMinus className="size-4" />
            </button>
          </Tooltip>
          <Tooltip content={t('common.close') || '关闭'} placement="top">
            <button
              type="button"
              onClick={() => onCollapseCard('close')}
              className="flex size-7 items-center justify-center rounded-md text-ink-soft hover:bg-[var(--overlay-08)] hover:text-ink active:scale-95 transition-all cursor-pointer"
              aria-label={t('common.close') || '关闭'}
            >
              <LuX className="size-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Content Body */}
      <div className="max-h-64 overflow-y-auto px-4 py-3 text-xs leading-relaxed text-ink select-text">
        {lastAssistantMessage?.content ? (
          lastAssistantMessage.isError ? (
            <div className="flex flex-col gap-2 rounded-xl border border-fail/35 bg-fail/10 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-fail">
                <LuCircleAlert className="size-3.5 shrink-0" />
                <span>{t('gitAgent.requestFailed') || '请求失败'}</span>
              </div>
              <div className="text-xs leading-relaxed text-ink whitespace-pre-wrap break-words">{lastAssistantMessage.content}</div>
              {onRetry && (
                <div className="flex items-center pt-0.5">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => onRetry(lastAssistantMessage.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-fail/30 bg-panel px-2.5 py-1 text-[11px] font-medium text-ink hover:border-fail/60 hover:bg-fail/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LuRotateCcw className="size-3 text-fail" />
                    <span>{t('gitAgent.retry') || '重试'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <FormattedMessage content={lastAssistantMessage.content} />
          )
        ) : isProcessing ? (
          <div className="flex items-center gap-1.5 text-ink-soft py-1">
            <Spinner className="size-3 text-accent shrink-0" />
            <span>
              {lastAssistantMessage?.statusTool
                ? getToolExecutionStatus(
                    lastAssistantMessage.statusTool.name,
                    lastAssistantMessage.statusTool.branch ? { branch: lastAssistantMessage.statusTool.branch } : undefined,
                    t
                  )
                : getAgentProcessingStatus(lastUserMessage?.content, t)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
})
