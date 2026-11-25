'use client'

import Link from 'next/link'
import React from 'react'
import { LuBot, LuFolderGit2, LuFolderTree, LuGitBranch } from 'react-icons/lu'

import { Badge, Button } from '@/components/sk'
import { quotePromptToAgent } from '@/lib/agent/agent-quote'
import type { MessageKey, MessageParams } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { WorkCard, WorkItem } from '@/lib/workdesk/types'

import { getCrAnalysis, getItemProblemTitle, localizeWorkdeskSummary } from './workdesk-detail-helpers'

interface WorkdeskEvidencePanelProps {
  card: WorkCard
  activeItem?: WorkItem
  isGathering: boolean
  isDealing?: boolean
  locale: string
  t: (key: MessageKey, params?: MessageParams) => string
  handleSendToAgent: (item?: WorkItem) => void
}

export function WorkdeskEvidencePanel({ card, activeItem, isGathering, isDealing, locale, t, handleSendToAgent }: WorkdeskEvidencePanelProps) {
  const renderStateBadge = (state: 'safe' | 'warn' | 'bad') => {
    if (state === 'safe') {
      return (
        <Badge tone="ok" size="mini">
          {t('workdesk.status.safe')}
        </Badge>
      )
    }
    if (state === 'warn') {
      return (
        <Badge tone="warn" size="mini">
          {t('workdesk.status.warn')}
        </Badge>
      )
    }
    return (
      <Badge tone="fail" size="mini">
        {t('workdesk.status.bad')}
      </Badge>
    )
  }

  return (
    <div
      className={cn(
        'custom-scrollbar relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-panel-2/20 p-3 pb-20 transition-all duration-200',
        isGathering || isDealing ? 'pointer-events-none opacity-0 translate-x-2' : 'opacity-100 translate-x-0'
      )}
    >
      {activeItem ? (
        <div className="w-full max-w-4xl rounded-xl border border-line bg-panel p-3.5 shadow-2xs">
          {/* Header: Title + Status Badge */}
          <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <LuFolderGit2 className="size-4 shrink-0 text-accent" aria-hidden="true" />
              <h3 className="truncate text-sm font-bold text-ink">{getItemProblemTitle(card.id, activeItem, t)}</h3>
            </div>
            {renderStateBadge(activeItem.state)}
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {/* 1. 关联项目 & 问题分支 - 均单独一行展示，点击名称直接进入 */}
            <div className="flex flex-col gap-2 rounded-lg border border-line/60 bg-panel-2/40 p-3 text-xs">
              {/* Row 1: 关联项目 (点击直接进入) */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                <span className="w-16 shrink-0 whitespace-nowrap text-[11px] font-medium text-ink-muted sm:w-20">{t('workdesk.detail.targetProject')}</span>
                <div className="flex min-w-0 flex-1 items-center">
                  <Link
                    href={`/git/${encodeURIComponent(activeItem.repoId)}`}
                    className="truncate font-semibold text-ink hover:text-accent hover:underline transition-colors"
                    title={activeItem.repoAlias}
                  >
                    {activeItem.repoAlias}
                  </Link>
                </div>
              </div>

              <div className="h-px bg-line/40" />

              {/* Row 2: 问题分支 (单独一行，点击直接进入) */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                <span className="w-16 shrink-0 whitespace-nowrap text-[11px] font-medium text-ink-muted sm:w-20">{t('workdesk.detail.problemBranch')}</span>
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Link
                    href={`/git/${encodeURIComponent(activeItem.repoId)}/branch/${encodeURIComponent(activeItem.name)}`}
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-ink hover:text-accent hover:underline transition-colors break-all select-all"
                    title={activeItem.name}
                  >
                    <LuGitBranch className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                    <span>{activeItem.name}</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* 2. CR 诊断分析 (类似 CR 代码审查：问题描述、产生原因、潜在风险、解决方案) */}
            {(() => {
              const cr = getCrAnalysis(card.id, activeItem, locale)
              return (
                <div className="flex flex-col gap-3 rounded-lg border border-line/70 bg-panel-2/40 p-3.5">
                  {/* 问题描述 */}
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                      <span className="size-1.5 rounded-full bg-accent" />
                      {t('workdesk.detail.problemDesc')}
                    </span>
                    <p className="pl-3 text-xs font-medium leading-relaxed text-ink">
                      {localizeWorkdeskSummary(activeItem.summary, t as (key: MessageKey, params?: Record<string, string | number>) => string)}
                    </p>
                  </div>

                  {/* 产生原因 */}
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft">
                      <span className="size-1.5 rounded-full bg-line-contrast" />
                      {t('workdesk.detail.causeTitle')}
                    </span>
                    <p className="pl-3 text-xs leading-relaxed text-ink-muted">{cr.cause}</p>
                  </div>

                  {/* 潜在风险 */}
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      {t('workdesk.detail.riskTitle')}
                    </span>
                    <p className="pl-3 text-xs leading-relaxed text-ink-muted">{cr.risk}</p>
                  </div>

                  {/* 解决方案 */}
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#28a388]">
                      <span className="size-1.5 rounded-full bg-[#28a388]" />
                      {t('workdesk.detail.solutionTitle')}
                    </span>
                    <div className="ml-3 whitespace-pre-line rounded-md border border-line/60 bg-panel/60 p-2.5 text-xs leading-relaxed text-ink font-mono">{cr.solution}</div>
                  </div>
                </div>
              )
            })()}

            {/* 3. 由 Git Agent 协助处理此任务 (参考上述解决方案执行) */}
            {card.id !== 'standard-project-organization' ? (
              <div className="flex flex-col gap-3 rounded-lg border border-[#b5ddd4] bg-[#f4faf7] p-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/40 dark:bg-emerald-950/20">
                <div className="flex min-w-0 flex-1 flex-col pr-3">
                  <span className="text-xs font-semibold text-ink">{t('workdesk.detail.agentAssistTitle')}</span>
                  <span className="mt-0.5 text-[11px] text-ink-muted">{t('workdesk.detail.agentAssistDesc')}</span>
                </div>
                <Button size="sm" className="shrink-0 gap-1.5" onClick={() => handleSendToAgent()}>
                  <LuBot className="size-3.5" aria-hidden="true" />
                  <span>{t('workdesk.action.sendToAgent')}</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border border-[#b5ddd4] bg-[#f4faf7] p-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/40 dark:bg-emerald-950/20">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-ink">{t('workdesk.organization.bannerTitle')}</span>
                  <span className="mt-0.5 text-[11px] text-ink-muted">{t('workdesk.organization.bannerDesc')}</span>
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    quotePromptToAgent(t('workdesk.organization.prompt'))
                  }}
                >
                  <LuFolderTree className="mr-1.5 size-3.5" aria-hidden="true" />
                  {t('workdesk.organization.bannerAction')}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-ink-muted">{t('workdesk.detail.selectPrompt')}</div>
      )}
    </div>
  )
}
