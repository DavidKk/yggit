'use client'

import Link from 'next/link'
import React from 'react'
import { LuArrowUpRight, LuGithub, LuShieldCheck } from 'react-icons/lu'

import { BrandMark } from '@/components/BrandLogo'
import { useT } from '@/components/i18n/LocaleProvider'
import { useOptionalAgent } from '@/lib/agent/agent-context'

import { SettingsSectionCard } from './SettingsSectionCard'

const TECH_STACK = ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'isomorphic-git', 'Base UI', 'IndexedDB']

export function AboutSettingsSection() {
  const t = useT()
  const agent = useOptionalAgent()
  const redactionEnabled = agent?.redactionOptions.enabled ?? true

  const coreCapabilities = [
    {
      title: t('gitAgent.aboutCapGitTitle') || 'Git Visualization',
      desc: t('gitAgent.aboutCapGitDesc') || 'Interactive commit graph, branch governance, and conflict analysis',
    },
    {
      title: t('gitAgent.aboutCapWorkdeskTitle') || 'Workdesk',
      desc: t('gitAgent.aboutCapWorkdeskDesc') || 'Multi-repo management and parallel development task checks',
    },
    {
      title: t('gitAgent.aboutCapAgentTitle') || 'Yggi Assistant',
      desc: t('gitAgent.aboutCapAgentDesc') || 'Cloud API, CLI, and browser-local AI support',
    },
    {
      title: t('gitAgent.aboutCapExtTitle') || 'Open Extensions',
      desc: t('gitAgent.aboutCapExtDesc') || 'Skills specifications and HTTP MCP tool ecosystem',
    },
    {
      title: t('gitAgent.aboutCapDriverTitle') || 'Dual Driver Mode',
      desc: t('gitAgent.aboutCapDriverDesc') || 'Flexible Local / Edge execution',
    },
  ]

  return (
    <div className="space-y-4 text-ink">
      {/* Top Hero Card */}
      <section className="rounded-xl border border-line bg-panel p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <BrandMark className="size-12 shrink-0" />
            <div className="space-y-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-lg font-bold tracking-tight text-accent">Yggit</h2>
                <span className="font-mono text-xs text-ink-soft">v0.0.2</span>
              </div>
              <p className="text-xs text-ink">{t('gitAgent.aboutSubtitle') || 'Local-first Git visual workspace & intelligent engineering assistant'}</p>
              <p className="text-[11px] text-ink-soft">Yggdrasil · World Tree</p>
            </div>
          </div>

          <a
            href="https://github.com/DavidKk/yggit"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel-2/60 px-3 py-1.5 text-xs font-medium text-ink hover:border-accent/50 hover:text-accent transition-colors"
          >
            <LuGithub className="size-3.5" aria-hidden="true" />
            <span>GitHub</span>
          </a>
        </div>
      </section>

      {/* Two-Column Middle Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SettingsSectionCard title={t('gitAgent.aboutCoreTitle') || 'Core Capabilities'} className="h-full">
          <div className="space-y-3.5">
            {coreCapabilities.map((cap) => (
              <div key={cap.title} className="space-y-0.5">
                <div className="text-xs font-semibold text-ink">{cap.title}</div>
                <p className="text-[11px] text-ink-soft leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </SettingsSectionCard>

        <div className="flex flex-col gap-4">
          <SettingsSectionCard title={t('gitAgent.aboutPrivacyTitle') || 'Privacy & Data Security'}>
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <LuShieldCheck className="size-4 text-accent shrink-0" aria-hidden="true" />
                <span>{t('gitAgent.aboutPrivacyHeadline') || 'Your code stays under your control'}</span>
              </div>
              <p className="text-[11px] text-ink-soft leading-relaxed">
                {t('gitAgent.aboutPrivacyDesc') || 'Repository data and indexes stay on your device. Yggit servers never store your source code, Git history, or analysis data.'}
              </p>
              <div className="flex items-center justify-between border-t border-line/70 pt-2.5 text-xs">
                <span className="text-ink-soft">{t('gitAgent.aboutPrivacyMasking') || 'Client-side Sensitive Data Redaction'}</span>
                <span className={redactionEnabled ? 'font-medium text-accent' : 'font-medium text-ink-soft'}>
                  {redactionEnabled ? t('gitAgent.aboutStatusEnabled') || 'Enabled' : t('gitAgent.aboutStatusDisabled') || 'Disabled'}
                </span>
              </div>
            </div>
          </SettingsSectionCard>

          <SettingsSectionCard title={t('gitAgent.aboutDiagnosticsTitle') || 'Diagnostics & Support'}>
            <div className="-mx-4 -my-3 divide-y divide-line/70">
              <Link
                href="/dev/logs/operations"
                className="flex items-center justify-between px-4 py-3 text-xs font-medium text-ink hover:bg-panel-2/70 hover:text-accent transition-colors"
              >
                <span>{t('gitAgent.aboutOpenLogs') || 'Runtime Logs'}</span>
                <LuArrowUpRight className="size-3.5 text-ink-soft" aria-hidden="true" />
              </Link>
              <Link
                href="/dev/logs/context"
                className="flex items-center justify-between px-4 py-3 text-xs font-medium text-ink hover:bg-panel-2/70 hover:text-accent transition-colors"
              >
                <span>{t('gitAgent.aboutOpenAgentLogs') || 'Agent Logs'}</span>
                <LuArrowUpRight className="size-3.5 text-ink-soft" aria-hidden="true" />
              </Link>
            </div>
          </SettingsSectionCard>
        </div>
      </div>

      {/* Bottom Tech Stack & License Card */}
      <SettingsSectionCard title={t('gitAgent.aboutBuiltWith') || 'Built with'}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {TECH_STACK.map((tech) => (
              <span key={tech} className="rounded-md border border-line bg-panel-2 px-2.5 py-1 font-mono text-[11px] text-ink-soft">
                {tech}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3 text-[11px] text-ink-soft">
            <span>Yggit · An open-source project by DavidJones</span>
            <span>MIT License</span>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
