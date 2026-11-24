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
    <>
      <style>{`
        @keyframes heroBtnShimmer {
          0% {
            transform: translateX(-150%) skewX(-20deg);
          }
          40%, 100% {
            transform: translateX(220%) skewX(-20deg);
          }
        }
        @keyframes heroCurveDraw {
          0% {
            stroke-dashoffset: 460;
            opacity: 0.2;
          }
          30% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }
        @keyframes heroNeonPulse {
          0%, 100% {
            filter: drop-shadow(0 0 6px rgba(56, 249, 215, 0.7)) drop-shadow(0 0 16px rgba(56, 249, 215, 0.35));
            opacity: 0.9;
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(56, 249, 215, 1)) drop-shadow(0 0 24px rgba(67, 233, 123, 0.65));
            opacity: 1;
          }
        }
        .hero-curve-animate {
          stroke-dasharray: 460;
          animation: heroCurveDraw 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards, heroNeonPulse 3.6s ease-in-out infinite 1.4s;
        }
        .hero-btn-shimmer {
          animation: heroBtnShimmer 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      <section
        aria-label="Hero"
        className={cn(
          'pointer-events-auto absolute left-[4.5%] sm:left-[5.5%] lg:left-[6%] top-[20%] sm:top-[21.5%] lg:top-[22.5%]',
          'w-[92%] sm:w-[60%] lg:w-[41%] xl:w-[37%] z-30',
          'flex flex-col justify-between min-h-[400px] lg:h-[434px] select-text transition-all duration-700 ease-out',
          className
        )}
      >
        {/* Soft Ambient Radial Vignette to ensure contrast against daytime sun without a hard card border */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-14 -inset-y-12 -z-10 rounded-full bg-radial-[circle_at_30%_45%] from-[#020d14]/75 via-[#020d14]/35 to-transparent blur-3xl"
        />

        {/* 1. Category Pill / Badge */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#26a085]/50 bg-[#04202c]/85 px-4 py-1.5 text-xs sm:text-[13px] font-semibold tracking-wide text-[#6ef9d4] backdrop-blur-md shadow-[0_0_18px_rgba(38,160,133,0.3)]">
            <LuGitFork className="size-4 shrink-0 text-[#38f9d7]" />
            <span>{t('landing.hero.categoryPill')}</span>
          </span>
        </div>

        {/* 2. Main Headline with Smooth Glowing Neon Underline */}
        <div className="space-y-1">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[46px] xl:text-[52px] font-extrabold tracking-tight leading-[1.08]">
            <span className="block text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.85)]">{t('landing.hero.headlinePart1')}</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#34ecc2] via-[#2ce6bf] to-[#43e97b] drop-shadow-[0_0_28px_rgba(52,236,194,0.5)]">
              {t('landing.hero.headlineHighlight')}
            </span>
          </h1>

          {/* Graceful S-Curved Neon Beam under "traceable & clear." */}
          <div className="relative pt-1 w-full max-w-[420px] overflow-visible pointer-events-none">
            <svg className="w-full h-7 overflow-visible hero-curve-animate" viewBox="0 0 420 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="auroraNeonBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38f9d7" stopOpacity="0" />
                  <stop offset="12%" stopColor="#38f9d7" stopOpacity="0.9" />
                  <stop offset="48%" stopColor="#6ef9d4" stopOpacity="1" />
                  <stop offset="82%" stopColor="#43e97b" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#38f9d7" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Outer ambient blur line */}
              <path d="M 6 10 C 90 24, 180 26, 270 16 C 330 9, 380 14, 414 7" stroke="#38f9d7" strokeWidth="7" strokeLinecap="round" className="opacity-35 blur-sm" />
              {/* Vibrant neon ribbon line */}
              <path d="M 6 10 C 90 24, 180 26, 270 16 C 330 9, 380 14, 414 7" stroke="url(#auroraNeonBeam)" strokeWidth="2.8" strokeLinecap="round" />
              {/* Core white highlight streak */}
              <path d="M 45 15 C 110 23, 195 24, 280 16 C 320 12, 360 13, 390 8" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" className="opacity-80" />
            </svg>
          </div>
        </div>

        {/* 3. Description Paragraph */}
        <p className="max-w-xl text-sm sm:text-[15px] leading-[1.65] font-normal text-[#c8dce4] drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">{t('landing.hero.description')}</p>

        {/* 4. Action Buttons (Dedicated Homepage Custom Styling) */}
        <div className="flex flex-wrap items-center gap-3.5 pt-1">
          {/* Green Flowing Light Button with White Text */}
          <Link href="/workdesk" className="no-underline">
            <button
              type="button"
              className={cn(
                'group relative overflow-hidden inline-flex items-center justify-center gap-2.5 rounded-2xl',
                'bg-gradient-to-r from-[#0ad8a5] via-[#1be5b5] to-[#04ba88] px-6 h-12',
                'text-white font-bold text-sm sm:text-base tracking-wide',
                'shadow-[0_0_25px_rgba(27,229,181,0.52)] hover:shadow-[0_0_38px_rgba(27,229,181,0.8)]',
                'hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer'
              )}
            >
              {/* Continuous flowing shimmer sweep */}
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 hero-btn-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <span className="relative z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">{t('landing.hero.enterWorkdesk')}</span>
              <LuArrowRight className="relative z-10 size-4.5 stroke-[2.5] transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </Link>

          {/* Add Local Button */}
          <Link href="/git" className="no-underline">
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-2xl',
                'border border-[#266e7f] bg-[#072430]/90 hover:border-[#38f9d7]/70 hover:bg-[#0c3545]',
                'px-5 h-12 text-sm sm:text-base font-semibold text-white shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md',
                'active:scale-[0.98] transition-all cursor-pointer'
              )}
            >
              <LuFolderGit2 className="size-4.5 text-[#38f9d7]" />
              <span>{t('git.project.addLocal')}</span>
            </button>
          </Link>

          {/* Online Demo Button */}
          <Link href="/git/github/DavidKk/yggit" className="no-underline">
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-2xl',
                'px-4 h-12 text-sm sm:text-base font-medium text-[#d6ecf3] hover:text-white hover:bg-white/10',
                'active:scale-[0.98] transition-colors cursor-pointer'
              )}
            >
              <LuPlay className="size-4 text-[#38f9d7] fill-[#38f9d7]" />
              <span>{t('landing.hero.onlineDemo')}</span>
            </button>
          </Link>
        </div>

        {/* 5. Platform Strip */}
        <div className="flex flex-wrap items-center gap-3.5 pt-1 text-xs sm:text-[13px] font-medium text-[#c0d6de] drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
          <span className="flex items-center gap-1.5 hover:text-white transition-colors">
            <svg className="size-4 text-white shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
            <span>GitHub</span>
          </span>
          <span className="flex items-center gap-1.5 hover:text-white transition-colors">
            <svg className="size-4 text-orange-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.65 14.39 12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94Z" />
            </svg>
            <span>GitLab</span>
          </span>
          <span className="text-white/40">·</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-xs font-medium text-white/90 backdrop-blur-sm shadow-xs">
            {t('landing.hero.edgeLocal')}
          </span>
        </div>
      </section>
    </>
  )
}
