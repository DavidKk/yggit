'use client'

import React from 'react'

import { BrandLogo } from '@/components/BrandLogo'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { useInWorkspaceHeader, WorkspaceHeaderSlot } from '@/components/layout/WorkspaceHeaderContext'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { WorkdeskHeaderSwitcher } from '@/components/workdesk/WorkdeskHeaderSwitcher'

import { AgentContextTracePanel } from './AgentContextTracePanel'
import { type DevLogsSectionKey, DevLogsSideNav } from './DevLogsSideNav'
import { OperationLogsPanel } from './OperationLogsPanel'

export function DevLogsPageContent({ section }: { section: DevLogsSectionKey }) {
  const t = useT()
  const inWorkspace = useInWorkspaceHeader()

  const meta =
    section === 'context'
      ? {
          title: t('gitAgent.devLogsTabAgent') || 'Agent Logs',
          desc: t('gitAgent.devLogsTabAgentDesc') || 'Captures request context, tool-call parsing, and raw model responses for tuning.',
        }
      : {
          title: t('gitAgent.devLogsTabLogs') || 'Logs',
          desc: t('gitAgent.devLogsTabLogsDesc') || 'Aggregated operation records and error stacks with one-click diagnostics export.',
        }

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-paper text-ink select-text">
      {inWorkspace ? (
        <WorkspaceHeaderSlot>
          <WorkdeskHeaderSwitcher />
        </WorkspaceHeaderSlot>
      ) : (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-panel-2/60 px-3 py-1.5">
          <div className="flex items-center gap-3">
            <BrandLogo href="/" className="shrink-0" markClassName="size-7" wordmarkClassName="text-[0.95rem]" />
            <span className="h-4 w-px shrink-0 bg-[color-mix(in_oklab,var(--ink)_16%,transparent)]" aria-hidden="true" />
            <WorkdeskHeaderSwitcher />
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeSwitcher compact />
            <LocaleSwitcher compact />
          </div>
        </header>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden bg-paper">
        <DevLogsSideNav activeSection={section} />

        {section === 'context' ? (
          <AgentContextTracePanel title={meta.title} desc={meta.desc} />
        ) : (
          <OperationLogsPanel title={meta.title} desc={meta.desc} />
        )}
      </div>
    </div>
  )
}
