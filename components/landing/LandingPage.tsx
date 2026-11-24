'use client'

import React, { useState } from 'react'

import { YggitOfficialPreview } from '@/components/homepage/YggitOfficialPreview'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingHero } from '@/components/landing/LandingHero'

export function LandingPage() {
  const [timePresetId, setTimePresetId] = useState<'day' | 'night'>('day')

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#03090d] text-slate-100 selection:bg-accent selection:text-white">
      {/* 1. 独立半透明毛玻璃页头 */}
      <LandingHeader timePresetId={timePresetId} onToggleDayNight={() => setTimePresetId((prev) => (prev === 'day' ? 'night' : 'day'))} />

      {/* 2. 左侧 HERO 标题、描述与操作按钮 */}
      <LandingHero />

      {/* 3. 完整 60 FPS 世界树风景 + Git UI 交互卡片舞台 */}
      <YggitOfficialPreview
        view="official-site"
        compactBannerMode
        hideTopNav
        hideLeftCopy
        fullScreenStage
        timePresetId={timePresetId}
        onSelectTimePreset={(p) => setTimePresetId(p.id === 'night' ? 'night' : 'day')}
      />
    </main>
  )
}
