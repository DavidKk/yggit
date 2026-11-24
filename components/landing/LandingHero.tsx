'use client'

import Link from 'next/link'
import React from 'react'
import { LuArrowRight, LuFolderGit2, LuGitFork, LuPlay } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { cn } from '@/lib/utils'

export interface LandingHeroProps {
  timePresetId?: 'day' | 'night'
  className?: string
}

export function LandingHero({ className }: LandingHeroProps) {
  const t = useT()

  return (
    <section
      aria-label="Hero"
      className={cn(
        'pointer-events-auto absolute left-[4%] sm:left-[5.5%] top-[19%] sm:top-[21%] lg:top-[23%] w-[92%] sm:w-[58%] lg:w-[35%] xl:w-[33%] z-30',
        'flex flex-col justify-center space-y-3.5 select-text transition-all duration-700 ease-out',
        className
      )}
    >
      {/* Soft Ambient Radial Vignette behind text to guarantee contrast against bright sky in Day mode without a boxed card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-12 -inset-y-12 -z-10 rounded-full bg-radial-[circle_at_30%_45%] from-[#020d14]/75 via-[#020d14]/35 to-transparent blur-2xl"
      />

      {/* Category Pill */}
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#26a085]/40 bg-[#04202c]/75 px-3.5 py-1 text-[11px] sm:text-xs font-semibold tracking-wide text-[#6ef9d4] backdrop-blur-md shadow-[0_0_14px_rgba(38,160,133,0.22)]">
          <LuGitFork className="size-3.5 shrink-0 text-[#38f9d7]" />
          <span>{t('landing.hero.categoryPill')}</span>
        </span>
      </div>

      {/* Main Headline with curved cyan light swoosh */}
      <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight leading-[1.12]">
        <span className="block text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">{t('landing.hero.headlinePart1')}</span>
        <div className="relative mt-1 inline-block">
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#34ecc2] via-[#2ce6bf] to-[#43e97b] drop-shadow-[0_0_24px_rgba(52,236,194,0.45)]">
            {t('landing.hero.headlineHighlight')}
          </span>
          {/* Subtle curved neon light accent under headline matching reference */}
          <svg className="absolute -bottom-2.5 left-0 w-full max-w-[280px] h-3.5 overflow-visible pointer-events-none opacity-90" viewBox="0 0 280 14" fill="none">
            <path d="M 0 4 Q 70 12 140 8 T 280 3" stroke="url(#cyanGlow)" strokeWidth="2.5" strokeLinecap="round" />
            <defs>
              <linearGradient id="cyanGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38f9d7" stopOpacity="0" />
                <stop offset="25%" stopColor="#38f9d7" stopOpacity="0.95" />
                <stop offset="75%" stopColor="#43e97b" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#38f9d7" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </h1>

      {/* Description */}
      <p className="max-w-lg text-xs sm:text-[13.5px] leading-relaxed font-normal text-[#c6dbe2] drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] pt-1">{t('landing.hero.description')}</p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link href="/workdesk" className="no-underline">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1ee3ad] via-[#1cd1ab] to-[#0ba89b] px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold text-[#031d1d] shadow-[0_0_22px_rgba(30,227,173,0.45)] hover:shadow-[0_0_32px_rgba(30,227,173,0.65)] hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>{t('landing.hero.enterWorkdesk')}</span>
            <LuArrowRight className="size-4 stroke-[2.5]" />
          </button>
        </Link>
        <Link href="/git" className="no-underline">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#225d6b] bg-[#072430]/85 hover:bg-[#0c3342] hover:border-[#38f9d7]/60 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium text-white shadow-sm backdrop-blur-md active:scale-[0.98] transition-all cursor-pointer"
          >
            <LuFolderGit2 className="size-4 text-[#38f9d7]" />
            <span>{t('git.project.addLocal')}</span>
          </button>
        </Link>
        <Link href="/git/github/DavidKk/yggit" className="no-underline">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-3 sm:px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#d3e5eb] hover:text-white hover:bg-white/10 active:scale-[0.98] transition-colors cursor-pointer"
          >
            <LuPlay className="size-3.5 text-[#38f9d7] fill-[#38f9d7]" />
            <span>{t('landing.hero.onlineDemo')}</span>
          </button>
        </Link>
      </div>

      {/* Platform Strip */}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] sm:text-xs font-medium text-[#c0d6de] drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
        <span className="flex items-center gap-1.5 hover:text-white transition-colors">
          <svg className="size-3.5 text-white shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
          <span>GitHub</span>
        </span>
        <span className="flex items-center gap-1.5 hover:text-white transition-colors">
          <svg className="size-3.5 text-orange-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.65 14.39 12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94Z" />
          </svg>
          <span>GitLab</span>
        </span>
        <span className="text-white/40">·</span>
        <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm shadow-xs">
          {t('landing.hero.edgeLocal')}
        </span>
      </div>
    </section>
  )
}
