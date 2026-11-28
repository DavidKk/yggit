'use client'

import React from 'react'
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button, Select } from '@/components/sk'

export const DEV_LOGS_PAGE_SIZE_OPTIONS = [25, 50, 100] as const

interface DevLogsPaginationProps {
  page: number
  pageSize: number
  filteredCount: number
  totalCount: number
  retentionMax: number
  retentionDays: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

/**
 * Shared footer bar for Dev log panels: entry totals, active retention cap, and pagination controls.
 */
export function DevLogsPagination({
  page,
  pageSize,
  filteredCount,
  totalCount,
  retentionMax,
  retentionDays,
  onPageChange,
  onPageSizeChange,
}: DevLogsPaginationProps) {
  const t = useT()
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)

  const retentionText = (t('gitAgent.devLogsRetentionHint') || 'Cap {max} · {days}d')
    .replace('{max}', String(retentionMax))
    .replace('{days}', String(retentionDays))

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line bg-paper-2 px-3 py-1.5 text-[11px] text-ink-soft tabular-nums">
      <div className="flex items-center gap-2">
        <span>
          {(t('gitAgent.devLogsShowingCount') || 'Showing {filtered} / {total} entries')
            .replace('{filtered}', String(filteredCount))
            .replace('{total}', String(totalCount))}
        </span>
        <span className="h-3 w-px bg-line" aria-hidden="true" />
        <span>{retentionText}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Select
          size="mini"
          panelWidth="content"
          aria-label={(t('gitAgent.devLogsPerPage') || '{size} / page').replace('{size}', String(pageSize))}
          className="w-[5.25rem] shrink-0 text-[11px]"
          value={String(pageSize)}
          options={DEV_LOGS_PAGE_SIZE_OPTIONS.map((size) => ({
            value: String(size),
            label: (t('gitAgent.devLogsPerPage') || '{size} / page').replace('{size}', String(size)),
          }))}
          onChange={(val) => onPageSizeChange(Number(val) || 50)}
        />
        <div className="flex items-center gap-1">
          <Button
            variant="plain"
            size="icon"
            className="size-6"
            disabled={safePage <= 1}
            aria-label={t('gitAgent.devLogsPrevPage') || 'Previous page'}
            tooltip={t('gitAgent.devLogsPrevPage') || 'Previous page'}
            onClick={() => onPageChange(safePage - 1)}
          >
            <LuChevronLeft className="size-3.5" />
          </Button>
          <span className="min-w-[3.25rem] text-center font-mono text-ink" aria-live="polite">
            {safePage} / {totalPages}
          </span>
          <Button
            variant="plain"
            size="icon"
            className="size-6"
            disabled={safePage >= totalPages}
            aria-label={t('gitAgent.devLogsNextPage') || 'Next page'}
            tooltip={t('gitAgent.devLogsNextPage') || 'Next page'}
            onClick={() => onPageChange(safePage + 1)}
          >
            <LuChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
