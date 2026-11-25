'use client'
/* eslint-disable @next/next/no-img-element */

import React, { useMemo, useState } from 'react'
import { LuChevronsDownUp, LuChevronsUpDown, LuCrosshair, LuEye, LuEyeOff, LuFolder, LuFolderOpen, LuInfo, LuLayers, LuMaximize2, LuTarget, LuWind } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { Badge, Button, ScrollArea, Tooltip } from '@/components/sk'
import { cn } from '@/lib/utils'

import { HERO_ASSETS } from './data/heroAssets'
import { type LayerMeta } from './data/worldTreeData'

type CoreGroupId = 'landing-scene' | 'tree-glow' | 'foreground-overhang' | 'card-shell' | 'water-banks' | 'water-flow-map'

interface LayerGroupItem {
  id: CoreGroupId
  name: string
  desc: string
  img: string
  compositeImg: string
  isRgba: boolean
  canvasDimensions: [number, number]
}

/**
 * Returns genuine 1672 × 941 high-definition layers used by Homepage (YggitOfficialPreview)
 */
function getSubLayersForGroup(group: LayerGroupItem, isDay = true): LayerMeta[] {
  if (group.id === 'landing-scene') {
    return [
      {
        id: 'hero-preview-master',
        name: '首页高清全景底图 (Master)',
        file: isDay ? HERO_ASSETS.dayBase : HERO_ASSETS.nightBase,
        type: 'background',
        bounds: [0, 0, 1672, 941],
        offset: [0, 0],
        depth: 10,
      },
      {
        id: 'distant-mountains-sky',
        name: '远景天空与雪山 (Distant BG)',
        file: isDay ? '/world-tree-assets/hero/hero_day_distant_bg_1672x941.webp' : '/world-tree-assets/hero/hero_night_distant_bg_1672x941.webp',
        type: 'background',
        bounds: [0, 0, 1672, 600],
        offset: [0, 0],
        depth: 12,
      },
      {
        id: 'pure-forest-bg',
        name: '纯净环境底图 (Pure BG)',
        file: isDay ? '/world-tree-assets/hero/hero_day_pure_bg_1672x941.webp' : '/world-tree-assets/hero/hero_night_pure_bg_1672x941.webp',
        type: 'background',
        bounds: [0, 0, 1672, 941],
        offset: [0, 0],
        depth: 14,
      },
      {
        id: 'landing-scene-full',
        name: '全画幅母版原画 (Landing Scene)',
        file: isDay ? HERO_ASSETS.landingDayBase : HERO_ASSETS.landingNightBase,
        type: 'background',
        bounds: [0, 0, 1672, 941],
        offset: [0, 0],
        depth: 16,
      },
    ]
  }

  if (group.id === 'tree-glow') {
    return [
      {
        id: 'tree-standalone-rgba',
        name: '独立世界树 32-bit RGBA 主体',
        file: isDay ? '/world-tree-assets/hero/hero_day_tree_rgba.webp' : '/world-tree-assets/hero/hero_night_tree_rgba.webp',
        type: 'static',
        bounds: [480, 40, 1672, 941],
        offset: [0, 0],
        depth: 20,
      },
      {
        id: 'tree-glow-rgba',
        name: '树冠脉络与根系生物荧光通道',
        file: '/world-tree-assets/hero/hero_tree_glow_rgba.webp',
        type: 'static',
        bounds: [480, 40, 1672, 941],
        offset: [0, 0],
        depth: 25,
      },
    ]
  }

  if (group.id === 'foreground-overhang') {
    return [
      {
        id: 'card-overhang-leaves',
        name: '卡片上方前景垂叶与枝干',
        file: isDay ? HERO_ASSETS.dayOverhang : HERO_ASSETS.nightOverhang,
        type: 'static',
        bounds: [700, 180, 1595, 750],
        offset: [0, 0],
        depth: 45,
      },
      {
        id: 'foreground-flora-rocks',
        name: '底部近景花草与岩石遮罩',
        file: isDay ? '/world-tree-assets/hero/hero_day_foreground_rgba.webp' : '/world-tree-assets/hero/hero_night_foreground_rgba.webp',
        type: 'static',
        bounds: [0, 680, 1672, 941],
        offset: [0, 0],
        depth: 42,
      },
    ]
  }

  if (group.id === 'card-shell') {
    return [
      {
        id: 'card-glass-shell-frame',
        name: '中央工作台毛玻璃边框外壳',
        file: HERO_ASSETS.cardShell,
        type: 'static',
        bounds: [659, 244, 1543, 684],
        offset: [0, 0],
        depth: 30,
      },
      {
        id: 'card-empty-stage-v2',
        name: '卡片物理投影与凹槽舞台',
        file: isDay ? '/world-tree-assets/hero/hero_day_empty_card_stage_v2.webp' : '/world-tree-assets/hero/hero_empty_card_stage_v2.webp',
        type: 'static',
        bounds: [0, 0, 1672, 941],
        offset: [0, 0],
        depth: 28,
      },
    ]
  }

  if (group.id === 'water-banks') {
    return [
      {
        id: 'water-banks-occlusion',
        name: '溪流两岸植被与岩石遮罩',
        file: isDay ? HERO_ASSETS.dayWaterBanks : HERO_ASSETS.nightWaterBanks,
        type: 'static',
        bounds: [500, 810, 915, 941],
        offset: [0, 0],
        depth: 50,
      },
      {
        id: 'water-mask-surface',
        name: '水域流动 Alpha 透明蒙版',
        file: HERO_ASSETS.waterMask,
        type: 'static',
        bounds: [480, 780, 960, 941],
        offset: [0, 0],
        depth: 48,
      },
    ]
  }

  if (group.id === 'water-flow-map') {
    return [
      {
        id: 'water-flow-direction-vectors',
        name: '水流矢量流向与流速贴图',
        file: HERO_ASSETS.waterFlow,
        type: 'static',
        bounds: [480, 780, 960, 941],
        offset: [0, 0],
        depth: 60,
      },
      {
        id: 'water-normal-ripples-map',
        name: '连续流动水波法线贴图 (Normal)',
        file: HERO_ASSETS.waterNormal,
        type: 'static',
        bounds: [0, 0, 512, 512],
        offset: [0, 0],
        depth: 58,
      },
    ]
  }

  return []
}

