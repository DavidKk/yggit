'use client'

import React from 'react'

import { AgentFairyIcon } from './AgentFairyIcon'

export interface GitAgentBarGhostsProps {
  vanishGhost: { x: number; y: number } | null
  reappearGhost: { x: number; y: number } | null
}

export function GitAgentBarGhosts({ vanishGhost, reappearGhost }: GitAgentBarGhostsProps) {
  return (
    <>
      <style>{`
        @keyframes pill-vanish {
          0% {
            width: 132px;
            left: var(--ghost-x);
            transform: scale(1);
            opacity: 1;
          }
          40% {
            width: 49px;
            left: calc(var(--ghost-x) + 41.5px);
            transform: scale(1);
            opacity: 1;
          }
          55% {
            width: 40px;
            left: calc(var(--ghost-x) + 46px);
            transform: scale(0.85);
            opacity: 1;
          }
          85% {
            width: 40px;
            left: calc(var(--ghost-x) + 46px);
            transform: scale(0.2);
            opacity: 0.8;
          }
          100% {
            width: 40px;
            left: calc(var(--ghost-x) + 46px);
            transform: scale(0);
            opacity: 0;
          }
        }

        @keyframes icon-scale-vanish {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
          55% {
            transform: scale(0.85);
            opacity: 1;
          }
          85% {
            transform: scale(0.2);
            opacity: 0.8;
          }
          100% {
            transform: scale(0);
            opacity: 0;
          }
        }

        @keyframes pill-reappear {
          0% {
            width: 40px;
            left: calc(var(--ghost-x) + 46px);
            transform: scale(0);
            opacity: 0;
          }
          45% {
            width: 40px;
            left: calc(var(--ghost-x) + 46px);
            transform: scale(1);
            opacity: 1;
          }
          100% {
            width: 132px;
            left: var(--ghost-x);
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes icon-scale-reappear {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          45% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes bottom-bar-expand {
          0% {
            width: 40px;
            transform: translateX(-50%) scale(0.7);
            opacity: 0.6;
          }
          30% {
            width: 40px;
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
          100% {
            width: min(90vw, 500px);
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
        }

        @keyframes bottom-bar-vanish {
          0% {
            width: min(90vw, 500px);
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
          40% {
            width: 86px;
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
          55% {
            width: 40px;
            transform: translateX(-50%) scale(0.85);
            opacity: 1;
          }
          85% {
            width: 40px;
            transform: translateX(-50%) scale(0.2);
            opacity: 0.8;
          }
          100% {
            width: 40px;
            transform: translateX(-50%) scale(0);
            opacity: 0;
          }
        }
      `}</style>

      {/* Vanishing Pill at Remote Position (shrinks symmetrically to circle, with robot icon visibly scaling down to 0) */}
      {vanishGhost && (
        <div
          style={
            {
              '--ghost-x': `${vanishGhost.x}px`,
              top: `${vanishGhost.y}px`,
              transformOrigin: 'center center',
              animation: 'pill-vanish 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
            } as React.CSSProperties
          }
          className="fixed z-40 flex h-10 items-center overflow-hidden rounded-full border border-accent bg-panel/90 shadow-md pointer-events-none pl-[5px]"
        >
          <div
            style={{
              transformOrigin: 'center center',
              animation: 'icon-scale-vanish 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-accent"
          >
            <AgentFairyIcon className="size-5" />
          </div>
        </div>
      )}

      {/* Reappearing Pill at Remote Position (scales in as circle with icon, then expands symmetrically to 132px mini capsule) */}
      {reappearGhost && (
        <div
          style={
            {
              '--ghost-x': `${reappearGhost.x}px`,
              top: `${reappearGhost.y}px`,
              transformOrigin: 'center center',
              animation: 'pill-reappear 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
            } as React.CSSProperties
          }
          className="fixed z-40 flex h-10 items-center overflow-hidden rounded-full border border-accent bg-panel/90 shadow-md pointer-events-none pl-[5px]"
        >
          <div
            style={{
              transformOrigin: 'center center',
              animation: 'icon-scale-reappear 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-accent"
          >
            <AgentFairyIcon className="size-5" />
          </div>
        </div>
      )}
    </>
  )
}
