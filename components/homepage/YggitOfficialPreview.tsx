/* eslint-disable max-lines */
'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'
import { LuArrowRight, LuDownload, LuEye, LuEyeOff, LuLayers, LuMoon, LuPlay, LuSlidersHorizontal, LuSparkles, LuStar, LuSun, LuWaves, LuWind } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'

import { HERO_ASSETS } from './data/heroAssets'
import { SEASON_THEMES, SeasonThemePack, TIME_OF_DAY_PRESETS, TimeOfDayPreset } from './data/worldTreeData'
import {
  CARD_BRANCH_BOUNDS,
  CARD_INNER_ORBS,
  CARD_ROOT_BOUNDS,
  CARD_UI_BOUNDS,
  type CardUiLabels,
  DEFAULT_CARD_UI_STATE,
  drawHeroCardBranches,
  drawHeroCardUi,
  SIDEBAR_COMMITS,
  SIDEBAR_HOTSPOTS,
  TOOLBAR_HOTSPOTS,
} from './HeroCardUi'
import { createHeroWindRenderer, HERO_WIND_REGIONS } from './HeroWindRenderer'
import { LightingConfig, WindConfig } from './LivingTreeCanvas'
import { DEFAULT_WATER_CONFIG, STREAM_BOUNDS, WaterShaderConfig, WaterShaderRenderer } from './water-effect/WaterShaderRenderer'

export interface YggitOfficialPreviewProps {
  view?: 'official-site' | 'p0-inspector' | 'p1-p4-studio'
  seasonId?: SeasonThemePack['id']
  onChangeSeason?: (id: SeasonThemePack['id']) => void
  timePresetId?: TimeOfDayPreset['id']
  onSelectTimePreset?: (preset: TimeOfDayPreset) => void
  wind?: WindConfig
  onChangeWind?: React.Dispatch<React.SetStateAction<WindConfig>>
  lighting?: LightingConfig
  compactBannerMode?: boolean
  hideTopNav?: boolean
  hideLeftCopy?: boolean
  fullScreenStage?: boolean
  onFirstFrame?: () => void
}

// Separated Distant Background & Dedicated Foreground Layers (1672x941)
const DAY_DISTANT_BG_PATH = '/world-tree-assets/hero/hero_day_distant_bg_1672x941.webp'
const NIGHT_DISTANT_BG_PATH = '/world-tree-assets/hero/hero_night_distant_bg_1672x941.webp'
const DAY_FOREGROUND_RGBA_PATH = '/world-tree-assets/hero/hero_day_foreground_rgba.webp'
const NIGHT_FOREGROUND_RGBA_PATH = '/world-tree-assets/hero/hero_night_foreground_rgba.webp'

// Full Pure Backgrounds (Distant + Unified Foreground)
const NIGHT_PURE_BG_PATH = '/world-tree-assets/hero/hero_night_pure_bg_1672x941.webp'
const DAY_PURE_BG_PATH = '/world-tree-assets/hero/hero_day_pure_bg_1672x941.webp'

// Master Stages (with Lush World Tree + Unified Foreground, no Card)
const NIGHT_PREVIEW_BG_PATH = HERO_ASSETS.nightBase
const DAY_PREVIEW_BG_PATH = HERO_ASSETS.dayBase

// Empty Card Stages (with Lush World Tree + Unified Foreground + Physical Shadow Card Shell)
const NIGHT_EMPTY_CARD_STAGE_PATH = '/world-tree-assets/hero/hero_empty_card_stage_v2.webp'
const DAY_EMPTY_CARD_STAGE_PATH = '/world-tree-assets/hero/hero_day_empty_card_stage_v2.webp'

// Standalone World Tree RGBA
const NIGHT_TREE_RGBA_PATH = '/world-tree-assets/hero/hero_night_tree_rgba.webp'
const DAY_TREE_RGBA_PATH = '/world-tree-assets/hero/hero_day_tree_rgba.webp'

const GLOW_RGBA_PATH = '/world-tree-assets/hero/hero_tree_glow_rgba.webp'
const CARD_ROOTS_LAYER_ID = 'card-el-03'
const CARD_SHELL_LAYER_ID = 'card-el-01'
const CARD_SHELL_PATH = HERO_ASSETS.cardShell
const CARD_BRANCHES_LAYER_ID = 'card-el-02'
const CARD_UI_LAYER_ID = 'card-el-05'
const CARD_FOREGROUND_LAYER_ID = 'card-el-04'
const CARD_DAY_FOREGROUND_PATH = HERO_ASSETS.dayOverhang
const CARD_NIGHT_FOREGROUND_PATH = HERO_ASSETS.nightOverhang
const SEASON_HUE_OFFSETS: Record<string, number> = {
  spring: 165,
  summer: -22,
  autumn: -115,
  winter: 38,
  'festival-sakura': 160,
}
const CARD_INTERACTION_CLIP = `polygon(${[
  [0, 0],
  [1312, 0],
  [1312, 293],
  [1364, 345],
  [1386, 385],
  [1391, 426],
  [1374, 495],
  [1374, 545],
  [1372, 590],
  [1355, 615],
  [1267, 657],
  [1229, 675],
  [1229, 941],
  [0, 941],
]
  .map(([x, y]) => `${(x / 1672) * 100}% ${(y / 941) * 100}%`)
  .join(', ')})`
const CARD_OCCLUDED_EDGE = 'M0 0 H1384 V239 L1403 295 1423 350 1432 420 1420 490 1410 560 1404 598 1383 631 1344 656 1298 680 1275 700 V941 H0 Z'
const HERO_ASSET_VERSION = '?v=card_overhang_v2'
const glowSprites = new Map<string, HTMLCanvasElement>()

function getGlowSprite(coreColor: string, midColor: string, midStop = 0.4) {
  const key = `${coreColor}_${midColor}_${midStop}`
  const cached = glowSprites.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 1.5, 32, 32, 32)
    gradient.addColorStop(0, coreColor)
    gradient.addColorStop(midStop, midColor)
    gradient.addColorStop(1, 'transparent')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
  }
  glowSprites.set(key, canvas)
  return canvas
}

function drawCardLayer(ctx: CanvasRenderingContext2D, id: string, night: number, time = 0) {
  if (id === CARD_UI_LAYER_ID) drawHeroCardUi(ctx, DEFAULT_CARD_UI_STATE, night)
  if (id === CARD_BRANCHES_LAYER_ID || id === CARD_ROOTS_LAYER_ID) {
    drawHeroCardBranches(ctx, DEFAULT_CARD_UI_STATE, time, getGlowSprite, id === CARD_BRANCHES_LAYER_ID, id === CARD_ROOTS_LAYER_ID)
  }
}

// WebGL Stream Water Shader Assets (following 《Yggit 世界树底部溪流动态效果技术方案 v1.0》)
const WATER_MASK_PATH = HERO_ASSETS.waterMask
const WATER_FLOW_MAP_PATH = HERO_ASSETS.waterFlow
const WATER_NORMAL_MAP_PATH = HERO_ASSETS.waterNormal
const WATER_FG_OCCLUSION_PATH = HERO_ASSETS.dayWaterBanks
const WATER_NIGHT_FG_OCCLUSION_PATH = HERO_ASSETS.nightWaterBanks
const USER_FG_OVERLAY_PATH = '/assets/aistudio/Transparent_Anime_Grass_and_Flowers_Overlay_29d73ad4.webp'

// Decomposed RGBA Elements of the Scene (Distant, Foreground, APP Card & Water Shader)
const CARD_DECOMPOSED_ELEMENTS = [
  {
    id: 'hero-base',
    name: '01. 世界树场景底图',
    url: DAY_PREVIEW_BG_PATH,
    nightUrl: NIGHT_PREVIEW_BG_PATH,
    desc: '保留原世界树构图，包含天空、树冠、树干、根系和近景，是所有动态层的底图。',
  },
  {
    id: CARD_SHELL_LAYER_ID,
    name: '02. APP 卡片外壳',
    url: CARD_SHELL_PATH,
    bounds: '[659, 244, 1543, 684]',
    desc: '透明玻璃底板与青色亮边，独立于界面和分支。',
  },
  {
    id: CARD_UI_LAYER_ID,
    name: '03. 面板 Canvas UI 内容层',
    bounds: '[662, 247, 1540, 681]',
    desc: '窗栏、工作区与提交记录共用底色。英文消息靠近图谱，时间独立右对齐。',
  },
  {
    id: CARD_BRANCHES_LAYER_ID,
    name: '04. Git 分支与节点',
    bounds: '[898, 345, 1103, 702]',
    desc: '三条发光轨道叠在 UI 前方，合流点连向世界树根。',
  },
  {
    id: CARD_ROOTS_LAYER_ID,
    name: '05. 根系汇流',
    bounds: '[510, 630, 1280, 830]',
    desc: '沿原画树根汇流的光点，和卡片内的 Git 分支共用运动路径。',
  },
  {
    id: CARD_FOREGROUND_LAYER_ID,
    name: '06. 卡片前景垂叶、树干与树根',
    url: CARD_DAY_FOREGROUND_PATH,
    nightUrl: CARD_NIGHT_FOREGROUND_PATH,
    bounds: '[700, 180, 1595, 750]',
    desc: '只覆盖卡片边缘的垂叶、树干内沿与少量根须，昼夜共用同一轮廓。',
  },
  {
    id: 'card-el-fg',
    name: '溪流河岸遮罩',
    url: WATER_FG_OCCLUSION_PATH,
    nightUrl: WATER_NIGHT_FG_OCCLUSION_PATH,
    bounds: '[500, 810, 915, 941]',
    desc: '水流辅助纹理。保护岸边草地和石头，水纹沿河道由远及近。',
  },
]

// 14 Foreground Glowing Elements ("近景还有很多发光的元素，这些元素都要有动画效果")
// Crisp, delicate bioluminescent flower buds, root-stream energy pinpoints & riverbank dew lights matching 图二!
const FOREGROUND_GLOW_ELEMENTS = [
  { id: 'fg-glow-1', x: 48, y: 804, r: 8, color: '#fef08a', f1: 0.72, f2: 1.54, p1: 0.3, p2: 2.1 },
  { id: 'fg-glow-2', x: 102, y: 832, r: 8, color: '#fde047', f1: 0.64, f2: 1.41, p1: 1.8, p2: 4.2 },
  { id: 'fg-glow-3', x: 222, y: 874, r: 8, color: '#fef08a', f1: 0.81, f2: 1.69, p1: 3.1, p2: 0.9 },
  { id: 'fg-glow-4', x: 512, y: 774, r: 9, color: '#fde047', f1: 0.58, f2: 1.33, p1: 4.5, p2: 2.7 },
  { id: 'fg-glow-5', x: 638, y: 758, r: 10, color: '#38bdf8', f1: 0.69, f2: 1.48, p1: 1.2, p2: 3.8 },
  { id: 'fg-glow-6', x: 698, y: 824, r: 11, color: '#38bdf8', f1: 0.59, f2: 1.31, p1: 0.7, p2: 2.9 },
  { id: 'fg-glow-7', x: 745, y: 765, r: 11, color: '#fde047', f1: 0.53, f2: 1.24, p1: 2.6, p2: 5.1 },
  { id: 'fg-glow-8', x: 816, y: 845, r: 12, color: '#fde047', f1: 0.47, f2: 1.18, p1: 2.2, p2: 4.5 },
  { id: 'fg-glow-9', x: 892, y: 742, r: 9, color: '#c084fc', f1: 0.81, f2: 1.67, p1: 3.9, p2: 1.1 },
  { id: 'fg-glow-10', x: 1098, y: 726, r: 10, color: '#f472b6', f1: 0.66, f2: 1.44, p1: 1.4, p2: 3.6 },
  { id: 'fg-glow-11', x: 1215, y: 812, r: 10, color: '#f472b6', f1: 0.52, f2: 1.23, p1: 4.8, p2: 0.4 },
  { id: 'fg-glow-12', x: 1312, y: 814, r: 10, color: '#e879f9', f1: 0.62, f2: 1.38, p1: 0.9, p2: 3.3 },
  { id: 'fg-glow-13', x: 1528, y: 786, r: 9, color: '#fef08a', f1: 0.76, f2: 1.59, p1: 2.4, p2: 4.7 },
  { id: 'fg-glow-14', x: 1588, y: 892, r: 9, color: '#fde047', f1: 0.68, f2: 1.46, p1: 5.2, p2: 1.6 },
]