export function StudioAssetsSection({ isDay = true }: { isDay?: boolean }) {
  const t = useT()

  const groupsList: LayerGroupItem[] = useMemo(
    () => [
      {
        id: 'landing-scene',
        name: t('landing.studio.coreLayer1Name'),
        desc: t('landing.studio.coreLayer1Desc'),
        img: isDay ? HERO_ASSETS.landingDayBase : HERO_ASSETS.landingNightBase,
        compositeImg: isDay ? HERO_ASSETS.dayBase : HERO_ASSETS.nightBase,
        isRgba: false,
        canvasDimensions: [1672, 941],
      },
      {
        id: 'tree-glow',
        name: t('landing.studio.coreLayer2Name'),
        desc: t('landing.studio.coreLayer2Desc'),
        img: '/world-tree-assets/hero/hero_tree_glow_rgba.webp',
        compositeImg: isDay ? '/world-tree-assets/hero/hero_day_tree_rgba.webp' : '/world-tree-assets/hero/hero_night_tree_rgba.webp',
        isRgba: true,
        canvasDimensions: [1672, 941],
      },
      {
        id: 'foreground-overhang',
        name: t('landing.studio.coreLayer3Name'),
        desc: t('landing.studio.coreLayer3Desc'),
        img: isDay ? HERO_ASSETS.dayOverhang : HERO_ASSETS.nightOverhang,
        compositeImg: isDay ? HERO_ASSETS.dayOverhang : HERO_ASSETS.nightOverhang,
        isRgba: true,
        canvasDimensions: [1672, 941],
      },
      {
        id: 'card-shell',
        name: t('landing.studio.coreLayer4Name'),
        desc: t('landing.studio.coreLayer4Desc'),
        img: HERO_ASSETS.cardShell,
        compositeImg: HERO_ASSETS.cardShell,
        isRgba: true,
        canvasDimensions: [1672, 941],
      },
      {
        id: 'water-banks',
        name: t('landing.studio.coreLayer5Name'),
        desc: t('landing.studio.coreLayer5Desc'),
        img: isDay ? HERO_ASSETS.dayWaterBanks : HERO_ASSETS.nightWaterBanks,
        compositeImg: isDay ? HERO_ASSETS.dayWaterBanks : HERO_ASSETS.nightWaterBanks,
        isRgba: true,
        canvasDimensions: [1672, 941],
      },
      {
        id: 'water-flow-map',
        name: t('landing.studio.coreLayer6Name'),
        desc: t('landing.studio.coreLayer6Desc'),
        img: HERO_ASSETS.waterFlow,
        compositeImg: HERO_ASSETS.waterFlow,
        isRgba: true,
        canvasDimensions: [1672, 941],
      },
    ],
    [isDay, t]
  )

  const [activeGroupId, setActiveGroupId] = useState<CoreGroupId>('landing-scene')
  const [selectedSubLayerId, setSelectedSubLayerId] = useState<string | null>(null)
  const [inspectMode, setInspectMode] = useState<'in-group' | 'solo'>('in-group')
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'landing-scene': true,
    'tree-glow': false,
    'foreground-overhang': false,
    'card-shell': false,
    'water-banks': false,
    'water-flow-map': false,
  })

  const currentGroup = groupsList.find((g) => g.id === activeGroupId) || groupsList[0]
  const currentSubLayers = useMemo(() => getSubLayersForGroup(currentGroup, isDay), [currentGroup, isDay])
  const selectedSubLayer = selectedSubLayerId ? currentSubLayers.find((l) => l.id === selectedSubLayerId) || null : null

  // Total layers count across all groups
  const totalLayersCount = useMemo(() => groupsList.reduce((acc, g) => acc + getSubLayersForGroup(g, isDay).length, 0), [groupsList, isDay])

  // Only clicking the folder icon triggers expand/collapse
  const toggleGroupExpand = (groupId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const toggleAllGroups = () => {
    const allExpanded = Object.values(expandedGroups).every(Boolean)
    const nextState: Record<string, boolean> = {}
    for (const g of groupsList) {
      nextState[g.id] = !allExpanded
    }
    setExpandedGroups(nextState)
  }

  // Handle selecting a group (does NOT expand or collapse)
  const handleSelectGroup = (group: LayerGroupItem) => {
    setActiveGroupId(group.id)
    setSelectedSubLayerId(null)
    setInspectMode('in-group')
  }

  // Handle clicking layer row (view in group position)
  const handleSelectLayer = (layer: LayerMeta, group: LayerGroupItem) => {
    setActiveGroupId(group.id)
    setSelectedSubLayerId(layer.id)
    setInspectMode('in-group')
  }

  // Handle clicking layer thumbnail (isolate / solo layer)
  const handleSoloLayer = (layer: LayerMeta, group: LayerGroupItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveGroupId(group.id)
    setSelectedSubLayerId(layer.id)
    setInspectMode('solo')
  }

  // Canvas preview parameters
  const isSolo = inspectMode === 'solo' && selectedSubLayer !== null
  const previewImg = isSolo ? selectedSubLayer.file : selectedSubLayer && currentGroup.compositeImg ? currentGroup.compositeImg : currentGroup.img
  const previewIsRgba = isSolo ? selectedSubLayer.type !== 'background' : currentGroup.isRgba

  const canvasWidth = currentGroup.canvasDimensions[0]
  const canvasHeight = currentGroup.canvasDimensions[1]

  // Bounding box calculation relative to active canvas
  const bbox = selectedSubLayer?.bounds || null
  const leftPct = bbox ? (bbox[0] / canvasWidth) * 100 : 0
  const topPct = bbox ? (bbox[1] / canvasHeight) * 100 : 0
  const widthPct = bbox ? ((bbox[2] - bbox[0]) / canvasWidth) * 100 : 0
  const heightPct = bbox ? ((bbox[3] - bbox[1]) / canvasHeight) * 100 : 0

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-line">
      {/* Main Canvas Workspace (Takes spacious ~70% width, Photoshop style) */}
      <section className="flex min-w-0 min-h-0 flex-1 flex-col bg-paper-2 overflow-hidden">
        {/* Top HUD Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 bg-panel/90 px-3 py-1.5 shrink-0 text-xs select-none">
          {/* Target Identifier */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-ink truncate flex items-center gap-1.5">
              {selectedSubLayer ? (
                <>
                  <span className="text-accent font-mono">{selectedSubLayer.id}</span>
                  <span className="text-ink-soft">·</span>
                  <span className="truncate">{selectedSubLayer.name}</span>
                </>
              ) : (
                <>
                  <LuFolder className="size-3.5 text-accent shrink-0" aria-hidden="true" />
                  <span className="truncate">{currentGroup.name}</span>
                </>
              )}
            </span>

            <Badge tone={previewIsRgba ? 'accent' : 'neutral'} size="mini" dot={false} className="shrink-0">
              {previewIsRgba ? 'RGBA' : 'RGB'}
            </Badge>
          </div>

          {/* Mode Switcher HUD (In-Group Bounding Box VS Solo Isolated Layer) */}
          <div className="flex items-center gap-1 bg-panel-2/80 p-0.5 rounded-lg border border-line/60">
            <Tooltip content="在合成画面中精确定位并标记图层位置 (In Group)" placement="bottom">
              <button
                type="button"
                onClick={() => setInspectMode('in-group')}
                className={cn(
                  'flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-all cursor-pointer',
                  inspectMode === 'in-group' ? 'bg-accent/15 text-accent shadow-xs font-semibold' : 'text-ink-soft hover:bg-hover hover:text-ink'
                )}
              >
                <LuTarget className="size-3" aria-hidden="true" />
                <span>{t('landing.studio.locateInGroup')}</span>
              </button>
            </Tooltip>

            <Tooltip content="单独展示并审查该图层的透明外观与抗锯齿 (Solo Layer)" placement="bottom">
              <button
                type="button"
                disabled={!selectedSubLayer}
                onClick={() => setInspectMode('solo')}
                className={cn(
                  'flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                  inspectMode === 'solo' ? 'bg-accent/15 text-accent shadow-xs font-semibold' : 'text-ink-soft hover:bg-hover hover:text-ink'
                )}
              >
                <LuMaximize2 className="size-3" aria-hidden="true" />
                <span>{t('landing.studio.soloLayer')}</span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Canvas Display Viewport */}
        <ScrollArea className="min-h-0 flex-1" indicator="both" reserveGutter={false}>
          <div className="flex min-h-full w-full items-center justify-center p-4 sm:p-6 select-none">
            {/* Aspect Ratio Box with Layer Overlay */}
            <div
              className={cn(
                'relative flex items-center justify-center overflow-hidden rounded-xl border border-line/70 shadow-lg',
                previewIsRgba ? 'checkerboard-bg' : 'bg-paper',
                canvasWidth > 1000 ? 'aspect-[1672/941] w-full max-w-5xl' : 'aspect-[492/412] w-full max-w-2xl'
              )}
            >
              <img src={previewImg} alt={selectedSubLayer?.name || currentGroup.name} className="h-full w-full object-contain pointer-events-none" />

              {/* Photoshop-style Coordinate Bounding Box Overlay */}
              {!isSolo && selectedSubLayer && bbox && (
                <div
                  className="absolute border-2 border-accent bg-accent/15 rounded-xs transition-all pointer-events-none shadow-[0_0_14px_rgba(16,185,129,0.4)]"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                >
                  {/* 4 Corner Anchor Handles */}
                  <span className="absolute -top-1 -left-1 size-2 rounded-xs bg-accent ring-1 ring-white" />
                  <span className="absolute -top-1 -right-1 size-2 rounded-xs bg-accent ring-1 ring-white" />
                  <span className="absolute -bottom-1 -left-1 size-2 rounded-xs bg-accent ring-1 ring-white" />
                  <span className="absolute -bottom-1 -right-1 size-2 rounded-xs bg-accent ring-1 ring-white" />

                  {/* Floating Coordinate Pill */}
                  <div className="absolute -top-6 left-0 flex items-center gap-1 rounded bg-panel/95 px-1.5 py-0.5 text-[10px] font-mono text-accent border border-accent/40 shadow-sm whitespace-nowrap">
                    <span className="font-semibold">{selectedSubLayer.id}</span>
                    <span className="text-ink-soft">
                      {bbox[2] - bbox[0]}×{bbox[3] - bbox[1]}px
                    </span>
                  </div>

                  {/* Physics Pivot Anchor Crosshair */}
                  {selectedSubLayer.anchor && (
                    <div
                      className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent bg-accent/40 flex items-center justify-center shadow-xs"
                      style={{
                        left: `${((selectedSubLayer.anchor[0] - bbox[0]) / (bbox[2] - bbox[0])) * 100}%`,
                        top: `${((selectedSubLayer.anchor[1] - bbox[1]) / (bbox[3] - bbox[1])) * 100}%`,
                      }}
                      title={`Anchor: (${selectedSubLayer.anchor[0]}, ${selectedSubLayer.anchor[1]})`}
                    >
                      <LuCrosshair className="size-2.5 text-white" aria-hidden="true" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Bottom Details Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-line/60 bg-panel/90 px-4 py-2 text-xs text-ink-soft shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-semibold text-ink truncate">{selectedSubLayer ? selectedSubLayer.name : currentGroup.name}</span>
            <span className="hidden md:inline-block text-[11px] text-ink-soft/80 truncate max-w-md">
              {selectedSubLayer ? (bbox ? `[X: ${bbox[0]}, Y: ${bbox[1]}, W: ${bbox[2] - bbox[0]}, H: ${bbox[3] - bbox[1]}]` : '') : currentGroup.desc}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono text-ink-soft">
            <span>
              {canvasWidth} × {canvasHeight} px
            </span>
            <span className="hidden xl:inline truncate max-w-xs">{previewImg}</span>
          </div>
        </div>
      </section>

      {/* Right Column: Photoshop-style Unified Layers Panel */}
      <aside aria-label="Photoshop-style Layers Tree" className="flex w-full lg:w-80 xl:w-96 shrink-0 flex-col bg-panel/95 min-h-0">
        {/* Panel Header (aligned with /git CommitPanelHeader pattern) */}
        <div className="grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 border-b border-line/60 px-3 select-none">
          <div className="flex min-w-0 items-center gap-1.5">
            <LuLayers className="size-4 shrink-0 text-accent" aria-hidden="true" />
            <h2 className="m-0 shrink-0 whitespace-nowrap text-xs font-semibold text-ink">{t('landing.studio.layersTitle')}</h2>
            <Badge tone="neutral" size="mini" dot={false} className="font-mono">
              {groupsList.length} 组 · {totalLayersCount} 图层
            </Badge>
          </div>

          <div className="flex h-8 items-center justify-end [&_button]:size-6">
            <Tooltip
              content={
                Object.values(expandedGroups).every(Boolean)
                  ? t('git.commit.collapseAll') || t('landing.studio.toggleAllGroups')
                  : t('git.commit.expandAll') || t('landing.studio.toggleAllGroups')
              }
              placement="left"
            >
              <Button
                variant="plain"
                size="icon"
                className="size-6 text-ink-soft hover:enabled:bg-[var(--overlay-08)] hover:enabled:text-ink cursor-pointer"
                aria-label={
                  Object.values(expandedGroups).every(Boolean)
                    ? t('git.commit.collapseAll') || t('landing.studio.toggleAllGroups')
                    : t('git.commit.expandAll') || t('landing.studio.toggleAllGroups')
                }
                onClick={toggleAllGroups}
              >
                {Object.values(expandedGroups).every(Boolean) ? (
                  <LuChevronsDownUp className="size-3.5" aria-hidden="true" />
                ) : (
                  <LuChevronsUpDown className="size-3.5" aria-hidden="true" />
                )}
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Expandable Group & Layer Tree */}
        <ScrollArea className="min-h-0 flex-1" reserveGutter={false}>
          <div className="flex flex-col gap-1.5 p-2">
            {groupsList.map((group) => {
              const isGroupActive = activeGroupId === group.id && !selectedSubLayerId
              const isExpanded = Boolean(expandedGroups[group.id])
              const subLayers = getSubLayersForGroup(group, isDay)

              return (
                <div key={group.id} className="flex flex-col rounded-lg border border-line/60 bg-panel-2/30 overflow-hidden">
                  {/* Group Header Row */}
                  <div
                    onClick={() => handleSelectGroup(group)}
                    className={cn(
                      'flex h-11 items-center gap-2 px-2 transition-colors cursor-pointer select-none',
                      isGroupActive ? 'bg-accent/15 text-accent' : 'hover:bg-hover text-ink'
                    )}
                  >
                    {/* Only clicking this folder button toggles expand/collapse */}
                    <Tooltip content={isExpanded ? t('landing.studio.collapseGroup') : t('landing.studio.expandGroup')} placement="left">
                      <button
                        type="button"
                        onClick={(e) => toggleGroupExpand(group.id, e)}
                        aria-label={isExpanded ? t('landing.studio.collapseGroup') : t('landing.studio.expandGroup')}
                        className="flex size-5 shrink-0 items-center justify-center rounded text-ink-soft hover:bg-hover hover:text-ink cursor-pointer"
                      >
                        {isExpanded ? (
                          <LuFolderOpen className="size-3.5 text-accent shrink-0" aria-hidden="true" />
                        ) : (
                          <LuFolder className="size-3.5 text-accent shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    </Tooltip>

                    {/* Group Thumbnail (clicking selects group, does not expand/collapse) */}
                    <div
                      className={cn(
                        'h-7 w-9 shrink-0 overflow-hidden rounded border border-line/60 flex items-center justify-center',
                        group.isRgba ? 'checkerboard-bg' : 'bg-paper-2'
                      )}
                    >
                      <img src={group.img} alt={group.name} className="h-full w-full object-contain" />
                    </div>

                    {/* Group Name & Info Icon immediately after title */}
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className={cn('text-xs font-semibold truncate', isGroupActive ? 'text-accent' : 'text-ink')}>{group.name}</span>
                      <Tooltip content={group.desc} placement="top">
                        <span onClick={(e) => e.stopPropagation()} className="flex size-3.5 shrink-0 items-center justify-center text-ink-soft/70 hover:text-accent cursor-pointer">
                          <LuInfo className="size-3" aria-hidden="true" />
                        </span>
                      </Tooltip>
                    </div>

                    {/* Right side: Layer count badge */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="rounded bg-panel px-1.5 py-0.2 text-[10px] font-mono text-ink-soft border border-line/50">{subLayers.length}</span>
                    </div>
                  </div>

                  {/* Sub-layers List inside Group (starts at exact same left padding px-2, no excessive indentation) */}
                  {isExpanded && (
                    <div className="flex flex-col border-t border-line/40 bg-panel/30 divide-y divide-line/20 border-l-2 border-l-accent/40">
                      {subLayers.map((layer) => {
                        const isLayerSelected = activeGroupId === group.id && selectedSubLayerId === layer.id
                        const windPct = typeof layer.windWeight === 'number' ? Math.round(layer.windWeight * 100) : null
                        const boundsDesc = `Bounds: [${layer.bounds.join(', ')}]${layer.anchor ? ` · Anchor: (${layer.anchor.join(', ')})` : ''}`

                        return (
                          <div
                            key={layer.id}
                            onClick={() => handleSelectLayer(layer, group)}
                            className={cn(
                              'group flex h-11 items-center gap-2 px-2 transition-colors cursor-pointer select-none',
                              isLayerSelected ? 'bg-accent/15 text-accent' : 'hover:bg-hover text-ink'
                            )}
                          >
                            {/* Eye / Solo Visibility Toggle (same size-5, same left margin as folder icon above) */}
                            <Tooltip content={isSolo && isLayerSelected ? t('landing.studio.returnToGroupTooltip') : t('landing.studio.soloViewTooltip')} placement="left">
                              <button
                                type="button"
                                onClick={(e) => handleSoloLayer(layer, group, e)}
                                className={cn(
                                  'flex size-5 shrink-0 items-center justify-center rounded cursor-pointer transition-colors',
                                  isSolo && isLayerSelected ? 'text-accent bg-accent/20' : 'text-ink-soft/60 hover:text-accent'
                                )}
                              >
                                {isSolo && isLayerSelected ? (
                                  <LuEye className="size-3.5" aria-hidden="true" />
                                ) : (
                                  <LuEyeOff className="size-3.5 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                                )}
                              </button>
                            </Tooltip>

                            {/* Layer Thumbnail (Clicking triggers solo view) */}
                            <Tooltip content={t('landing.studio.soloViewTooltip')} placement="top">
                              <div
                                onClick={(e) => handleSoloLayer(layer, group, e)}
                                className={cn(
                                  'size-7 shrink-0 overflow-hidden rounded border border-line/60 flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-accent',
                                  layer.type === 'background' ? 'bg-paper-2' : 'checkerboard-bg'
                                )}
                              >
                                <img src={layer.file} alt={layer.name} className="h-full w-full object-contain" />
                              </div>
                            </Tooltip>

                            {/* Title & Info Icon immediately after title */}
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                              <div className="flex min-w-0 flex-col justify-center">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className={cn('font-mono text-xs font-semibold truncate', isLayerSelected ? 'text-accent' : 'text-ink')}>{layer.id}</span>
                                  <Tooltip content={`${layer.name} (${boundsDesc})`} placement="top">
                                    <span
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex size-3.5 shrink-0 items-center justify-center text-ink-soft/60 hover:text-accent cursor-pointer"
                                    >
                                      <LuInfo className="size-3" aria-hidden="true" />
                                    </span>
                                  </Tooltip>
                                </div>
                                <span className="text-[10px] text-ink-soft truncate">{layer.name}</span>
                              </div>
                            </div>

                            {/* Right side: Wind power on left, z:N on far right */}
                            <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-ink-soft">
                              {windPct !== null && (
                                <span className="inline-flex items-center gap-0.5 text-accent text-[9px] bg-accent/10 px-1 py-0.2 rounded border border-accent/20">
                                  <LuWind className="size-2.5" aria-hidden="true" />
                                  {windPct}%
                                </span>
                              )}

                              <span className="rounded bg-panel px-1.5 py-0.2 border border-line/40 font-mono text-ink-soft">z:{layer.depth}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </aside>
    </div>
  )
}
