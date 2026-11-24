'use client'

import Link from 'next/link'
import React from 'react'
import { LuArrowRight, LuFolderGit2, LuPlay, LuSparkles } from 'react-icons/lu'

import { useLocaleCode, useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button } from '@/components/sk'
import { cn } from '@/lib/utils'

export interface LandingHeroProps {
  timePresetId?: 'day' | 'night'
  className?: string
}

export function LandingHero({ className }: LandingHeroProps) {
  const t = useT()
  const locale = useLocaleCode()
  const isZh = locale.startsWith('zh')

  return (
    <section
      aria-label="Hero"
      className={cn(
        'pointer-events-auto absolute left-[4%] sm:left-[5%] top-[19%] sm:top-[21%] lg:top-[23%] w-[92%] sm:w-[58%] lg:w-[35%] xl:w-[32%] z-30',
        'rounded-3xl border border-white/10 bg-[#020a0f]/45 backdrop-blur-md p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.36)]',
        'flex flex-col justify-center space-y-3 select-text transition-all duration-700 ease-out',
        className
      )}
    >
      {/* Category Pill */}
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-300 backdrop-blur-md shadow-xs">
          <LuSparkles className="size-3 shrink-0 animate-pulse text-emerald-300" />
          <span>{isZh ? 'Git 可视化 · 智能工作台 · 合并追溯' : 'Git Visualization · Smart Workdesk · Traceability'}</span>
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight leading-[1.18] text-white">
        {isZh ? '每一次提交，' : 'Every commit,'}
        <span className="block mt-0.5 text-accent">{isZh ? '都有迹可循。' : 'traceable & clear.'}</span>
      </h1>

      {/* Description */}
      <p className="max-w-md text-xs sm:text-[13px] leading-relaxed font-normal text-slate-300">
        {isZh
          ? '从分支创建到合并提交，以世界树 DAG 原生拓扑看清代码演进脉络，虚拟队友协同，毫秒级响应，让复杂的 Git 历史清晰可见。'
          : 'From branch creation to merge commits, explore code evolution with the World Tree DAG topology. Dual-engine native performance with AI Virtual Teammate.'}
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
        <Link href="/workdesk" className="no-underline">
          <Button variant="accent" size="sm" className="gap-1.5 shadow-md hover:shadow-accent/30 font-semibold text-xs sm:text-sm h-9 px-4">
            <span>{isZh ? '进入工作台' : 'Enter Workdesk'}</span>
            <LuArrowRight className="size-3.5" />
          </Button>
        </Link>
        <Link href="/git" className="no-underline">
          <Button size="sm" className="gap-1.5 border border-white/20 bg-white/10 hover:bg-white/20 text-white font-medium text-xs sm:text-sm h-9 px-3.5 backdrop-blur-sm">
            <LuFolderGit2 className="size-3.5 text-accent" />
            <span>{t('git.project.addLocal')}</span>
          </Button>
        </Link>
        <Link href="/git/github/DavidKk/yggit" className="no-underline">
          <Button variant="ghost" size="sm" className="gap-1.5 text-slate-200 hover:text-white hover:bg-white/10 text-xs sm:text-sm h-9 px-3">
            <LuPlay className="size-3 text-accent fill-accent" />
            <span>{isZh ? '在线体验' : 'Online Demo'}</span>
          </Button>
        </Link>
      </div>

      {/* Platform Strip */}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-medium text-slate-300">
        <span className="flex items-center gap-1.5">
          <svg className="size-3.5 text-white shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
          <span>GitHub</span>
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="size-3.5 text-orange-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.65 14.39 12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94Z" />
          </svg>
          <span>GitLab</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Badge tone="neutral" size="mini">
            Edge / Local
          </Badge>
        </span>
        <span className="flex items-center gap-1.5">
          <Badge tone="ok" size="mini">
            60 FPS WebGL
          </Badge>
        </span>
      </div>
    </section>
  )
}