// 18 Asynchronous, Irregularly Twinkling Nodes on the Lush World Tree Canopy & Trunk
const HERO_TREE_NODES = [
  { id: 'hn-root-1', x: 844, y: 774, r: 9, color: '#fde047', f1: 0.67, f2: 1.43, f3: 2.31, p1: 0.2, p2: 1.9, p3: 4.1, exp: 2.3 },
  { id: 'hn-root-2', x: 988, y: 794, r: 9, color: '#fde047', f1: 0.53, f2: 1.29, f3: 2.08, p1: 2.7, p2: 0.5, p3: 3.3, exp: 2.6 },
  { id: 'hn-root-3', x: 1168, y: 642, r: 9, color: '#a3e635', f1: 0.89, f2: 1.71, f3: 2.69, p1: 4.4, p2: 2.8, p3: 1.1, exp: 2.4 },
  { id: 'hn-root-4', x: 1318, y: 816, r: 8, color: '#fde047', f1: 0.74, f2: 1.58, f3: 2.47, p1: 1.5, p2: 4.9, p3: 0.7, exp: 2.8 },
  { id: 'hn-root-5', x: 1568, y: 762, r: 9, color: '#5efce8', f1: 0.61, f2: 1.37, f3: 2.19, p1: 3.8, p2: 1.2, p3: 5.4, exp: 2.2 },
  { id: 'hn-trunk-1', x: 1515, y: 545, r: 10, color: '#fde047', f1: 0.48, f2: 1.19, f3: 1.94, p1: 5.1, p2: 3.4, p3: 2.2, exp: 2.5 },
  { id: 'hn-trunk-2', x: 1538, y: 418, r: 11, color: '#fef08a', f1: 0.79, f2: 1.64, f3: 2.53, p1: 0.9, p2: 5.7, p3: 3.9, exp: 2.1 },
  { id: 'hn-trunk-3', x: 1485, y: 272, r: 10, color: '#fde047', f1: 0.64, f2: 1.49, f3: 2.38, p1: 2.1, p2: 0.8, p3: 4.8, exp: 2.4 },
  { id: 'hn-can-1', x: 565, y: 232, r: 9, color: '#fef08a', f1: 0.83, f2: 1.68, f3: 2.77, p1: 1.2, p2: 3.7, p3: 0.4, exp: 2.5 },
  { id: 'hn-can-2', x: 675, y: 168, r: 10, color: '#fde047', f1: 0.57, f2: 1.33, f3: 2.14, p1: 4.0, p2: 1.6, p3: 5.9, exp: 2.2 },
  { id: 'hn-can-3', x: 878, y: 156, r: 11, color: '#fef08a', f1: 0.71, f2: 1.52, f3: 2.41, p1: 2.9, p2: 4.3, p3: 1.8, exp: 2.6 },
  { id: 'hn-can-4', x: 925, y: 196, r: 10, color: '#fde047', f1: 0.46, f2: 1.14, f3: 1.89, p1: 5.5, p2: 2.1, p3: 3.1, exp: 2.3 },
  { id: 'hn-can-5', x: 1145, y: 192, r: 9, color: '#5efce8', f1: 0.92, f2: 1.79, f3: 2.84, p1: 0.6, p2: 5.0, p3: 2.7, exp: 2.7 },
  { id: 'hn-can-6', x: 1225, y: 128, r: 11, color: '#fef08a', f1: 0.51, f2: 1.25, f3: 2.03, p1: 3.3, p2: 0.2, p3: 4.5, exp: 2.1 },
  { id: 'hn-can-7', x: 1555, y: 118, r: 12, color: '#fde047', f1: 0.68, f2: 1.46, f3: 2.33, p1: 1.8, p2: 3.9, p3: 5.2, exp: 2.4 },
  { id: 'hn-can-8', x: 1575, y: 226, r: 11, color: '#fef08a', f1: 0.59, f2: 1.39, f3: 2.26, p1: 4.7, p2: 1.1, p3: 0.9, exp: 2.0 },
  { id: 'hn-can-9', x: 1615, y: 318, r: 9, color: '#a3e635', f1: 0.76, f2: 1.61, f3: 2.58, p1: 2.4, p2: 4.6, p3: 3.6, exp: 2.5 },
  { id: 'hn-can-10', x: 1598, y: 382, r: 9, color: '#5efce8', f1: 0.85, f2: 1.73, f3: 2.64, p1: 5.9, p2: 2.5, p3: 1.4, exp: 2.7 },
]

// 8 Localized Vein Energy Zones on the World Tree
const LOCAL_VEIN_ZONES = [
  { cx: 920, cy: 780, r: 165, f1: 0.43, f2: 1.12, p1: 0.4, p2: 2.1 },
  { cx: 1185, cy: 710, r: 175, f1: 0.58, f2: 1.37, p1: 2.3, p2: 4.8 },
  { cx: 1475, cy: 745, r: 165, f1: 0.39, f2: 1.05, p1: 4.1, p2: 1.3 },
  { cx: 1265, cy: 535, r: 155, f1: 0.51, f2: 1.28, p1: 1.2, p2: 3.7 },
  { cx: 1335, cy: 410, r: 150, f1: 0.66, f2: 1.49, p1: 3.5, p2: 0.6 },
  { cx: 1215, cy: 265, r: 165, f1: 0.47, f2: 1.19, p1: 5.2, p2: 2.9 },
  { cx: 1015, cy: 185, r: 175, f1: 0.62, f2: 1.41, p1: 0.8, p2: 4.4 },
  { cx: 1445, cy: 165, r: 185, f1: 0.54, f2: 1.31, p1: 2.8, p2: 5.6 },
]

