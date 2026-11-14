'use client'

import { useId } from 'react'

import { useT } from '@/components/i18n/LocaleProvider'
import { cn } from '@/lib/utils'

/** Keep in sync with GitGraph PAD / COL — first-lane center when graph scrollLeft is 0. */
const GRAPH_PAD = 12
const GRAPH_COL = 22
/** Main root path entry `M36,1` in the SVG viewBox. */
const ROOT_ENTRY_X = 36

/** Bottom load-more strip: roots align to lane 0 by default; copy centered; does not follow graph pan. */
export function GitExploreStrip({ className }: { className?: string }) {
  const t = useT()
  const rawId = useId().replace(/:/g, '')
  const glowTeal = `git-ex-glow-teal-${rawId}`
  const glowGold = `git-ex-glow-gold-${rawId}`
  const horizon = `git-ex-horizon-${rawId}`
  const rootGrad = `git-ex-root-${rawId}`
  const ambient = `git-ex-ambient-${rawId}`
  const rootLeft = `calc(var(--git-branch-w, 9.75rem) + ${GRAPH_PAD + GRAPH_COL / 2 - ROOT_ENTRY_X}px)`

  return (
    <div
      className={cn('relative flex min-h-[42px] w-full items-center border-t border-[color-mix(in_oklab,var(--wt-primary)_18%,transparent)]', className)}
      role="status"
      aria-live="polite"
      aria-label={t('git.explore.diving')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 42"
        width={200}
        height={42}
        className="pointer-events-none absolute top-1/2 block -translate-y-1/2"
        style={{ left: rootLeft }}
        aria-hidden
      >
        <defs>
          <filter id={glowTeal} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={glowGold} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.8" result="blur1" />
            <feGaussianBlur stdDeviation="1" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id={horizon} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--mist, #232933)" stopOpacity="0" />
            <stop offset="18%" stopColor="var(--focus-contrast, #3b82f6)" stopOpacity="0.9" />
            <stop offset="45%" stopColor="var(--wt-primary, #3cd2a8)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--mist, #232933)" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={rootGrad} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--wt-primary, #3cd2a8)" />
            <stop offset="68%" stopColor="var(--wt-primary-glow, #b8ffea)" />
            <stop offset="100%" stopColor="var(--focus-contrast, #3b82f6)" />
          </linearGradient>

          <radialGradient id={ambient} cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor="var(--paper-glow-top, #132a28)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--paper, #14171c)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <style>{`
          .git-ex-grid {
            stroke: var(--mist, #232933);
            stroke-width: 1;
            stroke-dasharray: 2 6;
          }
          .git-ex-main {
            fill: none;
            stroke: url(#${rootGrad});
            stroke-width: 2.2;
            stroke-linecap: round;
            filter: url(#${glowTeal});
            stroke-dasharray: 100;
            animation: git-ex-draw-main 3.2s infinite ease-in-out;
          }
          .git-ex-sub {
            fill: none;
            stroke: var(--wt-secondary, #0ea5e9);
            stroke-width: 1.3;
            stroke-linecap: round;
            stroke-dasharray: 100;
          }
          .git-ex-s1 { animation: git-ex-draw-s1 3.2s infinite ease-out; }
          .git-ex-s2 { animation: git-ex-draw-s2 3.2s infinite ease-out; stroke: var(--wt-merge, #d946ef); opacity: 0.85; }
          .git-ex-s3 { animation: git-ex-draw-s3 3.2s infinite ease-out; }
          .git-ex-s4 { animation: git-ex-draw-s4 3.2s infinite ease-out; }
          .git-ex-node-teal  { fill: var(--wt-primary-glow, #b8ffea); filter: url(#${glowTeal}); }
          .git-ex-node-coral { fill: var(--fail, #ec4899); filter: url(#${glowGold}); }
          .git-ex-node-gold  { fill: var(--wt-modified, #eab308); stroke: var(--focus-contrast, #3b82f6); stroke-width: 1; filter: url(#${glowGold}); }
          .git-ex-n1 { animation: git-ex-pop-n1 3.2s infinite ease-out; }
          .git-ex-n2 { animation: git-ex-pop-n2 3.2s infinite ease-out; }
          .git-ex-n3 { animation: git-ex-pop-n3 3.2s infinite ease-out; }
          .git-ex-n-main { animation: git-ex-pop-main 3.2s infinite ease-out; }
          .git-ex-spore-gold { fill: var(--wt-modified, #eab308); animation: git-ex-spore 3.2s infinite ease-in-out; }
          .git-ex-spore-teal { fill: var(--wt-primary, #3cd2a8); animation: git-ex-spore 3.2s infinite ease-in-out; }
          @keyframes git-ex-draw-main {
            0% { stroke-dashoffset: 100; opacity: 0; }
            10% { opacity: 1; }
            68%, 84% { stroke-dashoffset: 0; opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          @keyframes git-ex-draw-s1 {
            0%, 14% { stroke-dashoffset: 100; opacity: 0; }
            24% { opacity: 1; }
            52%, 84% { stroke-dashoffset: 0; opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          @keyframes git-ex-draw-s2 {
            0%, 26% { stroke-dashoffset: 100; opacity: 0; }
            36% { opacity: 1; }
            62%, 84% { stroke-dashoffset: 0; opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          @keyframes git-ex-draw-s3 {
            0%, 38% { stroke-dashoffset: 100; opacity: 0; }
            48% { opacity: 1; }
            72%, 84% { stroke-dashoffset: 0; opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          @keyframes git-ex-draw-s4 {
            0%, 48% { stroke-dashoffset: 100; opacity: 0; }
            58% { opacity: 1; }
            78%, 84% { stroke-dashoffset: 0; opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          @keyframes git-ex-pop-n1 { 0%, 45% { opacity: 0; r: 0; } 55%, 84% { opacity: 1; r: 2; } 100% { opacity: 0; r: 0; } }
          @keyframes git-ex-pop-n2 { 0%, 55% { opacity: 0; r: 0; } 65%, 84% { opacity: 1; r: 2.4; } 100% { opacity: 0; r: 0; } }
          @keyframes git-ex-pop-n3 { 0%, 65% { opacity: 0; r: 0; } 75%, 84% { opacity: 1; r: 2.2; } 100% { opacity: 0; r: 0; } }
          @keyframes git-ex-pop-main { 0%, 62% { opacity: 0; r: 0; } 72%, 84% { opacity: 1; r: 3.5; } 100% { opacity: 0; r: 0; } }
          @keyframes git-ex-spore {
            0%, 100% { opacity: 0.15; transform: translateY(0); }
            50% { opacity: 0.75; transform: translateY(1.5px); }
          }
          .git-ex-ellipsis {
            display: inline-block;
            width: 1.25em;
            text-align: left;
          }
          .git-ex-ellipsis::after {
            content: '.';
            animation: git-ex-dots 1.4s infinite;
          }
          @keyframes git-ex-dots {
            0%, 24% { content: '.'; }
            25%, 49% { content: '..'; }
            50%, 100% { content: '...'; }
          }
        `}</style>

        <rect width="200" height="42" fill={`url(#${ambient})`} />
        <line x1="4" y1="1" x2="196" y2="1" stroke={`url(#${horizon})`} strokeWidth={1} />
        <line x1="8" y1="16" x2="192" y2="16" className="git-ex-grid" />
        <line x1="8" y1="31" x2="192" y2="31" className="git-ex-grid" />

        <circle cx="52" cy="12" r="1.2" className="git-ex-spore-gold" />
        <circle cx="105" cy="24" r="1.2" className="git-ex-spore-teal" />
        <circle cx="152" cy="11" r="1.3" className="git-ex-spore-gold" />

        <path className="git-ex-sub git-ex-s1" pathLength={100} d="M39,10 C30,15 24,22 22,34" />
        <path className="git-ex-sub git-ex-s2" pathLength={100} d="M78,15 C78,24 72,29 70,37" />
        <path className="git-ex-sub git-ex-s3" pathLength={100} d="M115,15 C128,9 138,18 140,34" />
        <path className="git-ex-sub git-ex-s4" pathLength={100} d="M168,24 C162,29 160,34 159,39" />
        <path className="git-ex-main" pathLength={100} d="M36,1 C36,14 48,16 75,15 C110,14 145,12 165,21 C176,26 181,31 182,38" />

        <circle cx="22" cy="34" r="2" className="git-ex-node-teal git-ex-n1" />
        <circle cx="70" cy="37" r="2.4" className="git-ex-node-coral git-ex-n2" />
        <circle cx="140" cy="34" r="2.2" className="git-ex-node-gold git-ex-n3" />
        <circle cx="182" cy="38" r="3.5" className="git-ex-node-gold git-ex-n-main" />
      </svg>
      <p className="relative z-[1] m-0 flex min-w-0 flex-1 items-center justify-center px-4 text-center text-[0.8125rem] font-medium tracking-wide text-ink">
        <span className="truncate">{t('git.explore.diving')}</span>
        <span className="git-ex-ellipsis" aria-hidden />
      </p>
    </div>
  )
}
