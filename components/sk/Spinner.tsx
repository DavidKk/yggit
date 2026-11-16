'use client'

import { useId } from 'react'

import { cn } from '@/lib/utils'

export type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZE: Record<SpinnerSize, string> = {
  sm: 'size-4 shrink-0',
  md: 'size-5 shrink-0',
  lg: 'size-8 shrink-0',
}

/**
 * Universal Yggdrasil world-tree energy spinner.
 * Features an animated orbital ring, breathing branches, and pulsing celestial nodes.
 */
export function Spinner({ size = 'md', className, label = '加载中' }: { size?: SpinnerSize; className?: string; label?: string }) {
  const rawId = useId()
  const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '')
  const gradId = `ygg-grad-${cleanId}`
  const glowId = `ygg-glow-${cleanId}`

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" role="status" aria-label={label} className={cn(SIZE[size], 'inline-block select-none', className)}>
      <style>{`
        .ygg-ring-${cleanId} {
          transform-origin: 50px 50px;
          animation: ygg-spin-${cleanId} 8s linear infinite;
        }
        .ygg-branch-${cleanId} {
          stroke-dasharray: 80;
          stroke-dashoffset: 80;
          animation: ygg-grow-${cleanId} 2.4s ease-in-out infinite;
        }
        .ygg-node-${cleanId} {
          animation: ygg-pulse-${cleanId} 2.4s ease-in-out infinite;
        }
        .ygg-node-delay-${cleanId} {
          animation: ygg-pulse-${cleanId} 2.4s ease-in-out 0.6s infinite;
        }
        @keyframes ygg-spin-${cleanId} {
          100% { transform: rotate(360deg); }
        }
        @keyframes ygg-grow-${cleanId} {
          0% { stroke-dashoffset: 80; opacity: 0.35; }
          50% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -80; opacity: 0.35; }
        }
        @keyframes ygg-pulse-${cleanId} {
          0%, 100% { opacity: 0.3; transform: scale(0.85); transform-origin: 50px 50px; }
          50% { opacity: 1; transform: scale(1.15); transform-origin: 50px 50px; }
        }
      `}</style>

      <defs>
        <linearGradient id={gradId} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="55%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer energy ring */}
      <circle
        className={`ygg-ring-${cleanId}`}
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2.2"
        strokeDasharray="18 10 6 10"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#10b981" strokeWidth="1.2" opacity="0.22" />

      {/* World-tree underlying track */}
      <g fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" opacity="0.22">
        <path d="M50 78 V26" />
        <path d="M50 56 C36 52 28 42 28 30" />
        <path d="M50 56 C64 52 72 42 72 30" />
        <path d="M50 44 C40 38 36 28 40 20" />
        <path d="M50 44 C60 38 64 28 60 20" />
        <path d="M50 68 C40 72 34 78 32 84" />
        <path d="M50 68 C60 72 66 78 68 84" />
      </g>

      {/* World-tree flowing luminous branches */}
      <g className={`ygg-branch-${cleanId}`} fill="none" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" filter={`url(#${glowId})`}>
        <path d="M50 82 V24" />
        <path d="M50 56 C36 52 28 42 28 30" />
        <path d="M50 56 C64 52 72 42 72 30" />
        <path d="M50 44 C40 38 36 28 40 20" />
        <path d="M50 44 C60 38 64 28 60 20" />
        <path d="M50 68 C40 72 34 78 32 84" />
        <path d="M50 68 C60 72 66 78 68 84" />
      </g>

      {/* Canopy star nodes */}
      <g fill="#14b8a6" stroke="none" filter={`url(#${glowId})`}>
        <circle className={`ygg-node-${cleanId}`} cx="50" cy="20" r="3.5" />
        <circle className={`ygg-node-delay-${cleanId}`} cx="28" cy="28" r="3" />
        <circle className={`ygg-node-delay-${cleanId}`} cx="72" cy="28" r="3" />
        <circle className={`ygg-node-${cleanId}`} cx="39" cy="19" r="2.5" />
        <circle className={`ygg-node-${cleanId}`} cx="61" cy="19" r="2.5" />
      </g>
    </svg>
  )
}