function smoothstepJS(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function irregularPulse(t: number, f1: number, f2: number, f3: number, p1: number, p2: number, p3: number, exponent = 2.2): number {
  const w1 = Math.sin(t * f1 + p1)
  const w2 = Math.sin(t * f2 * 1.3180339 + p2)
  const w3 = Math.cos(t * f3 * 1.7320508 + p3)
  const norm = Math.max(0, Math.min(1, 0.5 + 0.26 * w1 + 0.15 * w2 + 0.09 * w3))
  return Math.pow(norm, exponent)
}

export const YggitOfficialPreview: React.FC<YggitOfficialPreviewProps> = ({
  view = 'official-site',
  seasonId: propSeasonId,
  onChangeSeason: propOnChangeSeason,
  timePresetId: propTimePresetId,
  onSelectTimePreset: propOnSelectTimePreset,
  wind: propWind,
  onChangeWind: propOnChangeWind,
  lighting: propLighting,
  compactBannerMode = false,
  hideTopNav = false,
  hideLeftCopy = false,
  fullScreenStage = false,
  onFirstFrame,
}) => {
  const [internalSeasonId, setInternalSeasonId] = useState<SeasonThemePack['id']>('default')
  const [internalTimePresetId, setInternalTimePresetId] = useState<TimeOfDayPreset['id']>('day')
  const [internalWind, setInternalWind] = useState<WindConfig>({
    enabled: true,
    directionDeg: 18,
    strength: 0.46,
    gustiness: 0.35,
    showMeshWireframe: false,
    showAnchors: false,
    showNodes: false,
    showBounds: false,
  })
  const [internalLighting, _setInternalLighting] = useState<LightingConfig>({
    ambientBrightness: 1.08,
    temperature: 0.18,
    glowIntensity: 0.92,
    nodeIntensity: 0.95,
    fogAmount: 0.12,
    particlesEnabled: true,
    weatherRainSnow: 'none',
  })

  const seasonId = propSeasonId ?? internalSeasonId
  const onChangeSeason = propOnChangeSeason ?? setInternalSeasonId
  const timePresetId = propTimePresetId ?? internalTimePresetId
  const onSelectTimePreset = propOnSelectTimePreset ?? ((p: TimeOfDayPreset) => setInternalTimePresetId(p.id))
  const wind = propWind ?? internalWind
  const onChangeWind = propOnChangeWind ?? setInternalWind
  const lighting = propLighting ?? internalLighting

  const isOfficial = view === 'official-site'
  const isEffectsStudio = view === 'p1-p4-studio'
  // Daytime vs Nighttime (Dark) Mode — defaults to 'day'
  const [dayNightMode, setDayNightMode] = useState<'day' | 'night'>(timePresetId === 'night' ? 'night' : 'day')
  const [dualDayNightCompare, setDualDayNightCompare] = useState<boolean>(false)

  const t = useT()
  const cardLabelsRef = useRef<CardUiLabels>({
    allRepos: t('landing.card.allRepos'),
    favorites: t('landing.card.favorites'),
    recentlyViewed: t('landing.card.recentlyViewed'),
    workspace: t('landing.card.workspace'),
    searchCommits: t('landing.card.searchCommits'),
  })

  useEffect(() => {
    cardLabelsRef.current = {
      allRepos: t('landing.card.allRepos'),
      favorites: t('landing.card.favorites'),
      recentlyViewed: t('landing.card.recentlyViewed'),
      workspace: t('landing.card.workspace'),
      searchCommits: t('landing.card.searchCommits'),
    }
  }, [t])

  useEffect(() => {
    if (timePresetId === 'day') setDayNightMode('day')
    else if (timePresetId === 'night') setDayNightMode('night')
  }, [timePresetId])

  const handleSwitchDayNight = (mode: 'day' | 'night') => {
    setDayNightMode(mode)
    const targetPreset = TIME_OF_DAY_PRESETS.find((p) => p.id === (mode === 'day' ? 'day' : 'night'))
    if (targetPreset && onSelectTimePreset) {
      onSelectTimePreset(targetPreset)
    }
  }

  const [selectedCommitIdx, setSelectedCommitIdx] = useState(DEFAULT_CARD_UI_STATE.activeCommitIdx)
  const [hoveredCommitIdx, setHoveredCommitIdx] = useState<number | null>(null)
  const [activeSidebarId, setActiveSidebarId] = useState(DEFAULT_CARD_UI_STATE.activeSidebarId)
  const [hoveredSidebarId, setHoveredSidebarId] = useState<string | null>(null)
  const [hoveredToolbarId, setHoveredToolbarId] = useState<string | null>(null)
  const [activeToolbarId, setActiveToolbarId] = useState<string | null>(null)
  const [pulseBoostUntil, setPulseBoostUntil] = useState<number>(0)

  // Module 03: Decomposed Card + Foreground + Water Shader + Faux-Interaction Switches
  const [showCardFrame, setShowCardFrame] = useState<boolean>(true)
  const [showInnerBranchStream, setShowInnerBranchStream] = useState<boolean>(true)
  const [showRootNexusStream, setShowRootNexusStream] = useState<boolean>(true)
  const [showBorderRimStream, setShowBorderRimStream] = useState<boolean>(true)
  const [showCardInteractiveUi, setShowCardInteractiveUi] = useState<boolean>(true)
  const [showCardOverhang, setShowCardOverhang] = useState(true)
  const [showWaterShader, setShowWaterShader] = useState<boolean>(true)
  const [showForegroundFlowersAndGlow, setShowForegroundFlowersAndGlow] = useState<boolean>(true)
  const [showLeftCopy, setShowLeftCopy] = useState<boolean>(true)
  const [showTopNav, setShowTopNav] = useState<boolean>(true)
  const [isolatedCardElementId, setIsolatedCardElementId] = useState<string | null>(null)

  // WebGL Stream Water Shader Config
  const [waterConfig, setWaterConfig] = useState<WaterShaderConfig>(DEFAULT_WATER_CONFIG)

  // Module 02 & 01 State
  const [bgInspectMode, setBgInspectMode] = useState<'empty-card-master' | 'repaired-master' | 'distant-bg' | 'foreground-rgba' | 'tree-rgba' | 'water-flow-map'>(
    'empty-card-master'
  )
  const [_secondaryBtnText, _setSecondaryBtnText] = useState<'查看演示' | '季节演示'>('查看演示')
  const [leftAmbientStrength, setLeftAmbientStrength] = useState<number>(0.85)
  const [streamerSpeed, setStreamerSpeed] = useState<number>(1.05)
  const [showClusterDebug, setShowClusterDebug] = useState<boolean>(false)
  const [showTuningPanel, setShowTuningPanel] = useState<boolean>(false)
  const [isExportingComposite, setIsExportingComposite] = useState<boolean>(false)

  const cardStageCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const darkCompareCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pureStageCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const offscreenGlowRef = useRef<HTMLCanvasElement | null>(null)
  const loadedImgsRef = useRef<Record<string, HTMLImageElement>>({})
  const waterRendererRef = useRef<WaterShaderRenderer | null>(null)
  const waterTexturesReadyRef = useRef(false)
  const visibleStagesRef = useRef({
    cardStage: true,
    pureStage: false,
    pureStageDirty: true,
  })

  const activeSeason = SEASON_THEMES.find((s) => s.id === seasonId) || SEASON_THEMES[0]
  const activeCommitIdx = hoveredCommitIdx !== null ? hoveredCommitIdx : selectedCommitIdx
  const triggerEnergySurge = () => {
    setPulseBoostUntil(performance.now() + 1400)
  }

  // Mutable ref storing all reactive state so hovering/clicking NEVER resets the 60FPS loop
  const sceneStateRef = useRef({
    dayNightMode,
    wind,
    lighting,
    seasonId,
    activeSeason,
    leftAmbientStrength,
    streamerSpeed,
    showClusterDebug,
    showCardFrame,
    showInnerBranchStream,
    showRootNexusStream,
    showBorderRimStream,
    showCardInteractiveUi,
    showCardOverhang,
    showWaterShader,
    showForegroundFlowersAndGlow,
    waterConfig,
    isolatedCardElementId,
    activeCommitIdx,
    activeSidebarId,
    hoveredSidebarId,
    hoveredToolbarId,
    activeToolbarId,
    pulseBoostUntil,
  })

  sceneStateRef.current = {
    dayNightMode,
    wind,
    lighting,
    seasonId,
    activeSeason,
    leftAmbientStrength,
    streamerSpeed,
    showClusterDebug,
    showCardFrame,
    showInnerBranchStream,
    showRootNexusStream,
    showBorderRimStream,
    showCardInteractiveUi,
    showCardOverhang,
    showWaterShader,
    showForegroundFlowersAndGlow,
    waterConfig,
    isolatedCardElementId,
    activeCommitIdx,
    activeSidebarId,
    hoveredSidebarId,
    hoveredToolbarId,
    activeToolbarId,
    pulseBoostUntil,
  }

  // Track viewport visibility of Module 03 (cardStageCanvasRef) and Module 02 (pureStageCanvasRef)
  // so offscreen canvases never waste CPU/GPU cycles every frame!
  useEffect(() => {
    visibleStagesRef.current.pureStageDirty = true
  }, [dayNightMode, seasonId, showCardFrame, showWaterShader, showForegroundFlowersAndGlow])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === cardStageCanvasRef.current) {
            visibleStagesRef.current.cardStage = entry.isIntersecting
          } else if (entry.target === pureStageCanvasRef.current) {
            visibleStagesRef.current.pureStage = entry.isIntersecting
            if (entry.isIntersecting) {
              visibleStagesRef.current.pureStageDirty = true
            }
          }
        }
      },
      { rootMargin: '240px 0px' }
    )
    if (cardStageCanvasRef.current) obs.observe(cardStageCanvasRef.current)
    if (pureStageCanvasRef.current) obs.observe(pureStageCanvasRef.current)
    return () => obs.disconnect()
  }, [])

  // Staged Priority Preloading:
  // Tier 1: Daytime hero and water maps
  // Tier 2: Nighttime hero
  // Tier 0: Active Day/Night landing hero (loads solo with high priority so canvas paints immediately)
  // Tier 1: Active foreground + card shell + water textures (loads right after Tier 0 or 60ms)
  // Tier 2: Opposite Day/Night hero (loads 250ms later for smooth manual toggling)
  // Tier 3: Module 02 & Inspector Decomposed Layers (loads 450ms later when idle)
  useEffect(() => {
    const initialIsNight = sceneStateRef.current.dayNightMode === 'night'
    const activeHeroUrl = fullScreenStage
      ? initialIsNight
        ? HERO_ASSETS.landingNightBase
        : HERO_ASSETS.landingDayBase
      : initialIsNight
        ? NIGHT_PREVIEW_BG_PATH
        : DAY_PREVIEW_BG_PATH
    const oppositeHeroUrl = fullScreenStage
      ? initialIsNight
        ? HERO_ASSETS.landingDayBase
        : HERO_ASSETS.landingNightBase
      : initialIsNight
        ? DAY_PREVIEW_BG_PATH
        : NIGHT_PREVIEW_BG_PATH

    const activeOverhangUrl = initialIsNight ? CARD_NIGHT_FOREGROUND_PATH : CARD_DAY_FOREGROUND_PATH
    const tier0HeroUrls: string[] = [activeHeroUrl, CARD_SHELL_PATH, activeOverhangUrl]

    const tier1WaterUrls = Array.from(new Set([WATER_MASK_PATH, WATER_FLOW_MAP_PATH, WATER_NORMAL_MAP_PATH, WATER_FG_OCCLUSION_PATH, WATER_NIGHT_FG_OCCLUSION_PATH]))

    const tier2OppositeUrls: string[] = [oppositeHeroUrl, initialIsNight ? CARD_DAY_FOREGROUND_PATH : CARD_NIGHT_FOREGROUND_PATH]

    const tier3SecondaryUrls = Array.from(
      new Set([
        GLOW_RGBA_PATH,
        DAY_DISTANT_BG_PATH,
        NIGHT_DISTANT_BG_PATH,
        DAY_FOREGROUND_RGBA_PATH,
        NIGHT_FOREGROUND_RGBA_PATH,
        NIGHT_PURE_BG_PATH,
        DAY_PURE_BG_PATH,
        NIGHT_TREE_RGBA_PATH,
        DAY_TREE_RGBA_PATH,
        USER_FG_OVERLAY_PATH,
      ])
    )

    let cancelled = false

    if (!waterRendererRef.current) {
      waterRendererRef.current = new WaterShaderRenderer()
    }

    const tryUploadWaterTextures = () => {
      if (waterTexturesReadyRef.current || !waterRendererRef.current) return
      const im = loadedImgsRef.current
      const wMask = im[WATER_MASK_PATH]
      const wFlow = im[WATER_FLOW_MAP_PATH]
      const wNorm = im[WATER_NORMAL_MAP_PATH]
      const dayBanks = im[WATER_FG_OCCLUSION_PATH]
      const nightBanks = im[WATER_NIGHT_FG_OCCLUSION_PATH]

      if (wMask && wFlow && wNorm && dayBanks && nightBanks) {
        waterTexturesReadyRef.current = waterRendererRef.current.uploadTextures(wMask, wFlow, wNorm, dayBanks, nightBanks)
      }
    }

    const loadBatch = (urls: string[], highPriority = false, onDone?: () => void): boolean => {
      let allSyncReady = true
      urls.forEach((u) => {
        if (loadedImgsRef.current[u]) {
          onDone?.()
          return
        }
        const isLandingPreload = fullScreenStage && (tier0HeroUrls.includes(u) || tier2OppositeUrls.includes(u))
        const img = new Image()
        if (!isLandingPreload) img.crossOrigin = 'anonymous'
        if (highPriority) img.fetchPriority = 'high'
        img.decoding = 'async'
        const handleReady = () => {
          if (cancelled || loadedImgsRef.current[u]) return
          loadedImgsRef.current[u] = img
          visibleStagesRef.current.pureStageDirty = true
          tryUploadWaterTextures()
          onDone?.()
        }
        img.onload = handleReady
        img.onerror = () => {
          if (!cancelled) onDone?.()
        }
        const isVersionedAsset = u.startsWith('/world-tree-assets/') || u.startsWith('/assets/world-tree/')
        img.src = isVersionedAsset && !isLandingPreload ? `${u}${HERO_ASSET_VERSION}` : u
        if (img.complete && img.naturalWidth > 0) {
          handleReady()
        } else {
          allSyncReady = false
        }
      })
      return allSyncReady
    }

    let tier1Started = false
    const startTier1 = () => {
      if (cancelled || tier1Started) return
      tier1Started = true
      loadBatch(tier1WaterUrls)
    }

    const onTier0ImageReady = () => {
      const allReady = tier0HeroUrls.every((u) => Boolean(loadedImgsRef.current[u]))
      if (!allReady) return
      startTier1()
    }

    // Start active hero + card shell + overhang together with high priority so the full APP panel paints on frame 1
    loadBatch(tier0HeroUrls, true, onTier0ImageReady)
    const t1FallbackTimer = window.setTimeout(startTier1, 60)

    // Start Tier 2 (opposite Day/Night hero) shortly after active hero settles
    const t2Timer = window.setTimeout(() => {
      if (!cancelled) loadBatch(tier2OppositeUrls)
    }, 250)

    // Start Tier 3 (Module 02 & Inspector layers) once initial hero settles
    const t3Timer = window.setTimeout(() => {
      if (!cancelled) loadBatch(fullScreenStage ? [GLOW_RGBA_PATH] : tier3SecondaryUrls)
    }, 450)

    return () => {
      cancelled = true
      window.clearTimeout(t1FallbackTimer)
      window.clearTimeout(t2Timer)
      window.clearTimeout(t3Timer)
      waterRendererRef.current?.dispose()
      waterRendererRef.current = null
      waterTexturesReadyRef.current = false
    }
  }, [fullScreenStage])

  // =========================================================================
  // High-Performance 60 FPS Render Loop:
  // - Pre-baked 64x64 radial glow sprite atlas (`getGlowSprite`) eliminates 400+ createRadialGradient calls/frame
  // - IntersectionObserver offscreen gating pauses Module 02 when scrolled out of view
  // =========================================================================
  useEffect(() => {
    let rafId = 0
    let lastTime = performance.now()
    let elapsedT = 0
    let streamPhase = 0
    let frameCount = 0
    let hasPaintedCard = false
    // Continuous Day/Night progress: 0.0 = pure Daytime, 1.0 = pure Nighttime (Dark Mode)
    let currentDayNightProgress = sceneStateRef.current.dayNightMode === 'night' ? 1.0 : 0.0

    const W = 1672
    const H = 941

    if (!offscreenGlowRef.current) {
      const oc = document.createElement('canvas')
      oc.width = W
      oc.height = H
      offscreenGlowRef.current = oc
    }

    const windRenderer = createHeroWindRenderer(W, H)
    const foregroundCanvas = document.createElement('canvas')
    foregroundCanvas.width = W
    foregroundCanvas.height = H
    const foregroundCtx = foregroundCanvas.getContext('2d')
    const cardOccludedEdge = new Path2D(CARD_OCCLUDED_EDGE)
    const leftSpores = Array.from({ length: 24 }, (_, i) => ({
      x: 45 + ((i * 173.7) % 580),
      y: 80 + ((i * 251.3) % 790),
      vx: 0.08 + (i % 5) * 0.035,
      vy: -0.11 - (i % 7) * 0.028,
      size: 1.5 + (i % 4) * 0.65,
      alpha: 0.24 + (i % 5) * 0.07,
      f1: 0.42 + ((i * 0.137) % 0.95),
      f2: 0.89 + ((i * 0.293) % 1.35),
      p1: i * 1.414,
      p2: i * 2.718,
    }))

    const rightSpores = Array.from({ length: 34 }, (_, i) => ({
      x: 680 + ((i * 197.3) % 960),
      y: 40 + ((i * 239.1) % 690),
      vx: ((i % 7) - 3) * 0.06,
      vy: -0.1 - (i % 5) * 0.035,
      size: 1.8 + (i % 5) * 0.6,
      alpha: 0.35 + (i % 6) * 0.09,
      f1: 0.51 + ((i * 0.173) % 1.15),
      f2: 1.07 + ((i * 0.317) % 1.45),
      p1: i * 1.732,
      p2: i * 3.141,
    }))

    // 22 Foreground Dew & Wildflower Spores drifting up across the bottom meadow & stream (y: 685..935)
    const foregroundSpores = Array.from({ length: 22 }, (_, i) => ({
      x: 35 + ((i * 211.7) % 1600),
      y: 710 + ((i * 89.3) % 220),
      vx: ((i % 5) - 2) * 0.05,
      vy: -0.12 - (i % 4) * 0.03,
      size: 1.7 + (i % 4) * 0.65,
      alpha: 0.42 + (i % 5) * 0.09,
      f1: 0.58 + ((i * 0.19) % 1.1),
      f2: 1.15 + ((i * 0.27) % 1.4),
      p1: i * 1.618,
      p2: i * 2.414,
    }))

    const canDrawLandingScene = (night: boolean) => {
      const imgs = loadedImgsRef.current
      return Boolean(
        imgs[night ? HERO_ASSETS.landingNightBase : HERO_ASSETS.landingDayBase] && imgs[CARD_SHELL_PATH] && imgs[night ? CARD_NIGHT_FOREGROUND_PATH : CARD_DAY_FOREGROUND_PATH]
      )
    }

    const drawScene = (
      ctx: CanvasRenderingContext2D,
      t: number,
      st: number,
      withCardStage: boolean,
      dnProgress: number // 0.0 = Day, 1.0 = Night (supports smooth Scheme 1 staggered transition!)
    ) => {
      const s = sceneStateRef.current
      const imgs = loadedImgsRef.current
      const rad = (s.wind.directionDeg * Math.PI) / 180
      const dirX = Math.cos(rad)
      const effectiveWind = s.wind.enabled ? s.wind.strength : 0

      // =====================================================================
      // SCHEME 1: 3-Stage Natural Staggered Day/Night Transition Weights!
      // 1. skyBlend (0.0 -> 0.58): Sky, Sun & Distant Valley transition first
      // 2. treeBlend (0.16 -> 0.82): World Tree, Outer Canopy & Foreground transition second
      // 3. glowBlend (0.42 -> 1.00): Nocturnal Bioluminescent Nodes, Veins & Aurora bloom last
      // 4. twilightPulse: Warm golden-amber dusk/dawn atmospheric wash during mid-transition
      // =====================================================================
      const skyBlend = smoothstepJS(0.0, 0.58, dnProgress)
      const treeBlend = smoothstepJS(0.16, 0.82, dnProgress)
      const glowBlend = smoothstepJS(0.42, 1.0, dnProgress)
      const twilightPulse = Math.sin(dnProgress * Math.PI)

      const dayBaseImg = imgs[fullScreenStage ? HERO_ASSETS.landingDayBase : DAY_PREVIEW_BG_PATH]
      const nightBaseImg = imgs[fullScreenStage ? HERO_ASSETS.landingNightBase : NIGHT_PREVIEW_BG_PATH]
      if (fullScreenStage && !canDrawLandingScene(dnProgress >= 0.5)) return false
      ctx.clearRect(0, 0, W, H)

      // Single-element isolation mode on dark checkerboard
      if (withCardStage && s.isolatedCardElementId) {
        ctx.fillStyle = '#050d11'
        ctx.fillRect(0, 0, W, H)
        const tile = 28
        ctx.fillStyle = '#09171e'
        for (let y = 0; y < H; y += tile) {
          for (let x = 0; x < W; x += tile) {
            if (((x / tile + y / tile) & 1) === 0) {
              ctx.fillRect(x, y, tile, tile)
            }
          }
        }
        const el = CARD_DECOMPOSED_ELEMENTS.find((e) => e.id === s.isolatedCardElementId)
        if (el?.url) {
          const targetUrl = (dnProgress >= 0.5 && el.nightUrl) || el.url
          if (imgs[targetUrl]) ctx.drawImage(imgs[targetUrl], 0, 0, W, H)
        } else if (el) {
          drawCardLayer(ctx, el.id, dnProgress, st)
        }
        return true
      }

      // ---------------------------------------------------------------------
      // STEP 1: Staggered Base Scene Rendering (Distant Sky -> World Tree & Foreground)
      // ---------------------------------------------------------------------
      const sceneFilter = s.seasonId === 'default' ? 'none' : `hue-rotate(${SEASON_HUE_OFFSETS[s.seasonId] ?? 0}deg) saturate(${s.activeSeason.saturate})`
      ctx.save()
      ctx.filter = sceneFilter

      if (dayBaseImg && (!nightBaseImg || dnProgress <= 0.002)) {
        ctx.drawImage(dayBaseImg, 0, 0, W, H)
      } else if (nightBaseImg && (!dayBaseImg || dnProgress >= 0.998)) {
        ctx.drawImage(nightBaseImg, 0, 0, W, H)
      } else if (dayBaseImg && nightBaseImg) {
        // Seamless Full-Frame Scheme 1 Staggered Transition (ZERO rectangular 660x715 crops!):
        // A. Draw Full Daytime Base (1672x941)
        ctx.drawImage(dayBaseImg, 0, 0, W, H)

        // B. Upper sky & distant horizon darken slightly ahead of the foreground
        const skyLead = Math.max(0, skyBlend - treeBlend)
        if (skyLead > 0.005) {
          ctx.save()
          const skyVeil = withCardStage && s.showCardFrame ? ctx.createRadialGradient(200, 110, 0, 200, 110, 620) : ctx.createLinearGradient(0, 0, 0, 740)
          skyVeil.addColorStop(0, `rgba(2, 12, 17, ${0.88 * skyLead})`)
          skyVeil.addColorStop(0.55, `rgba(4, 24, 32, ${0.65 * skyLead})`)
          skyVeil.addColorStop(1, 'rgba(4, 24, 32, 0)')
          ctx.fillStyle = skyVeil
          ctx.fillRect(0, 0, W, 740)
          ctx.restore()
        }

        // C. Full Night Scene (1672x941: Nocturnal Sky + Nocturnal World Tree + Nocturnal Foreground)
        if (treeBlend > 0.005) {
          ctx.save()
          ctx.globalAlpha = treeBlend
          ctx.drawImage(nightBaseImg, 0, 0, W, H)
          ctx.restore()
        }

        // D. Warm Golden-Amber Dusk / Dawn Horizon Wash during mid-transition (`twilightPulse`)
        if (twilightPulse > 0.02) {
          ctx.save()
          ctx.globalCompositeOperation = 'screen'
          const duskGrad = withCardStage && s.showCardFrame ? ctx.createRadialGradient(270, 120, 0, 270, 120, 850) : ctx.createLinearGradient(0, 60, 0, 760)
          duskGrad.addColorStop(0, `rgba(251, 146, 60, ${0.12 * twilightPulse})`)
          duskGrad.addColorStop(0.48, `rgba(45, 212, 191, ${0.1 * twilightPulse})`)
          duskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
          ctx.fillStyle = duskGrad
          ctx.fillRect(0, 0, W, H)
          ctx.restore()
        }
      } else {
        ctx.fillStyle = dnProgress < 0.5 ? '#1e6bb8' : '#03090d'
        ctx.fillRect(0, 0, W, H)
      }

      ctx.save()
      ctx.filter = 'none'
      if (s.showWaterShader && (dayBaseImg || nightBaseImg) && waterRendererRef.current) {
        const waterCanvas = waterRendererRef.current.render(ctx.canvas, t, treeBlend, s.waterConfig)
        if (waterCanvas) {
          ctx.drawImage(waterCanvas, STREAM_BOUNDS.x, STREAM_BOUNDS.y, STREAM_BOUNDS.w, STREAM_BOUNDS.h)
        }
      }
      windRenderer?.draw(ctx, t, effectiveWind, rad, s.wind.gustiness, s.showForegroundFlowersAndGlow)
      ctx.restore()

      ctx.restore()

      // ---------------------------------------------------------------------
      // STEP 2: Left & Middle-Left Ambient Animations (Solar Corona in Day <-> Aurora Rays in Night)
      // ---------------------------------------------------------------------
      if (!fullScreenStage && s.leftAmbientStrength > 0.02) {
        ctx.save()
        ctx.globalCompositeOperation = 'screen'

        const dayWeight = 1 - skyBlend
        if (dayWeight > 0.01) {
          // Daytime Solar Corona & Warm Sunbeams around (425, 168)
          const sunPulse = 0.82 + 0.18 * irregularPulse(t, 0.35, 0.78, 1.25, 0.5, 1.9, 3.4, 1.6)
          const sunR = 195 * sunPulse * (0.7 + 0.3 * dayWeight)
          const sunSprite = getGlowSprite('#fffff5', 'rgba(254, 240, 138, 0.52)', 0.38)
          ctx.globalAlpha = 0.42 * s.leftAmbientStrength * dayWeight
          ctx.drawImage(sunSprite, 425 - sunR, 168 - sunR, sunR * 2, sunR * 2)
          ctx.globalAlpha = 1

          const sunbeams = [
            { angle: 0.45, width: 0.14, len: 560, f1: 0.31, p1: 0.4 },
            { angle: 0.78, width: 0.16, len: 620, f1: 0.24, p1: 1.8 },
            { angle: 1.15, width: 0.15, len: 580, f1: 0.28, p1: 3.2 },
            { angle: 1.52, width: 0.12, len: 510, f1: 0.36, p1: 4.7 },
          ]
          for (const sb of sunbeams) {
            const bPulse = 0.4 + 0.6 * Math.sin(t * sb.f1 + sb.p1) * Math.sin(t * sb.f1 + sb.p1)
            const bAlpha = 0.065 * s.leftAmbientStrength * bPulse * dayWeight
            ctx.save()
            ctx.translate(425, 168)
            ctx.rotate(sb.angle + Math.sin(t * 0.18 + sb.p1) * 0.03)
            const bGrad = ctx.createLinearGradient(0, 0, sb.len, 0)
            bGrad.addColorStop(0, `rgba(255, 255, 240, ${bAlpha * 1.4})`)
            bGrad.addColorStop(0.5, `rgba(254, 249, 195, ${bAlpha})`)
            bGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
            ctx.fillStyle = bGrad
            ctx.beginPath()
            ctx.moveTo(0, 0)
            ctx.lineTo(sb.len, -sb.len * sb.width)
            ctx.lineTo(sb.len, sb.len * sb.width)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
          }
        }

        if (glowBlend > 0.01) {
          // Nighttime Aurora Tyndall Rays & Valley Mist (Phase 3 of Scheme 1)
          const rays = [
            { xTop: 90, xBot: 330, w: 175, f1: 0.29, f2: 0.67, p1: 0.3, p2: 2.1, maxAlpha: 0.055 },
            { xTop: 260, xBot: 520, w: 205, f1: 0.21, f2: 0.53, p1: 2.4, p2: 0.8, maxAlpha: 0.065 },
            { xTop: 430, xBot: 640, w: 185, f1: 0.34, f2: 0.79, p1: 4.5, p2: 3.7, maxAlpha: 0.062 },
          ]
          for (const r of rays) {
            const breath = irregularPulse(t, r.f1, r.f2, r.f1 * 1.4, r.p1, r.p2, r.p1 + 1.2, 1.5)
            const rayAlpha = r.maxAlpha * s.leftAmbientStrength * breath * glowBlend
            const shiftX = Math.sin(t * r.f1 * 0.7 + r.p1) * 22 + Math.cos(t * r.f2 * 0.4 + r.p2) * 10

            ctx.save()
            ctx.beginPath()
            ctx.moveTo(r.xTop + shiftX, 0)
            ctx.lineTo(r.xTop + r.w + shiftX, 0)
            ctx.lineTo(r.xBot + r.w * 1.25 + shiftX, H * 0.8)
            ctx.lineTo(r.xBot + shiftX, H * 0.8)
            ctx.closePath()

            const grad = ctx.createLinearGradient(r.xTop, 0, r.xBot, H * 0.8)
            grad.addColorStop(0, `rgba(45, 212, 191, 0)`)
            grad.addColorStop(0.35, `rgba(45, 212, 191, ${rayAlpha})`)
            grad.addColorStop(0.75, `rgba(20, 184, 166, ${rayAlpha * 0.5})`)
            grad.addColorStop(1, `rgba(13, 148, 136, 0)`)
            ctx.fillStyle = grad
            ctx.fill()
            ctx.restore()
          }

          const mistSprite = getGlowSprite('#2dd4bf', 'rgba(17, 94, 89, 0.45)', 0.55)
          const mistBands = [
            { cx: 290, cy: 615, rx: 280, ry: 85, f1: 0.27, f2: 0.61, amp: 42, p1: 0.2, p2: 1.9, alpha: 0.07 },
            { cx: 480, cy: 585, rx: 290, ry: 95, f1: 0.19, f2: 0.47, amp: 46, p1: 2.3, p2: 4.1, alpha: 0.08 },
          ]
          for (const mb of mistBands) {
            const mx = mb.cx + Math.sin(t * mb.f1 + mb.p1) * mb.amp + Math.cos(t * mb.f2 * 0.5 + mb.p2) * 14
            const my = mb.cy + Math.cos(t * mb.f1 * 0.65 + mb.p2) * 8
            const pulse = 0.55 + 0.45 * irregularPulse(t, mb.f1, mb.f2, 0.37, mb.p1, mb.p2, 1.1, 1.4)
            ctx.globalAlpha = mb.alpha * s.leftAmbientStrength * pulse * glowBlend
            ctx.drawImage(mistSprite, mx - mb.rx, my - mb.ry, mb.rx * 2, mb.ry * 2)
          }
          ctx.globalAlpha = 1
        }

        const leftWindVx = s.wind.enabled ? dirX * s.wind.strength * 0.22 : 0.05
        const leftSporeSprite = dnProgress < 0.5 ? getGlowSprite('#fffff0', '#fde047', 0.45) : getGlowSprite('#99f6e4', '#2dd4bf', 0.45)
        for (const sp of leftSpores) {
          sp.x += (sp.vx + leftWindVx) * 0.5 + Math.sin(t * sp.f1 + sp.p1) * 0.08
          sp.y += sp.vy * 0.5 + Math.cos(t * sp.f2 + sp.p2) * 0.06
          if (sp.x > 625) sp.x = 40
          if (sp.x < 30) sp.x = 615
          if (sp.y < 60) sp.y = 870
          if (sp.y > 880) sp.y = 70

          const twinkle = irregularPulse(t, sp.f1, sp.f2, sp.f1 * 1.618, sp.p1, sp.p2, sp.p1 + 2.3, 2.4)
          const a = sp.alpha * s.leftAmbientStrength * (0.12 + 0.88 * twinkle)
          const r = sp.size * 2.8
          ctx.globalAlpha = Math.min(1, a * (dnProgress < 0.5 ? 1.15 : 1.0))
          ctx.drawImage(leftSporeSprite, sp.x - r, sp.y - r, r * 2, r * 2)
        }

        ctx.restore()
      }

      // ---------------------------------------------------------------------
      // STEP 4: Animated Flowing Light Streamers and Active Commit Connector
      // Uses pre-baked radial glow sprites (`getGlowSprite`) and zero expensive `shadowBlur`
      // ---------------------------------------------------------------------
      if (withCardStage) {
        const shell = imgs[CARD_SHELL_PATH]
        const dayForeground = imgs[CARD_DAY_FOREGROUND_PATH]
        const nightForeground = imgs[CARD_NIGHT_FOREGROUND_PATH]
        const drawCard = s.showCardFrame && shell
        const hasForeground = s.showCardOverhang && Boolean(dayForeground || nightForeground)
        if (drawCard) {
          ctx.save()
          if (hasForeground) ctx.clip(cardOccludedEdge)
          ctx.drawImage(shell, 0, 0, W, H)
          if (s.showCardInteractiveUi) drawHeroCardUi(ctx, s, treeBlend, cardLabelsRef.current)
          ctx.restore()
        }

        const showBranches = Boolean(drawCard && s.showInnerBranchStream)
        if (showBranches || s.showRootNexusStream) {
          drawHeroCardBranches(ctx, s, st, getGlowSprite, showBranches, s.showRootNexusStream)
        }

        ctx.save()
        ctx.globalCompositeOperation = 'lighter'

        // 4D. Animated Card Border Rim Streamers (using stretched pre-baked glow sprites!)
        if (s.showCardFrame && s.showBorderRimStream) {
          if (hasForeground) ctx.clip(cardOccludedEdge)
          const rimSpTop = getGlowSprite('#ffffff', '#34d399', 0.35)
          const rimSpLeft = getGlowSprite('#ffffff', '#2dd4bf', 0.4)
          const rimSpBot = getGlowSprite('#ffffff', '#38bdf8', 0.4)

          const topProg = (st * 0.32) % 1
          const topX = 680 + topProg * (1440 - 680)
          const topFade = Math.sin(topProg * Math.PI)
          ctx.globalAlpha = 0.75 * topFade
          ctx.drawImage(rimSpTop, topX - 95, 246 - 10, 190, 20)

          const leftProg = (st * 0.27 + 0.4) % 1
          const leftY = 655 - leftProg * (655 - 270)
          const leftFade = Math.sin(leftProg * Math.PI)
          ctx.globalAlpha = 0.7 * leftFade
          ctx.drawImage(rimSpLeft, 660 - 10, leftY - 75, 20, 150)

          const botProg = (st * 0.38 + 0.7) % 1
          const botX = 680 + botProg * (1047 - 680)
          const botFade = Math.sin(botProg * Math.PI)
          ctx.globalAlpha = 0.7 * botFade
          ctx.drawImage(rimSpBot, botX - 80, 682 - 9, 160, 18)
        }

        ctx.restore()

        if (drawCard && hasForeground) {
          let foreground: HTMLImageElement | HTMLCanvasElement = treeBlend < 0.5 ? dayForeground || nightForeground : nightForeground || dayForeground
          if (dayForeground && nightForeground && foregroundCtx && treeBlend > 0 && treeBlend < 1) {
            foregroundCtx.clearRect(0, 0, W, H)
            foregroundCtx.save()
            foregroundCtx.globalAlpha = 1 - treeBlend
            foregroundCtx.drawImage(dayForeground, 0, 0)
            foregroundCtx.globalCompositeOperation = 'lighter'
            foregroundCtx.globalAlpha = treeBlend
            foregroundCtx.drawImage(nightForeground, 0, 0)
            foregroundCtx.restore()
            foreground = foregroundCanvas
          }
          ctx.save()
          ctx.filter = sceneFilter
          ctx.drawImage((effectiveWind > 0 && windRenderer?.warpCardForeground(foreground)) || foreground, 0, 0)
          ctx.restore()
        }
      }

      // ---------------------------------------------------------------------
      // STEP 5: Foreground Glowing Elements Animation + World Tree Twinkling Nodes
      // Uses pre-baked radial glow sprites (`getGlowSprite`) -> 0 gradient allocations/frame!
      // ---------------------------------------------------------------------
      if (s.showForegroundFlowersAndGlow) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'

        // 5A. 14 Foreground Glowing Flower Buds, Root Orbs & Stream Lights
        const fgGlowMult = 0.68 + 0.32 * glowBlend
        for (const fg of FOREGROUND_GLOW_ELEMENTS) {
          const [dx, dy] = windRenderer?.offsetAt(fg.x, fg.y) ?? [0, 0]
          const gx = fg.x + dx
          const gy = fg.y + dy

          const p = irregularPulse(t, fg.f1, fg.f2, fg.f1 * 1.618, fg.p1, fg.p2, fg.p1 + 2.1, 2.0)
          const rad = fg.r * (0.85 + 1.15 * p)
          const fgSp = getGlowSprite('#ffffff', fg.color, 0.38)
          ctx.globalAlpha = Math.min(0.94, (0.28 + 0.72 * p) * fgGlowMult)
          ctx.drawImage(fgSp, gx - rad, gy - rad, rad * 2, rad * 2)
        }

        // 5B. 22 Foreground Dew & Wildflower Spores drifting up from the bottom meadow & stream
        const fgWindVx = s.wind.enabled ? dirX * effectiveWind * 0.38 : 0.06
        const fgSporeSp = getGlowSprite('#ffffff', dnProgress < 0.5 ? '#fef08a' : '#5efce8', 0.45)
        for (const fp of foregroundSpores) {
          fp.x += (fp.vx + fgWindVx) * 0.5 + Math.sin(t * fp.f1 + fp.p1) * 0.1
          fp.y += fp.vy * 0.5 + Math.cos(t * fp.f2 + fp.p2) * 0.06
          if (fp.x > 1645) fp.x = 30
          if (fp.x < 20) fp.x = 1635
          if (fp.y < 680) fp.y = 932
          if (fp.y > 938) fp.y = 695

          const twinkle = irregularPulse(t, fp.f1, fp.f2, fp.f1 * 1.5, fp.p1, fp.p2, 1.4, 2.2)
          const a = fp.alpha * (0.15 + 0.85 * twinkle) * fgGlowMult
          const r = fp.size * 3.0
          ctx.globalAlpha = a
          ctx.drawImage(fgSporeSp, fp.x - r, fp.y - r, r * 2, r * 2)
        }

        ctx.restore()
      }

      // World Tree Asynchronous Vein Pulses & 18 Twinkling Tree Nodes
      const glowImg = imgs[GLOW_RGBA_PATH]
      const oc = offscreenGlowRef.current
      if (!withCardStage && glowImg && oc && s.lighting.glowIntensity > 0.05) {
        const octx = oc.getContext('2d')
        if (octx) {
          octx.clearRect(0, 0, W, H)
          const veinSp = getGlowSprite('#ffffff', 'rgba(255,255,255,0.5)', 0.55)
          for (const vz of LOCAL_VEIN_ZONES) {
            const pulse = irregularPulse(t, vz.f1, vz.f2, vz.f1 * 1.73, vz.p1, vz.p2, vz.p1 + 3.1, 2.5)
            const alpha = Math.min(0.9, s.lighting.glowIntensity * (0.38 + 0.25 * glowBlend) * pulse)
            if (alpha < 0.015) continue
            octx.globalAlpha = alpha
            octx.drawImage(veinSp, vz.cx - vz.r, vz.cy - vz.r, vz.r * 2, vz.r * 2)
          }
          octx.globalAlpha = 1
          octx.globalCompositeOperation = 'source-in'
          octx.drawImage(glowImg, 0, 0, W, H)
          octx.globalCompositeOperation = 'source-over'

          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.drawImage(oc, 0, 0, W, H)
          ctx.restore()
        }
      }

      if (s.lighting.nodeIntensity > 0.05) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const nodeGlowMult = 0.65 + 0.35 * glowBlend
        for (const nd of HERO_TREE_NODES) {
          if (withCardStage && s.showCardFrame && nd.x > 650 && nd.x < 1510 && nd.y > 240 && nd.y < 690) {
            continue
          }

          const [dx, dy] = windRenderer?.offsetAt(nd.x, nd.y) ?? [0, 0]
          const nx = nd.x + dx
          const ny = nd.y + dy

          const pulse = irregularPulse(t, nd.f1, nd.f2, nd.f3, nd.p1, nd.p2, nd.p3, nd.exp)
          if (pulse < 0.04) continue

          const rOuter = nd.r * (0.95 + 1.15 * pulse)
          const ndSp = getGlowSprite('#ffffff', nd.color, 0.35)
          ctx.globalAlpha = Math.min(0.94, s.lighting.nodeIntensity * 0.76 * pulse * nodeGlowMult)
          ctx.drawImage(ndSp, nx - rOuter, ny - rOuter, rOuter * 2, rOuter * 2)
        }
        ctx.restore()
      }

      if (s.lighting.particlesEnabled) {
        const windVx = s.wind.enabled ? dirX * effectiveWind * 0.45 : 0.1
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = dnProgress < 0.5 ? '#fef08a' : s.activeSeason.particleColor
        for (const p of rightSpores) {
          p.x += (p.vx + windVx) * 0.5 + Math.sin(t * p.f1 + p.p1) * 0.09
          p.y += p.vy * 0.5 + Math.cos(t * p.f2 + p.p2) * 0.07
          if (p.x > 1655) p.x = 680
          if (p.x < 660) p.x = 1645
          if (p.y < 35) p.y = 720
          if (p.y > 740) p.y = 45

          const box = CARD_UI_BOUNDS
          if (withCardStage && s.showCardFrame && s.showCardInteractiveUi && p.x > box.x && p.x < box.x + box.width && p.y > box.y && p.y < box.y + box.height) {
            continue
          }

          const twinkle = irregularPulse(t, p.f1, p.f2, p.f1 * 1.414, p.p1, p.p2, p.p1 + 1.9, 2.3)
          ctx.globalAlpha = p.alpha * (0.1 + 0.9 * twinkle)
          ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2)
        }
        ctx.restore()
      }

      if (s.showClusterDebug) {
        for (const { tip, anchor, radius, foliage, name } of HERO_WIND_REGIONS) {
          if (foliage === 'card' && (!withCardStage || !s.showCardFrame || !s.showCardOverhang)) continue
          const color = foliage === 'meadow' ? '#f472b6' : foliage === 'card' ? '#4ade80' : '#facc15'
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 4])
          ctx.beginPath()
          ctx.ellipse(...tip, ...radius, 0, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(...anchor, 3.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 11px system-ui, sans-serif'
          ctx.fillText(name, tip[0] - 35, tip[1])
        }
      }
      return true
    }

    const renderLoop = (now: number) => {
      const frameSeconds = Math.max(0.001, (now - lastTime) * 0.001)
      const dt = Math.min(0.05, frameSeconds)
      lastTime = now
      frameCount++

      const s = sceneStateRef.current
      const isBoosted = now < s.pulseBoostUntil
      const speedMult = isBoosted ? s.streamerSpeed * 1.85 : s.streamerSpeed

      elapsedT += dt
      streamPhase += dt * speedMult

      // Smoothly advance Scheme 1 Day/Night transition progress (~1.15 seconds duration)
      const targetProgress = s.dayNightMode === 'night' ? 1.0 : 0.0
      if (fullScreenStage && !hasPaintedCard) currentDayNightProgress = targetProgress
      const targetReady = !fullScreenStage || canDrawLandingScene(targetProgress === 1)
      const isTransitioning = targetReady && Math.abs(currentDayNightProgress - targetProgress) > 0.0005
      if (isTransitioning) {
        const step = (fullScreenStage ? frameSeconds : dt) / 1.15
        if (currentDayNightProgress < targetProgress) {
          currentDayNightProgress = Math.min(targetProgress, currentDayNightProgress + step)
        } else {
          currentDayNightProgress = Math.max(targetProgress, currentDayNightProgress - step)
        }
      } else if (targetReady) {
        currentDayNightProgress = targetProgress
      }

      const vis = visibleStagesRef.current

      // 1. Primary Hero Stage (Module 03): Full 60FPS when visible or transitioning
      if (cardStageCanvasRef.current && (vis.cardStage || isTransitioning)) {
        const ctx1 = cardStageCanvasRef.current.getContext('2d')
        if (ctx1 && drawScene(ctx1, elapsedT, streamPhase, true, currentDayNightProgress) && !hasPaintedCard) {
          hasPaintedCard = true
          onFirstFrame?.()
        }
      }

      // 2. Dual Day/Night Compare Stage (only mounted when compare mode is toggled on)
      if (darkCompareCanvasRef.current && vis.cardStage) {
        const ctxDark = darkCompareCanvasRef.current.getContext('2d')
        if (ctxDark) {
          const oppProgress = 1.0 - currentDayNightProgress
          drawScene(ctxDark, elapsedT, streamPhase, true, oppProgress)
        }
      }

      // 3. Secondary Pure World Tree Stage (Module 02 below the fold):
      //    Paused when offscreen (except initial dirty paint), 30FPS when scrolled into view!
      if (pureStageCanvasRef.current && (vis.pureStageDirty || isTransitioning || (vis.pureStage && (frameCount & 1) === 0))) {
        const ctx2 = pureStageCanvasRef.current.getContext('2d')
        if (ctx2) {
          drawScene(ctx2, elapsedT, streamPhase, false, currentDayNightProgress)
          vis.pureStageDirty = false
        }
      }

      rafId = requestAnimationFrame(renderLoop)
    }

    rafId = requestAnimationFrame(renderLoop)
    return () => {
      cancelAnimationFrame(rafId)
      windRenderer?.dispose()
    }
  }, [fullScreenStage, onFirstFrame])

  const handleDownloadStagePng = (canvas: HTMLCanvasElement | null, filename: string) => {
    if (!canvas) return
    setIsExportingComposite(true)
    try {
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = filename
      link.click()
    } finally {
      setIsExportingComposite(false)
    }
  }

  const isDay = dayNightMode === 'day'

  const handleDownloadCardLayer = (id: string) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1672
    canvas.height = 941
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawCardLayer(ctx, id, isDay ? 0 : 1)
    handleDownloadStagePng(canvas, `hero-${id}-${dayNightMode}.png`)
  }

  return (
    <div translate="no" className={compactBannerMode ? 'notranslate w-full' : 'notranslate space-y-10'}>
      {/* Top Action, Scheme 1 Day/Night Switcher & Status Bar */}
      {!compactBannerMode && (
        <div className="bg-[#08151a] border border-teal-900/60 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono text-teal-300">
              {isEffectsStudio ? '外缘叶尖和两岸花草可见摆动 · 卡边垂叶轻摆 · 溪流从上游到近景逐渐增强' : '世界树底图 → 卡片外壳 → Canvas UI → 分支与根系流光 → 局部树体前景'}
            </div>
            <h2 className="text-lg font-display font-bold text-white">{isOfficial ? '首屏动态预览' : isEffectsStudio ? '首页动效调试' : '首页分层合成与昼夜对照'}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Prominent Daytime / Dark Mode Toggle (Triggers 1.15s Scheme 1 Staggered Transition) */}
            <div className="flex items-center bg-[#040c0f] p-1 rounded-xl border border-teal-800/80 shadow-inner">
              <button
                onClick={() => {
                  setDualDayNightCompare(false)
                  handleSwitchDayNight('day')
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isDay && !dualDayNightCompare
                    ? 'bg-gradient-to-r from-amber-300 to-sky-300 text-slate-950 shadow-[0_0_16px_rgba(253,224,71,0.45)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <LuSun className="w-3.5 h-3.5" />
                <span>☀️ 白天模式 (错峰晨光过渡)</span>
              </button>
              <button
                onClick={() => {
                  setDualDayNightCompare(false)
                  handleSwitchDayNight('night')
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  !isDay && !dualDayNightCompare
                    ? 'bg-gradient-to-r from-[#2dd4bf] to-[#34d399] text-slate-950 shadow-[0_0_16px_rgba(45,212,191,0.45)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <LuMoon className="w-3.5 h-3.5" />
                <span>🌙 暗黑模式 (错峰入夜点亮)</span>
              </button>
              <button
                onClick={() => {
                  handleSwitchDayNight('day')
                  setDualDayNightCompare((v) => !v)
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  dualDayNightCompare
                    ? 'bg-gradient-to-r from-amber-300 via-teal-300 to-emerald-400 text-slate-950 shadow-[0_0_16px_rgba(45,212,191,0.45)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>🌗 白天+暗黑同屏对照</span>
              </button>
            </div>

            <button
              onClick={() => setShowClusterDebug((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                showClusterDebug ? 'bg-amber-500/20 text-amber-200 border-amber-400/50' : 'bg-[#050e12] text-slate-300 border-teal-900/60 hover:text-white'
              }`}
            >
              <LuWind className="w-3.5 h-3.5 text-amber-300" />
              <span>{showClusterDebug ? '隐藏树冠与近景花丛标记' : '检视树冠叶簇与近景花丛'}</span>
            </button>

            {!isEffectsStudio && (
              <button
                onClick={() => setShowTuningPanel((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showTuningPanel ? 'bg-teal-500/20 text-teal-200 border-teal-400/50' : 'bg-[#050e12] text-slate-300 border-teal-900/60 hover:text-white'
                }`}
              >
                <LuSlidersHorizontal className="w-3.5 h-3.5 text-teal-400" />
                <span>风场 / 水流 Shader 微调</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive Fine-Tuning Drawer (Wind + Streamers + WebGL Water Shader) */}
      {!compactBannerMode && (showTuningPanel || isEffectsStudio) && (
        <div className="bg-[#08151a] border border-teal-800/50 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-5 text-xs">
          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-slate-300">
              <span>全局微风强度（外缘树叶与近景花草）</span>
              <span className="text-emerald-300 tabular-nums">{Math.round(wind.strength * 100)}%</span>
            </div>
            <input
              aria-label="微风强度"
              type="range"
              min={0}
              max={1.0}
              step={0.02}
              value={wind.strength}
              onChange={(e) =>
                onChangeWind((w) => ({
                  ...w,
                  enabled: true,
                  strength: parseFloat(e.target.value),
                }))
              }
              className="w-full accent-teal-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-slate-300">
              <span>底部溪流 FlowMap 流速 (uFlowSpeed)</span>
              <span className="text-sky-300 tabular-nums">{waterConfig.flowSpeed.toFixed(2)}</span>
            </div>
            <input
              aria-label="溪流流速"
              type="range"
              min={0.08}
              max={0.65}
              step={0.02}
              value={waterConfig.flowSpeed}
              onChange={(e) => setWaterConfig((c) => ({ ...c, flowSpeed: parseFloat(e.target.value) }))}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-slate-300">
              <span>低频连续水纹柔光 (昼夜统一 uHighlightStrength)</span>
              <span className="text-sky-300 tabular-nums">{waterConfig.flowOnlyMode ? '已关高光 (仅验证流向)' : `${Math.round(waterConfig.highlightStrength * 100)}%`}</span>
            </div>
            <input
              aria-label="溪流高光强度"
              type="range"
              min={0.0}
              max={0.5}
              step={0.02}
              value={waterConfig.flowOnlyMode ? 0 : waterConfig.highlightStrength}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setWaterConfig((c) => ({
                  ...c,
                  flowOnlyMode: v <= 0.005,
                  highlightStrength: v,
                }))
              }}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-slate-300">
              <span>卡片与根系流光速度</span>
              <span className="text-teal-300 tabular-nums">{streamerSpeed.toFixed(1)}x</span>
            </div>
            <input
              aria-label="分支与根系流光速度"
              type="range"
              min={0.2}
              max={2.4}
              step={0.1}
              value={streamerSpeed}
              onChange={(e) => setStreamerSpeed(parseFloat(e.target.value))}
              className="w-full accent-teal-400 cursor-pointer"
            />
          </div>
          {isEffectsStudio && (
            <>
              <label className="space-y-1.5">
                <span className="flex justify-between text-slate-300">
                  <span>风向</span>
                  <span className="text-teal-300 tabular-nums">{wind.directionDeg}°</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={wind.directionDeg}
                  onChange={(e) => onChangeWind((value) => ({ ...value, directionDeg: Number(e.target.value) }))}
                  className="w-full accent-teal-400"
                />
              </label>
              <label className="space-y-1.5">
                <span className="flex justify-between text-slate-300">
                  <span>阵风强度</span>
                  <span className="text-teal-300 tabular-nums">{Math.round(wind.gustiness * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={wind.gustiness}
                  onChange={(e) => onChangeWind((value) => ({ ...value, gustiness: Number(e.target.value) }))}
                  className="w-full accent-teal-400"
                />
              </label>
              <label className="space-y-1.5">
                <span className="flex justify-between text-slate-300">
                  <span>天光与薄雾</span>
                  <span className="text-teal-300 tabular-nums">{Math.round(leftAmbientStrength * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={leftAmbientStrength}
                  onChange={(e) => setLeftAmbientStrength(Number(e.target.value))}
                  className="w-full accent-teal-400"
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-slate-300">季节色调</span>
                <select
                  value={seasonId}
                  onChange={(e) => {
                    const season = SEASON_THEMES.find(({ id }) => id === e.target.value)
                    if (season) onChangeSeason(season.id)
                  }}
                  className="w-full rounded border border-teal-800/60 bg-[#061116] px-2 py-1 text-slate-100"
                >
                  {SEASON_THEMES.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      )}

      {/* =====================================================================
          MODULE 03 (Primary Focus): 树卡实物阴影融合 + 方案一昼夜错峰过渡 + 独立近景花草摇曳 + WebGL 溪流
         ===================================================================== */}
      <section className={compactBannerMode ? '' : 'space-y-4'}>
        {!compactBannerMode && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#071419] border border-teal-800/60 rounded-xl p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <LuLayers className="w-4 h-4 text-teal-400" />
                  <h3 className="text-base font-display font-bold text-white">首屏 Hero 合成预览</h3>
                </div>
                <p className="text-xs text-slate-300">
                  {view === 'p0-inspector'
                    ? '切换局部前景，检查卡片上沿、右侧树干与根部的遮挡，再用昼夜对照核对轮廓。'
                    : '切换昼夜查看天光、树体与荧光的过渡，也可单独开关溪流、花草和分支流光。'}
                </p>
              </div>

              {/* Quick Scene Presets */}
              <div className="flex flex-wrap items-center gap-1.5 bg-[#040c0f] p-1.5 rounded-lg border border-teal-900/70">
                <button
                  onClick={() => {
                    setIsolatedCardElementId(null)
                    setShowCardFrame(true)
                    setShowCardOverhang(true)
                    setShowInnerBranchStream(true)
                    setShowRootNexusStream(true)
                    setShowBorderRimStream(true)
                    setShowCardInteractiveUi(true)
                    setShowWaterShader(true)
                    setShowForegroundFlowersAndGlow(true)
                    setShowLeftCopy(true)
                    setShowTopNav(true)
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    showCardFrame && showCardInteractiveUi && showLeftCopy && !isolatedCardElementId ? 'bg-[#2dd4bf] text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  完整首屏 (树卡 + 近景花草 + WebGL溪流)
                </button>

                <button
                  onClick={() => {
                    setIsolatedCardElementId(null)
                    setShowCardFrame(true)
                    setShowCardOverhang(true)
                    setShowInnerBranchStream(true)
                    setShowRootNexusStream(true)
                    setShowBorderRimStream(true)
                    setShowCardInteractiveUi(false)
                    setShowLeftCopy(false)
                    setShowTopNav(false)
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    showCardFrame && !showCardInteractiveUi && !showLeftCopy && !isolatedCardElementId ? 'bg-[#2dd4bf] text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  仅纯净空框 + 内部流光 + 近景溪流
                </button>

                <button
                  onClick={() => {
                    setIsolatedCardElementId(null)
                    setShowCardFrame(false)
                    setShowInnerBranchStream(false)
                    setShowRootNexusStream(false)
                    setShowBorderRimStream(false)
                    setShowCardInteractiveUi(false)
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    !showCardFrame && !showInnerBranchStream && !isolatedCardElementId ? 'bg-[#2dd4bf] text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  无卡片：纯世界树 + 近景花草溪流
                </button>
              </div>
            </div>

            {/* Granular Element Switches Bar (Including WebGL Stream Water & Foreground Flowers/Glow!) */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#061116] border border-teal-900/50 rounded-xl text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-slate-400 mr-1">分层元素独立开关：</span>

                <button
                  onClick={() => setShowWaterShader((v) => !v)}
                  className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showWaterShader ? 'bg-sky-500/25 text-sky-200 border-sky-400/60 shadow-[0_0_12px_rgba(56,189,248,0.2)]' : 'bg-[#040a0d] text-slate-400 border-teal-950'
                  }`}
                >
                  <LuWaves className="w-3.5 h-3.5 text-sky-300" />
                  <span>🌊 底部溪流 WebGL 连续水纹 v2.0</span>
                </button>

                {showWaterShader && (
                  <>
                    <button
                      onClick={() => setWaterConfig((c) => ({ ...c, reverseFlow: !c.reverseFlow }))}
                      className="px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer bg-emerald-500/20 text-emerald-200 border-emerald-400/50 hover:bg-emerald-500/30"
                      title="默认沿约 45° 河道斜向往下流（往屏幕方向），昼夜完全统一"
                    >
                      <span>{waterConfig.reverseFlow ? '⬆️ 流向：反向往上流 (对比测试)' : '↙️ 流向：斜 45° 往下流 / 往屏幕方向 (默认)'}</span>
                    </button>

                    <button
                      onClick={() => setWaterConfig((c) => ({ ...c, flowOnlyMode: !c.flowOnlyMode }))}
                      className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                        waterConfig.flowOnlyMode ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60' : 'bg-[#040a0d] text-slate-300 border-teal-900/60 hover:text-white'
                      }`}
                      title="关闭动态高光，仅验证 Flow Map 连续水流方向与原图石头细节"
                    >
                      <span>{waterConfig.flowOnlyMode ? '🔍 当前：仅验证流向 (已关高光)' : '✨ 当前：连续流纹 + 柔和微光'}</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => setShowForegroundFlowersAndGlow((v) => !v)}
                  className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showForegroundFlowersAndGlow ? 'bg-amber-500/20 text-amber-200 border-amber-400/50' : 'bg-[#040a0d] text-slate-400 border-teal-950'
                  }`}
                >
                  <LuSparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>🌼 近景花草摆动与发光</span>
                </button>

                <button
                  onClick={() => {
                    setIsolatedCardElementId(null)
                    setShowCardFrame((v) => !v)
                  }}
                  className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showCardFrame && !isolatedCardElementId ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50' : 'bg-[#040a0d] text-slate-400 border-teal-950'
                  }`}
                >
                  {showCardFrame ? <LuEye className="w-3.5 h-3.5 text-emerald-300" /> : <LuEyeOff className="w-3.5 h-3.5" />}
                  <span>APP 卡片空框与阴影</span>
                </button>

                <button
                  onClick={() => {
                    setIsolatedCardElementId(null)
                    setShowCardInteractiveUi((v) => !v)
                  }}
                  className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showCardInteractiveUi && showCardFrame && !isolatedCardElementId
                      ? 'bg-emerald-500/25 text-emerald-100 border-emerald-400/60'
                      : 'bg-[#040a0d] text-slate-400 border-teal-950'
                  }`}
                >
                  {showCardInteractiveUi ? <LuEye className="w-3.5 h-3.5 text-emerald-300" /> : <LuEyeOff className="w-3.5 h-3.5" />}
                  <span>面板高清 UI 与轻交互层</span>
                </button>

                {view === 'p0-inspector' && (
                  <button
                    onClick={() => {
                      setIsolatedCardElementId(null)
                      setShowCardOverhang((visible) => !visible)
                    }}
                    disabled={!showCardFrame}
                    aria-pressed={showCardOverhang && !isolatedCardElementId}
                    className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer disabled:opacity-50 ${
                      showCardOverhang && !isolatedCardElementId ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50' : 'bg-[#040a0d] text-slate-400 border-teal-950'
                    }`}
                  >
                    卡片前景遮挡
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsolatedCardElementId(null)
                    setShowInnerBranchStream((visible) => !visible)
                  }}
                  aria-pressed={showCardFrame && showInnerBranchStream && !isolatedCardElementId}
                  className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showCardFrame && showInnerBranchStream && !isolatedCardElementId
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                      : 'bg-[#040a0d] text-slate-400 border-teal-950'
                  }`}
                >
                  <LuSparkles className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Git 分支流光</span>
                </button>

                <button
                  onClick={() => {
                    setIsolatedCardElementId(null)
                    setShowRootNexusStream((v) => !v)
                  }}
                  className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showRootNexusStream && !isolatedCardElementId ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50' : 'bg-[#040a0d] text-slate-400 border-teal-950'
                  }`}
                >
                  <LuSparkles className="w-3.5 h-3.5 text-cyan-300" />
                  <span>根系汇流脉冲</span>
                </button>

                <button
                  onClick={() => setShowLeftCopy((v) => !v)}
                  className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showLeftCopy ? 'bg-teal-500/20 text-teal-200 border-teal-400/50' : 'bg-[#040a0d] text-slate-400 border-teal-950'
                  }`}
                >
                  {showLeftCopy ? <LuEye className="w-3.5 h-3.5 text-teal-300" /> : <LuEyeOff className="w-3.5 h-3.5" />}
                  <span>左侧文案</span>
                </button>
              </div>

              <button
                onClick={() => handleDownloadStagePng(cardStageCanvasRef.current, isDay ? 'yggit_hero_day_card_animated_frame.png' : 'yggit_hero_night_card_animated_frame.png')}
                disabled={isExportingComposite}
                className="px-3 py-1 rounded bg-[#08151a] hover:bg-teal-950 text-teal-200 border border-teal-800/60 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <LuDownload className="w-3 h-3" />
                <span>导出当前{isDay ? '白天' : '暗黑'}合成画面 PNG</span>
              </button>
            </div>
          </>
        )}

        {/* Main 16:9 Stage: 60 FPS Canvas + Smooth Companion UI + Text-Free Transparent Hotspots */}
        <div
          translate="no"
          className={
            fullScreenStage
              ? 'notranslate absolute inset-0 overflow-hidden select-none [container-type:size]'
              : 'notranslate relative w-full aspect-[16/9] min-h-[560px] rounded-2xl overflow-hidden border border-line bg-paper-2 shadow-2xl select-none [container-type:size]'
          }
        >
          {/* LAYER 0: Persistent 60 FPS Canvas */}
          <canvas ref={cardStageCanvasRef} width={1672} height={941} className="pointer-events-none absolute inset-0 w-full h-full object-cover block" />

          {/* Isolation Mode Banner */}
          {isolatedCardElementId && (
            <div className="absolute top-4 left-4 z-40 flex items-center gap-3 bg-[#051319]/90 border border-teal-400/50 px-4 py-2 rounded-xl text-xs">
              <span className="font-mono text-teal-300">
                当前正在透明棋盘格上单独检视拆解图层：
                <strong className="text-white ml-1">{CARD_DECOMPOSED_ELEMENTS.find((e) => e.id === isolatedCardElementId)?.name}</strong>
              </span>
              <button onClick={() => setIsolatedCardElementId(null)} className="px-2.5 py-1 rounded bg-teal-500 text-slate-950 font-semibold cursor-pointer">
                返回完整流光合成舞台
              </button>
            </div>
          )}

          {/* LAYER 1: Top Navigation Bar with 700ms Smooth Companion Transition */}
          {showTopNav && !hideTopNav && !isolatedCardElementId && (
            <div
              className={`absolute top-0 inset-x-0 z-30 flex items-center justify-between px-7 lg:px-11 py-3.5 transition-colors duration-700 ease-out ${
                isDay ? 'bg-gradient-to-b from-[#07223a]/55 via-[#07223a]/20 to-transparent' : 'bg-gradient-to-b from-[#020a0e]/80 via-[#020a0e]/35 to-transparent'
              }`}
            >
              <div className="flex items-center gap-10">
                <div className="flex items-center gap-2.5 text-lg font-display font-bold text-white whitespace-nowrap shrink-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/70 shadow-[0_0_12px_rgba(52,211,153,0.45)] flex items-center justify-center">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3C7.5 3 4 6.2 4 10.2C4 13.1 5.9 15.6 8.6 16.5C9.2 14.8 10.5 13.5 12 13.5C13.5 13.5 14.8 14.8 15.4 16.5C18.1 15.6 20 13.1 20 10.2C20 6.2 16.5 3 12 3Z"
                        fill="#34d399"
                        fillOpacity="0.88"
                      />
                      <circle cx="9" cy="8.5" r="1.3" fill="#fef08a" />
                      <circle cx="14.8" cy="8" r="1.2" fill="#a7f3d0" />
                      <circle cx="12" cy="6.2" r="1.1" fill="#ffffff" />
                      <path
                        d="M12 11V20M12 14L9.2 11.5M12 14.5L14.8 12M12 19.5C10.3 20.4 8.5 20.8 7 21M12 19.5C13.7 20.4 15.5 20.8 17 21"
                        stroke="#5eead4"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="tracking-tight">Yggit</span>
                </div>
                <div className="hidden md:flex items-center gap-7 text-xs lg:text-sm font-medium text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]">
                  <span className="hover:text-teal-200 transition-colors cursor-pointer">功能</span>
                  <span className="hover:text-teal-200 transition-colors cursor-pointer">场景</span>
                  <span className="hover:text-teal-200 transition-colors cursor-pointer">文档</span>
                  <span className="hover:text-teal-200 transition-colors cursor-pointer">更新</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {/* In-Hero Website Theme Switcher (Triggers Scheme 1 Staggered Day/Night Transition) */}
                <button
                  onClick={() => handleSwitchDayNight(isDay ? 'night' : 'day')}
                  title="点击体验方案一错峰昼夜平滑切换"
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all duration-500 cursor-pointer shadow-md ${
                    isDay
                      ? 'bg-white/90 hover:bg-white text-slate-900 border-amber-300/80 shadow-[0_2px_12px_rgba(253,224,71,0.35)]'
                      : 'bg-[#07161c]/90 hover:bg-[#0c242e] text-teal-200 border-teal-500/50 shadow-[0_0_14px_rgba(45,212,191,0.25)]'
                  }`}
                >
                  {isDay ? (
                    <>
                      <LuSun className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>☀️ 白天模式 · 切暗黑</span>
                    </>
                  ) : (
                    <>
                      <LuMoon className="w-3.5 h-3.5 text-teal-300 fill-teal-300" />
                      <span>🌙 暗黑模式 · 切白天</span>
                    </>
                  )}
                </button>

                <span className="text-xs font-mono text-slate-100 px-3 py-1.5 rounded-full bg-[#07161c]/85 border border-teal-700/60 flex items-center gap-1.5 shadow-md">
                  <LuStar className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>Star 3.4k</span>
                </span>
                <Link
                  href="/git"
                  onClick={triggerEnergySurge}
                  className="px-4 py-1.5 text-xs font-semibold rounded-full bg-gradient-to-r from-[#34d399] to-[#2dd4bf] text-slate-950 shadow-[0_0_18px_rgba(45,212,191,0.45)] whitespace-nowrap shrink-0 cursor-pointer no-underline"
                >
                  开始使用 →
                </Link>
              </div>
            </div>
          )}

          {/* LAYER 2: Left Headline, Subtitle, CTAs & Platform Strip with 700ms Smooth Companion Transition */}
          {showLeftCopy && !hideLeftCopy && !isolatedCardElementId && (
            <div className="absolute left-[4.4%] top-[18.5%] w-[33.5%] z-30 flex flex-col justify-center space-y-3.5 lg:space-y-4 transition-all duration-700 ease-out">
              <div>
                <span
                  className={`inline-block px-3.5 py-1 rounded-full text-[11px] lg:text-xs font-medium tracking-wide transition-all duration-700 ${
                    isDay
                      ? 'bg-[#082f3e]/80 border border-teal-300/50 text-teal-100 shadow-[0_2px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm'
                      : 'bg-[#06181f]/85 border border-teal-500/40 text-teal-200 shadow-[0_0_15px_rgba(20,184,166,0.18)]'
                  }`}
                >
                  Git 可视化 · 多仓库 · 合并追溯
                </span>
              </div>

              <h2
                className={`text-2xl sm:text-3xl lg:text-4xl xl:text-[44px] font-display font-bold tracking-tight leading-[1.16] text-white transition-all duration-700 ${
                  isDay ? 'drop-shadow-[0_3px_16px_rgba(5,32,56,0.75)]' : 'drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]'
                }`}
              >
                每一次提交，
                <span
                  className={`block mt-1 transition-all duration-700 ${
                    isDay ? 'text-[#6ee7b7] drop-shadow-[0_2px_14px_rgba(4,47,46,0.85)]' : 'text-[#34d399] drop-shadow-[0_0_22px_rgba(52,211,153,0.35)]'
                  }`}
                >
                  都有迹可循。
                </span>
              </h2>

              <p
                className={`text-xs lg:text-sm leading-relaxed max-w-md transition-all duration-700 ${
                  isDay ? 'text-white font-medium drop-shadow-[0_2px_10px_rgba(6,36,62,0.85)]' : 'text-slate-200/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]'
                }`}
              >
                从分支创建到合并提交，以世界树 DAG 原生拓扑看清代码演进脉络，双引擎原生驱动，毫秒级响应，让复杂的 Git 历史清晰可见。
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/git"
                  className="px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl bg-gradient-to-r from-[#34d399] to-[#2dd4bf] hover:from-[#5eead4] hover:to-[#34d399] text-slate-950 font-semibold text-xs lg:text-sm flex items-center gap-2 shadow-[0_0_24px_rgba(52,211,153,0.45)] transition-all whitespace-nowrap shrink-0 no-underline cursor-pointer"
                >
                  <span>打开本地项目</span>
                  <LuArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/git/github/DavidKk/yggit"
                  className="px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-[#071820]/85 hover:bg-[#0b2430] text-slate-100 border border-teal-400/45 text-xs lg:text-sm font-medium flex items-center gap-2 shadow-[0_0_16px_rgba(20,184,166,0.18)] transition-all whitespace-nowrap shrink-0 no-underline cursor-pointer"
                >
                  <LuPlay className="w-3.5 h-3.5 text-teal-300 fill-teal-300" />
                  <span>在线体验</span>
                </Link>
                <Link
                  href="/git"
                  className="px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-[#071820]/85 hover:bg-[#0b2430] text-slate-100 border border-teal-400/45 text-xs lg:text-sm font-medium flex items-center gap-2 shadow-[0_0_16px_rgba(20,184,166,0.18)] transition-all whitespace-nowrap shrink-0 no-underline cursor-pointer"
                >
                  <span>进入工作台 →</span>
                </Link>
              </div>

              <div
                className={`flex flex-wrap items-center gap-4 pt-2 text-[11px] lg:text-xs font-medium transition-all duration-700 ${
                  isDay ? 'text-white drop-shadow-[0_1px_8px_rgba(4,28,48,0.9)]' : 'text-slate-300/90'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-white shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                  </svg>
                  <span>GitHub</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-orange-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.65 14.39 12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94Z" />
                  </svg>
                  <span>GitLab</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-teal-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                    <rect x="4" y="4" width="16" height="6" rx="1.5" />
                    <rect x="4" y="14" width="16" height="6" rx="1.5" />
                    <circle cx="8" cy="7" r="1" fill="currentColor" />
                    <circle cx="8" cy="17" r="1" fill="currentColor" />
                  </svg>
                  <span>私有仓库</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-sky-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                  </svg>
                  <span>本地仓库</span>
                </span>
              </div>
            </div>
          )}

          {showCardFrame && showCardInteractiveUi && !isolatedCardElementId && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ width: 'max(100cqw, calc(100cqh * 1672 / 941))', aspectRatio: '1672 / 941', clipPath: showCardOverhang ? CARD_INTERACTION_CLIP : undefined }}
            >
              {CARD_INNER_ORBS.map((orb) => {
                const [bx, by, bw, bh] = orb.rowBox
                return (
                  <button
                    key={`row-hs-${orb.id}`}
                    aria-label={orb.title}
                    aria-pressed={selectedCommitIdx === orb.commitIdx}
                    style={{
                      left: `${(bx / 1672) * 100}%`,
                      top: `${(by / 941) * 100}%`,
                      width: `${(bw / 1672) * 100}%`,
                      height: `${(bh / 941) * 100}%`,
                    }}
                    onClick={() => {
                      setSelectedCommitIdx(orb.commitIdx)
                      triggerEnergySurge()
                    }}
                    onMouseEnter={() => setHoveredCommitIdx(orb.commitIdx)}
                    onMouseLeave={() => setHoveredCommitIdx(null)}
                    className="pointer-events-auto absolute rounded-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-300"
                  />
                )
              })}

              {showInnerBranchStream &&
                CARD_INNER_ORBS.map((orb) => (
                  <button
                    key={`orb-hs-${orb.id}`}
                    aria-label={`Branch node: ${orb.title}`}
                    aria-pressed={selectedCommitIdx === orb.commitIdx}
                    style={{
                      left: `${(orb.x / 1672) * 100}%`,
                      top: `${(orb.y / 941) * 100}%`,
                    }}
                    onClick={() => {
                      setSelectedCommitIdx(orb.commitIdx)
                      triggerEnergySurge()
                    }}
                    onMouseEnter={() => setHoveredCommitIdx(orb.commitIdx)}
                    onMouseLeave={() => setHoveredCommitIdx(null)}
                    className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-300"
                  />
                ))}

              {SIDEBAR_HOTSPOTS.map((sb) => {
                const [sx, sy, sw, sh] = sb.box
                return (
                  <button
                    key={sb.id}
                    aria-label={sb.label}
                    aria-pressed={activeSidebarId === sb.id}
                    style={{
                      left: `${(sx / 1672) * 100}%`,
                      top: `${(sy / 941) * 100}%`,
                      width: `${(sw / 1672) * 100}%`,
                      height: `${(sh / 941) * 100}%`,
                    }}
                    onClick={() => {
                      setActiveSidebarId(sb.id)
                      setSelectedCommitIdx(SIDEBAR_COMMITS[sb.id])
                      triggerEnergySurge()
                    }}
                    onMouseEnter={() => setHoveredSidebarId(sb.id)}
                    onMouseLeave={() => setHoveredSidebarId(null)}
                    className="pointer-events-auto absolute rounded-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-300"
                  />
                )
              })}

              {TOOLBAR_HOTSPOTS.map((tb) => {
                const [tx, ty, tw, th] = tb.box
                return (
                  <button
                    key={tb.id}
                    aria-label={tb.label}
                    aria-pressed={activeToolbarId === tb.id}
                    style={{
                      left: `${(tx / 1672) * 100}%`,
                      top: `${(ty / 941) * 100}%`,
                      width: `${(tw / 1672) * 100}%`,
                      height: `${(th / 941) * 100}%`,
                    }}
                    onClick={() => {
                      setActiveToolbarId((prev) => (prev === tb.id ? null : tb.id))
                      if (tb.id === 'tb-branch') {
                        setSelectedCommitIdx((prev) => (prev + 1) % CARD_INNER_ORBS.length)
                      }
                      triggerEnergySurge()
                    }}
                    onMouseEnter={() => setHoveredToolbarId(tb.id)}
                    onMouseLeave={() => setHoveredToolbarId(null)}
                    className="pointer-events-auto absolute rounded-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-300"
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Optional Second Live 16:9 Stage when Dual Day+Dark Compare is Active */}
        {!compactBannerMode && dualDayNightCompare && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-4 py-2 bg-[#061318] border border-teal-800/60 rounded-xl text-xs">
              <span className="font-semibold text-teal-200 flex items-center gap-2">
                <LuMoon className="w-3.5 h-3.5 text-teal-300" />
                <span>同屏对照舞台：{isDay ? '🌙 暗黑模式 (极光深林 + 统一近景岩石溪流)' : '☀️ 白天模式 (阳光溪谷 + 统一近景岩石溪流)'}</span>
              </span>
              <span className="font-mono text-slate-400">与上方舞台共享外缘树叶、近景花草和溪流动效</span>
            </div>

            <div
              translate="no"
              className="notranslate relative w-full aspect-[16/9] min-h-[520px] rounded-2xl overflow-hidden border border-teal-900/70 bg-[#03090d] shadow-2xl select-none"
            >
              <canvas ref={darkCompareCanvasRef} width={1672} height={941} className="pointer-events-none absolute inset-0 w-full h-full object-cover block" />
            </div>
          </div>
        )}

        {/* Decomposed APP Card, Separated Foreground & Root-Branch RGBA Asset Cards */}
        {!compactBannerMode && !isEffectsStudio && (
          <div className="bg-[#071318] border border-teal-900/60 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-display font-bold text-white">首屏图层检视</h4>
                <p className="text-xs text-slate-400">从后到前：世界树背景 → 卡片外壳 → Canvas UI → Git 分支流光 → 垂叶、树干与树根</p>
              </div>
              {isolatedCardElementId && (
                <button onClick={() => setIsolatedCardElementId(null)} className="text-xs font-mono text-teal-300 hover:underline cursor-pointer">
                  退出单层隔离模式 →
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3.5">
              {CARD_DECOMPOSED_ELEMENTS.map((el) => {
                const isIsolated = isolatedCardElementId === el.id
                const previewUrl = (!isDay && el.nightUrl) || el.url
                const previewBounds = el.id === CARD_BRANCHES_LAYER_ID ? CARD_BRANCH_BOUNDS : el.id === CARD_ROOTS_LAYER_ID ? CARD_ROOT_BOUNDS : CARD_UI_BOUNDS
                return (
                  <div
                    key={el.id}
                    className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition-all ${
                      isIsolated ? 'bg-teal-500/15 border-teal-400 shadow-lg' : 'bg-[#040c10] border-teal-950/90 hover:border-teal-800/70'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-display font-bold text-white truncate">{el.name}</span>
                      </div>

                      <div className="checkerboard-bg rounded-lg h-24 flex items-center justify-center overflow-hidden border border-teal-950">
                        {previewUrl ? (
                          <img src={`${previewUrl}${HERO_ASSET_VERSION}`} alt={el.name} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                        ) : (
                          <canvas
                            ref={(canvas) => {
                              const ctx = canvas?.getContext('2d')
                              if (!ctx) return
                              ctx.clearRect(0, 0, previewBounds.width, previewBounds.height)
                              ctx.save()
                              ctx.translate(-previewBounds.x, -previewBounds.y)
                              drawCardLayer(ctx, el.id, isDay ? 0 : 1)
                              ctx.restore()
                            }}
                            width={previewBounds.width}
                            height={previewBounds.height}
                            role="img"
                            aria-label={el.name}
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed">{el.desc}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-teal-950/80">
                      <button
                        onClick={() => setIsolatedCardElementId((prev) => (prev === el.id ? null : el.id))}
                        className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                          isIsolated ? 'bg-teal-400 text-slate-950 border-teal-300 font-semibold' : 'bg-[#081820] text-teal-200 border-teal-800/60 hover:bg-teal-950'
                        }`}
                      >
                        {isIsolated ? '返回合成' : '单独检视'}
                      </button>

                      {previewUrl ? (
                        <a
                          href={previewUrl}
                          download={previewUrl.split('/').pop()}
                          className="px-2 py-1 rounded bg-[#081820] hover:bg-teal-500/20 text-slate-200 border border-teal-800/60 text-[11px] font-mono flex items-center gap-1 transition-colors"
                        >
                          <LuDownload className="w-3 h-3 text-teal-300" />
                          <span>PNG</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDownloadCardLayer(el.id)}
                          className="px-2 py-1 rounded bg-[#081820] hover:bg-teal-500/20 text-slate-200 border border-teal-800/60 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <LuDownload className="w-3 h-3 text-teal-300" />
                          <span>PNG</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          MODULE 02: 首屏无卡片纯世界树昼夜动态背景舞台（含近景花草摇曳 + WebGL 溪流）
         ===================================================================== */}
      {!compactBannerMode && isOfficial && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="text-base font-display font-bold text-white">02. 首屏无卡片世界树动态背景</h3>
              <p className="text-xs text-slate-400">支持昼夜渐变、外缘树叶与近景花草微风和溪流动效</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSwitchDayNight(isDay ? 'night' : 'day')}
                className="px-3 py-1 rounded text-xs font-semibold bg-[#08151a] hover:bg-teal-950 text-amber-200 border border-teal-800/60 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isDay ? <LuMoon className="w-3.5 h-3.5 text-teal-300" /> : <LuSun className="w-3.5 h-3.5 text-amber-300" />}
                <span>错峰平滑切换至{isDay ? '🌙 暗黑模式' : '☀️ 白天模式'}</span>
              </button>

              <button
                onClick={() =>
                  handleDownloadStagePng(pureStageCanvasRef.current, isDay ? 'yggit_hero_day_animated_background_no_card.webp' : 'yggit_hero_night_animated_background_no_card.png')
                }
                disabled={isExportingComposite}
                className="px-3 py-1 rounded bg-[#08151a] hover:bg-teal-950 text-teal-200 border border-teal-800/60 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LuDownload className="w-3 h-3" />
                <span>导出无卡片{isDay ? '白天' : '暗黑'}背景帧 PNG</span>
              </button>
            </div>
          </div>

          <div className="relative w-full aspect-[16/9] min-h-[480px] rounded-2xl overflow-hidden border border-teal-900/60 bg-[#03090d] shadow-2xl select-none">
            <canvas ref={pureStageCanvasRef} width={1672} height={941} className="pointer-events-none absolute inset-0 w-full h-full object-cover block" />
          </div>
        </section>
      )}

      {/* =====================================================================
          MODULE 01: 远景背景 / 独立近景层 / 溪流 FlowMap 水流资产对照检视
         ===================================================================== */}
      {!compactBannerMode && isOfficial && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="text-base font-display font-bold text-white">01. 远景层 / 独立近景层 / 底部溪流 FlowMap 资产与静态母图检视</h3>
              <p className="text-xs text-slate-400">
                可分别检视分离后的「纯远景层」、「独立统一近景层 (含双岸岩石+溪流+右侧巨石白花)」、「独立透明世界树」以及「溪流 Flow Map 方向速度贴图」
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-[#08151a] p-1 rounded-lg border border-teal-900/60">
              <button
                onClick={() => setBgInspectMode('empty-card-master')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  bgInspectMode === 'empty-card-master' ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1. 历史树卡空框素材 ({isDay ? '白天' : '暗黑'})
              </button>
              <button
                onClick={() => setBgInspectMode('repaired-master')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  bgInspectMode === 'repaired-master' ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2. 无卡片世界树母图 ({isDay ? '白天' : '暗黑'})
              </button>
              <button
                onClick={() => setBgInspectMode('foreground-rgba')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  bgInspectMode === 'foreground-rgba' ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                3. 独立统一近景层 RGBA ({isDay ? '白天' : '暗黑'})
              </button>
              <button
                onClick={() => setBgInspectMode('distant-bg')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  bgInspectMode === 'distant-bg' ? 'bg-teal-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                4. 独立远景背景层 ({isDay ? '白天' : '暗黑'})
              </button>
              <button
                onClick={() => setBgInspectMode('tree-rgba')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  bgInspectMode === 'tree-rgba' ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                5. 独立世界树 RGBA
              </button>
              <button
                onClick={() => setBgInspectMode('water-flow-map')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  bgInspectMode === 'water-flow-map' ? 'bg-sky-500/25 text-sky-200 border border-sky-400/50 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                6. 溪流 Water Flow Map
              </button>
            </div>
          </div>

          <div
            className={`relative rounded-2xl overflow-hidden border border-teal-900/60 shadow-2xl ${
              bgInspectMode === 'tree-rgba' || bgInspectMode === 'foreground-rgba' || bgInspectMode === 'water-flow-map' ? 'checkerboard-bg' : 'bg-[#03090d]'
            }`}
          >
            <img
              src={
                bgInspectMode === 'repaired-master'
                  ? `${isDay ? DAY_PREVIEW_BG_PATH : NIGHT_PREVIEW_BG_PATH}${HERO_ASSET_VERSION}`
                  : bgInspectMode === 'empty-card-master'
                    ? `${isDay ? DAY_EMPTY_CARD_STAGE_PATH : NIGHT_EMPTY_CARD_STAGE_PATH}?v=fg_water_v6`
                    : bgInspectMode === 'foreground-rgba'
                      ? `${isDay ? DAY_FOREGROUND_RGBA_PATH : NIGHT_FOREGROUND_RGBA_PATH}?v=fg_water_v6`
                      : bgInspectMode === 'tree-rgba'
                        ? `${isDay ? DAY_TREE_RGBA_PATH : NIGHT_TREE_RGBA_PATH}?v=fg_water_v6`
                        : bgInspectMode === 'water-flow-map'
                          ? `${WATER_FLOW_MAP_PATH}?v=fg_water_v6`
                          : `${isDay ? DAY_DISTANT_BG_PATH : NIGHT_DISTANT_BG_PATH}?v=fg_water_v6`
              }
              alt="Yggit 官网首屏分层检视"
              referrerPolicy="no-referrer"
              className="w-full h-auto block select-none"
            />
          </div>

          {/* 4-Card Quick Inspector for Separated Foreground, Distant BG, Water Mask & Water Flow Map */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3">
            {[
              {
                title: '01 · 独立统一近景层 (双岸岩石+溪流+右巨石白花)',
                sub: isDay ? 'hero_day_foreground_rgba.webp' : 'hero_night_foreground_rgba.webp',
                img: `${isDay ? DAY_FOREGROUND_RGBA_PATH : NIGHT_FOREGROUND_RGBA_PATH}?v=fg_water_v6`,
                mode: 'foreground-rgba' as const,
                checker: true,
              },
              {
                title: '02 · 独立远景背景层 (天空+雪山+林谷)',
                sub: isDay ? 'hero_day_distant_bg_1672x941.webp' : 'hero_night_distant_bg_1672x941.webp',
                img: `${isDay ? DAY_DISTANT_BG_PATH : NIGHT_DISTANT_BG_PATH}?v=fg_water_v6`,
                mode: 'distant-bg' as const,
                checker: false,
              },
              {
                title: '03 · 溪流流向与速度贴图 (water-flow-map.webp)',
                sub: 'R=流向X, G=流向Y, B=局部流速, A=水域遮罩',
                img: `${WATER_FLOW_MAP_PATH}?v=fg_water_v6`,
                mode: 'water-flow-map' as const,
                checker: true,
              },
              {
                title: '04 · 独立雄伟繁茂世界树 RGBA',
                sub: isDay ? 'hero_day_tree_rgba.webp' : 'hero_night_tree_rgba.webp',
                img: `${isDay ? DAY_TREE_RGBA_PATH : NIGHT_TREE_RGBA_PATH}?v=fg_water_v6`,
                mode: 'tree-rgba' as const,
                checker: true,
              },
            ].map((item) => (
              <button
                key={item.title}
                onClick={() => setBgInspectMode(item.mode)}
                className="text-left rounded-xl border border-teal-900/60 hover:border-amber-300/70 bg-[#061116] p-3 space-y-2 transition-all cursor-pointer group"
              >
                <div className={`rounded-lg h-28 overflow-hidden border border-teal-950 ${item.checker ? 'checkerboard-bg' : 'bg-[#03090d]'}`}>
                  <img src={item.img} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                </div>
                <div>
                  <div className="text-xs font-display font-bold text-white group-hover:text-amber-200">{item.title}</div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">{item.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
