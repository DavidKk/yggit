'use client'

import React from 'react'

import { cn } from '@/lib/utils'

interface AgentFairyIconProps {
  className?: string
  /** Speeds up wing flutter, orbiting flight, wand wave, twinkling star, and eye movement when processing. */
  active?: boolean
}

/**
 * Animated SVG mascot icon for Yggi featuring mint-green hair, Git branch brooch,
 * 4-point star wand, and fluttering periwinkle wings.
 */
export function AgentFairyIcon({ className, active = false }: AgentFairyIconProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('inline-block select-none overflow-visible', active && 'fairy-active', className)}
    >
      <style>{`
        @keyframes fairyWingLeft {
          0%, 100% { transform: rotate(0deg) scaleX(1); }
          50% { transform: rotate(-11deg) scaleX(0.8); }
        }
        @keyframes fairyWingRight {
          0%, 100% { transform: rotate(0deg) scaleX(1); }
          50% { transform: rotate(11deg) scaleX(0.8); }
        }
        @keyframes fairyFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-1.8px); }
        }
        @keyframes fairyOrbit {
          0%   { transform: translate(0px, -4.5px) rotate(-4deg); }
          25%  { transform: translate(5px, 0px) rotate(5deg); }
          50%  { transform: translate(0px, 4.5px) rotate(3deg); }
          75%  { transform: translate(-5px, 0px) rotate(-6deg); }
          100% { transform: translate(0px, -4.5px) rotate(-4deg); }
        }
        @keyframes fairySwirlOrbit {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fairySwirlOrbitReverse {
          0%   { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes fairyWandGlow {
          0%, 100% { transform: scale(1); opacity: 0.92; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes fairyWandTwinkle {
          0%, 100% { transform: scale(0.75) rotate(-8deg); opacity: 0.45; }
          35%      { transform: scale(1.32) rotate(18deg); opacity: 1; }
          60%      { transform: scale(0.85) rotate(6deg); opacity: 0.65; }
          80%      { transform: scale(1.25) rotate(-14deg); opacity: 1; }
        }
        @keyframes fairyWandMove {
          0%, 100% { transform: translate(0px, 0px) rotate(-6deg); }
          50%      { transform: translate(2.5px, -2.5px) rotate(14deg); }
        }
        @keyframes fairyEyeBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          96%           { transform: scaleY(0.12); }
        }
        @keyframes fairyEyeLook {
          0%, 100% { transform: translate(0px, 0px) scaleY(1); }
          20%      { transform: translate(1.6px, -0.8px) scaleY(1); }
          40%      { transform: translate(-1.6px, -0.4px) scaleY(1); }
          55%      { transform: translate(-1.6px, -0.4px) scaleY(0.14); }
          62%      { transform: translate(1.2px, 0.5px) scaleY(1); }
          82%      { transform: translate(0.5px, -1px) scaleY(1); }
        }
        .fairy-float {
          animation: fairyFloat 2.6s ease-in-out infinite;
        }
        .fairy-orbit {
          transform-origin: 60px 60px;
        }
        .fairy-wing-left {
          transform-origin: 48px 66px;
          animation: fairyWingLeft 0.95s ease-in-out infinite;
        }
        .fairy-wing-right {
          transform-origin: 72px 66px;
          animation: fairyWingRight 0.95s ease-in-out infinite;
        }
        .fairy-wand-arm {
          transform-origin: 79px 69px;
        }
        .fairy-wand-star {
          transform-origin: 96px 46px;
          animation: fairyWandGlow 1.8s ease-in-out infinite;
        }
        .fairy-eyes {
          transform-origin: 60px 49.5px;
          animation: fairyEyeBlink 4.2s ease-in-out infinite;
        }
        .fairy-swirl-layer {
          opacity: 0;
          pointer-events: none;
          transition: opacity 220ms ease;
        }
        .fairy-active .fairy-swirl-layer {
          opacity: 1;
        }
        .fairy-active .fairy-swirl-cw {
          transform-origin: 60px 60px;
          animation: fairySwirlOrbit 1.35s linear infinite;
        }
        .fairy-active .fairy-swirl-ccw {
          transform-origin: 60px 60px;
          animation: fairySwirlOrbitReverse 1.9s linear infinite;
        }
        .fairy-active .fairy-orbit {
          animation: fairyOrbit 1.6s ease-in-out infinite;
        }
        .fairy-active .fairy-wing-left,
        .fairy-active .fairy-wing-right {
          animation-duration: 0.32s;
        }
        .fairy-active .fairy-wand-arm {
          animation: fairyWandMove 0.65s ease-in-out infinite;
        }
        .fairy-active .fairy-wand-star {
          animation: fairyWandTwinkle 0.55s ease-in-out infinite;
        }
        .fairy-active .fairy-eyes {
          animation: fairyEyeLook 2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .fairy-float,
          .fairy-orbit,
          .fairy-wing-left,
          .fairy-wing-right,
          .fairy-wand-arm,
          .fairy-wand-star,
          .fairy-eyes,
          .fairy-swirl-cw,
          .fairy-swirl-ccw {
            animation: none !important;
          }
        }
      `}</style>

      {/* Swirling Magic Orbit Trails (visible when active) */}
      <g className="fairy-swirl-layer">
        <g className="fairy-swirl-cw">
          <path d="M 16 60 A 44 44 0 0 1 60 16" stroke="#4B9B7B" strokeWidth="2.8" strokeLinecap="round" strokeOpacity="0.65" />
          <path d="M 104 60 A 44 44 0 0 1 60 104" stroke="#9AB4E3" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.6" />
          <circle cx="60" cy="14" r="3.4" fill="#FDE68A" stroke="#4B9B7B" strokeWidth="1.5" />
        </g>
        <g className="fairy-swirl-ccw">
          <path d="M 24 40 A 40 40 0 0 0 40 96" stroke="#AEE5CA" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="6 8" strokeOpacity="0.75" />
          <circle cx="22" cy="60" r="2.6" fill="#AEE5CA" />
          <circle cx="98" cy="60" r="2.6" fill="#D0E1FC" />
        </g>
      </g>

      <g className="fairy-orbit">
        <g className="fairy-float">
          {/* Left Wing (behind body) */}
          <g className="fairy-wing-left">
            <path
              d="M47 62 C32 49, 13 46, 13 58 C13 68, 28 73, 40 73 C28 74, 21 81, 26 88 C32 95, 45 86, 51 74 Z"
              fill="#D0E1FC"
              stroke="#9AB4E3"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Right Wing (behind body) */}
          <g className="fairy-wing-right">
            <path
              d="M73 62 C86 50, 99 49, 98 60 C97 69, 85 73, 76 73 C86 74, 92 82, 87 89 C81 95, 69 86, 65 74 Z"
              fill="#D0E1FC"
              stroke="#9AB4E3"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Legs */}
          <path d="M52 91 C47 97, 45 104, 48 106 C51 108, 56 102, 59 93 Z" fill="#FFEBE3" stroke="#6D6E82" strokeWidth="3.2" strokeLinejoin="round" />
          <path d="M61 92 C57 99, 55 106, 58 108 C61 109, 66 102, 68 92 Z" fill="#FFEBE3" stroke="#6D6E82" strokeWidth="3.2" strokeLinejoin="round" />

          {/* Back Hair Curl */}
          <path d="M36 53 C32 61, 35 68, 42 68 C44 68, 46 66, 47 63 Z" fill="#6BA892" stroke="#6D6E82" strokeWidth="3" strokeLinejoin="round" />

          {/* Left Hand */}
          <path d="M44 74 C38 75, 35 79, 38 82 C41 84, 46 81, 49 78 Z" fill="#FFEBE3" stroke="#6D6E82" strokeWidth="3" strokeLinejoin="round" />

          {/* Right Hand + Wand Stick + 4-Point Star (moves back and forth when active) */}
          <g className="fairy-wand-arm">
            <path d="M79 67 C83 62, 89 63, 88 68 C87 72, 82 74, 78 72 Z" fill="#FFEBE3" stroke="#6D6E82" strokeWidth="3" strokeLinejoin="round" />
            <line x1="84" y1="67" x2="93" y2="51" stroke="#6D6E82" strokeWidth="3.2" strokeLinecap="round" />
            <g className="fairy-wand-star">
              <path d="M96 36 L98.8 43.2 L106 46 L98.8 48.8 L96 56 L93.2 48.8 L86 46 L93.2 43.2 Z" fill="#F6FFFA" stroke="#4B9B7B" strokeWidth="2.8" strokeLinejoin="round" />
            </g>
          </g>

          {/* White Flowing Dress & Sleeves */}
          <path
            d="M50 68 L40 75 C42 78, 46 79, 50 77 C48 82, 43 86, 43 90 C43 93, 49 93, 53 91 C55 95, 61 95, 64 91 C68 94, 74 94, 74 89 C74 84, 70 79, 68 74 C73 77, 79 76, 82 71 L71 65 Z"
            fill="#EFF7F3"
            stroke="#6D6E82"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />

          {/* Mint Capelet */}
          <path
            d="M49 62 C44 65, 41 70, 41 74 C48 73, 55 71, 60 67 C65 71, 72 73, 78 72 C78 68, 74 64, 69 62 Z"
            fill="#AEE5CA"
            stroke="#6D6E82"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Git Branch Brooch */}
          <circle cx="60" cy="72.5" r="7.5" fill="#4B9B7B" />
          <g stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <line x1="57.5" y1="69.5" x2="57.5" y2="75.5" />
            <path d="M57.5 74.5 C57.5 72.5, 62.5 72.5, 62.5 70.5" />
            <circle cx="57.5" cy="69" r="1.2" fill="#4B9B7B" />
            <circle cx="57.5" cy="75.8" r="1.2" fill="#4B9B7B" />
            <circle cx="62.5" cy="69.5" r="1.2" fill="#4B9B7B" />
          </g>

          {/* Elf Ears */}
          <path d="M39 46 L27 43 L36 53 Z" fill="#FFEBE3" stroke="#6D6E82" strokeWidth="3.2" strokeLinejoin="round" />
          <path d="M32 46.5 L37 49.5" stroke="#F0BEB2" strokeWidth="2" strokeLinecap="round" />
          <path d="M80 46 L91 41 L83 52 Z" fill="#FFEBE3" stroke="#6D6E82" strokeWidth="3.2" strokeLinejoin="round" />
          <path d="M86 45 L82 48.5" stroke="#F0BEB2" strokeWidth="2" strokeLinecap="round" />

          {/* Face */}
          <ellipse cx="60" cy="48" rx="19.5" ry="17" fill="#FFF0EA" stroke="#6D6E82" strokeWidth="3.2" />

          {/* Mint Hair & Top Cowlick */}
          <path
            d="M46 29 C45 20, 53 14, 63 14 C62 19, 59 22, 56 24 C69 22, 82 32, 81 48 C79 42, 75 39, 71 37 C70 43, 66 47, 61 47 C56 47, 52 43, 51 37 C48 41, 45 45, 43 49 C40 53, 39 58, 43 62 C36 62, 33 56, 35 48 C34 38, 39 31, 46 29 Z"
            fill="#B0E9CC"
            stroke="#6D6E82"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M72 44 C76 47, 78 52, 76 57 C74 60, 71 61, 69 60 C72 56, 73 50, 72 44 Z" fill="#B0E9CC" stroke="#6D6E82" strokeWidth="2.8" strokeLinejoin="round" />

          {/* Brows, Cheeks, Smile */}
          <path d="M49 43.5 Q51.5 42 54 43.5" stroke="#6D6E82" strokeWidth="2" strokeLinecap="round" />
          <path d="M66 43.5 Q68.5 42 71 43.5" stroke="#6D6E82" strokeWidth="2" strokeLinecap="round" />

          {/* Animated Eyes */}
          <g className="fairy-eyes">
            <ellipse cx="52" cy="49.5" rx="2.6" ry="3.3" fill="#4F5061" />
            <circle cx="51" cy="48.3" r="1" fill="#FFFFFF" />
            <ellipse cx="68.5" cy="49.5" rx="2.6" ry="3.3" fill="#4F5061" />
            <circle cx="67.5" cy="48.3" r="1" fill="#FFFFFF" />
          </g>

          <ellipse cx="48" cy="54.5" rx="2.4" ry="1.3" fill="#FAD2C8" />
          <ellipse cx="72" cy="54.5" rx="2.4" ry="1.3" fill="#FAD2C8" />
          <path d="M58 55 Q60.5 57.5 63 55" stroke="#6D6E82" strokeWidth="2.1" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}
