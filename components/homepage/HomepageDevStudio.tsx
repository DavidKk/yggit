'use client'

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Download, Layers, RotateCcw, Sliders, Sparkles, Sun, Wind } from 'lucide-react'
import React, { useState } from 'react'

import { AuditAndDeliverablesView } from './AuditAndDeliverablesView'
import { HERO_ASSETS } from './data/heroAssets'
import { GIT_NODES, GitNodeMeta, SEASON_THEMES, SeasonThemePack, TIME_OF_DAY_PRESETS, TimeOfDayPreset, TREE_LAYERS } from './data/worldTreeData'
import { CanvasBackdrop, InspectMode, LightingConfig, LivingTreeCanvas, WindConfig } from './LivingTreeCanvas'
import { YggitOfficialPreview } from './YggitOfficialPreview'

type ActiveWorkspace = 'p0-inspector' | 'p1-p4-studio' | 'official-site' | 'audit-docs'

const WORKSPACE_TITLES: Record<ActiveWorkspace, string> = {
  'official-site': 'Yggit 首页首屏 Hero',
  'p0-inspector': 'P0 拆图与重组验收',
  'p1-p4-studio': 'P1–P4 风场与光效工作台',
  'audit-docs': '源图审计与资产交付',
}

export function HomepageDevStudio() {
  const [workspace, setWorkspace] = useState<ActiveWorkspace>('official-site')
  const [showHistoricalPrototype, setShowHistoricalPrototype] = useState(false)

  // P0 Inspector State
  const [inspectMode, setInspectMode] = useState<InspectMode>('split-compare')
  const [backdrop, setBackdrop] = useState<CanvasBackdrop>('forest')
  const [selectedLayerId, setSelectedLayerId] = useState<string>('canopy-06')
  const [showDeformMaskOverlay, setShowDeformMaskOverlay] = useState<boolean>(false)
  const [showInpaintedOverlay, setShowInpaintedOverlay] = useState<boolean>(false)
  const [selectedNode, setSelectedNode] = useState<GitNodeMeta | null>(GIT_NODES[0])

  // P1-P4 Dynamic Studio State (Default to 'day' so the Daytime Mode scene is immediately shown!)
  const [seasonId, setSeasonId] = useState<SeasonThemePack['id']>('default')
  const [timePresetId, setTimePresetId] = useState<TimeOfDayPreset['id']>('day')

  const [wind, setWind] = useState<WindConfig>({
    enabled: true,
    directionDeg: 18,
    strength: 0.46,
    gustiness: 0.35,
    showMeshWireframe: false,
    showAnchors: true,
    showNodes: false,
    showBounds: false,
  })

  const [lighting, setLighting] = useState<LightingConfig>({
    ambientBrightness: 1.08,
    temperature: 0.18,
    glowIntensity: 0.92,
    nodeIntensity: 0.95,
    fogAmount: 0.12,
    particlesEnabled: true,
    weatherRainSnow: 'none',
  })

  const selectedLayer = TREE_LAYERS.find((l) => l.id === selectedLayerId) || TREE_LAYERS[7]
  const activeSeason = SEASON_THEMES.find((s) => s.id === seasonId) || SEASON_THEMES[0]

  const handleSelectTimePreset = (preset: TimeOfDayPreset) => {
    setTimePresetId(preset.id)
    setLighting((prev) => ({
      ...prev,
      ambientBrightness: preset.ambientBrightness,
      temperature: preset.temperature,
      glowIntensity: preset.glowIntensity,
      nodeIntensity: preset.nodeIntensity,
      fogAmount: preset.fogAmount,
    }))
  }

  const handleStaticReset = () => {
    setWind((prev) => ({
      ...prev,
      enabled: false,
      strength: 0,
      showMeshWireframe: false,
    }))
    setSeasonId('default')
    handleSelectTimePreset(TIME_OF_DAY_PRESETS[3])
  }

  return (
    <div translate="no" className="notranslate min-h-screen bg-[#060d10] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-3.5 border-b border-teal-900/60 bg-[#060d10]/90 backdrop-blur-md">
        {/* Zone 1: Single text element Brand wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault()
            setWorkspace('official-site')
          }}
          className="text-lg font-display font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Yggit Living Tree
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-400 overflow-x-auto">
          <button
            onClick={() => setWorkspace('official-site')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              workspace === 'official-site' ? 'text-teal-300 underline underline-offset-8 decoration-2 decoration-teal-400' : 'hover:text-slate-100'
            }`}
          >
            首屏 Hero 专项优化
          </button>
          <button
            onClick={() => {
              setWorkspace('p0-inspector')
              if (inspectMode === 'live-composite') setInspectMode('split-compare')
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              workspace === 'p0-inspector' ? 'text-teal-300 underline underline-offset-8 decoration-2 decoration-teal-400' : 'hover:text-slate-100'
            }`}
          >
            P0 拆图与重组验收
          </button>
          <button
            onClick={() => {
              setWorkspace('p1-p4-studio')
              setInspectMode('live-composite')
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              workspace === 'p1-p4-studio' ? 'text-teal-300 underline underline-offset-8 decoration-2 decoration-teal-400' : 'hover:text-slate-100'
            }`}
          >
            P1-P4 风场与光效工作台
          </button>
          <button
            onClick={() => setWorkspace('audit-docs')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              workspace === 'audit-docs' ? 'text-teal-300 underline underline-offset-8 decoration-2 decoration-teal-400' : 'hover:text-slate-100'
            }`}
          >
            源图审计与资产交付
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <a
            href={timePresetId === 'night' ? HERO_ASSETS.nightBase : HERO_ASSETS.dayBase}
            download
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-[#2dd4bf] hover:bg-[#5eead4] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            下载首屏静态背景图
          </a>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-teal-950/90 pb-4">
          <div className="space-y-1">
            <div className="text-xs text-teal-300/90 font-mono">当前首屏 · 1672 × 941 px</div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-white tracking-tight">{WORKSPACE_TITLES[workspace]}</h1>
          </div>
        </div>

        {workspace !== 'audit-docs' && (
          <YggitOfficialPreview
            key={workspace}
            view={workspace}
            seasonId={seasonId}
            onChangeSeason={setSeasonId}
            timePresetId={timePresetId}
            onSelectTimePreset={handleSelectTimePreset}
            wind={wind}
            onChangeWind={setWind}
            lighting={lighting}
          />
        )}

        {(workspace === 'p0-inspector' || workspace === 'p1-p4-studio') && (
          <details
            className="space-y-4"
            open={showHistoricalPrototype}
            onToggle={(event) => {
              if (event.currentTarget.isConnected) setShowHistoricalPrototype(event.currentTarget.open)
            }}
          >
            <summary className="cursor-pointer text-sm font-medium text-slate-300">历史原型 · 492 × 412 px</summary>
            {showHistoricalPrototype && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 7 Columns: Primary Interactive Living Tree Viewport */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Viewport Mode Switcher Bar (PRD 9.3 Minimum Demo: Original / Rebuild / Difference / Single Cluster / Split / Exploded) */}
                  <div className="bg-[#09161b] border border-teal-900/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1 bg-[#060f13] p-1 rounded-lg border border-teal-950">
                      {[
                        { id: 'split-compare', label: '分屏卷帘比对' },
                        { id: 'original', label: '原图母版' },
                        { id: 'rebuild', label: '重组静止图' },
                        { id: 'difference', label: '差异热图' },
                        { id: 'single-layer', label: '单叶簇隔离' },
                        { id: 'exploded', label: '叶簇径向展开' },
                        { id: 'live-composite', label: '动态风场合成' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setInspectMode(m.id as InspectMode)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            inspectMode === m.id ? 'bg-teal-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Backdrop Selector (Dark Forest / Dark Checkerboard / Light Checkerboard) */}
                    <div className="flex items-center gap-1 bg-[#060f13] p-1 rounded-lg border border-teal-950">
                      {[
                        { id: 'forest', label: '深林底图' },
                        { id: 'checker-dark', label: '暗棋盘格' },
                        { id: 'checker-light', label: '亮棋盘格' },
                        { id: 'solid-dark', label: '纯黑底' },
                      ].map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setBackdrop(b.id as CanvasBackdrop)}
                          className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            backdrop === b.id ? 'bg-teal-500/20 text-teal-200 border border-teal-500/40' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Main Canvas Stage */}
                  <div className="bg-[#09161b] border border-teal-900/60 rounded-xl p-4 space-y-3">
                    <LivingTreeCanvas
                      inspectMode={inspectMode}
                      backdrop={backdrop}
                      selectedLayerId={selectedLayerId}
                      showDeformMaskOverlay={showDeformMaskOverlay}
                      showInpaintedOverlay={showInpaintedOverlay}
                      seasonId={seasonId}
                      wind={wind}
                      lighting={lighting}
                      onSelectLayer={(id) => {
                        setSelectedLayerId(id)
                      }}
                      onSelectNode={(nd) => {
                        setSelectedNode(nd)
                      }}
                      selectedNodeId={selectedNode?.id}
                    />

                    {/* Bottom Overlay Toggles Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setWind((w) => ({ ...w, showAnchors: !w.showAnchors }))}
                          className={`px-2.5 py-1 rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            wind.showAnchors ? 'bg-amber-500/20 text-amber-200 border-amber-500/40' : 'bg-[#061014] text-slate-400 border-teal-900/50'
                          }`}
                        >
                          枝条连接锚点 (Anchor)
                        </button>
                        <button
                          onClick={() =>
                            setWind((w) => ({
                              ...w,
                              showMeshWireframe: !w.showMeshWireframe,
                            }))
                          }
                          className={`px-2.5 py-1 rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            wind.showMeshWireframe ? 'bg-teal-500/20 text-teal-200 border-teal-500/40' : 'bg-[#061014] text-slate-400 border-teal-900/50'
                          }`}
                        >
                          局部变形网格 (Mesh)
                        </button>
                        <button
                          onClick={() => setWind((w) => ({ ...w, showBounds: !w.showBounds }))}
                          className={`px-2.5 py-1 rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            wind.showBounds ? 'bg-teal-500/20 text-teal-200 border-teal-500/40' : 'bg-[#061014] text-slate-400 border-teal-900/50'
                          }`}
                        >
                          叶簇包围盒 (Bounds)
                        </button>
                        <button
                          onClick={() => setWind((w) => ({ ...w, showNodes: !w.showNodes }))}
                          className={`px-2.5 py-1 rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            wind.showNodes ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' : 'bg-[#061014] text-slate-400 border-teal-900/50'
                          }`}
                        >
                          16 个 Git 发光节点
                        </button>
                        <button
                          onClick={() => setShowInpaintedOverlay((v) => !v)}
                          className={`px-2.5 py-1 rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            showInpaintedOverlay ? 'bg-rose-500/20 text-rose-200 border-rose-500/40' : 'bg-[#061014] text-slate-400 border-teal-900/50'
                          }`}
                        >
                          推断/补绘区域遮罩 (Inpainted)
                        </button>
                      </div>

                      <button
                        onClick={handleStaticReset}
                        className="px-2.5 py-1 rounded bg-[#061014] hover:bg-teal-950 text-slate-300 border border-teal-900/50 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        title="一键关闭风效与季节覆盖，恢复 P0 默认静止重组态"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-teal-400" />
                        <span>恢复静止母版</span>
                      </button>
                    </div>
                  </div>

                  {/* 6-Panel Master Same-Tree Skeleton Alignment Strip */}
                  <div className="bg-[#09161b] border border-teal-900/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-white">同一棵树 · 四季与节日母版对齐切换 (点击切换外观层，树干/枝条/根系/锚点坐标保持 100% 锁定)</div>
                      <span className="text-[11px] font-mono text-teal-300">
                        当前主题：{activeSeason.code} {activeSeason.name}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                      {SEASON_THEMES.map((s) => {
                        const isSelected = seasonId === s.id
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSeasonId(s.id)
                              if (inspectMode !== 'live-composite' && inspectMode !== 'split-compare') {
                                setInspectMode('live-composite')
                              }
                            }}
                            className={`group text-left rounded-lg p-1.5 border transition-all cursor-pointer ${
                              isSelected ? 'bg-teal-500/15 border-teal-400 shadow-sm' : 'bg-[#061014] border-teal-950 hover:border-teal-800'
                            }`}
                          >
                            <img src={s.panelRefImage} alt={s.name} referrerPolicy="no-referrer" className="w-full h-16 object-cover rounded" />
                            <div className="mt-1.5 flex items-center justify-between text-[11px]">
                              <span className="font-medium text-slate-200 truncate">
                                {s.code} {s.name}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Right 5 Columns: Contextual Inspector & P1-P4 Controls */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Sub-mode Switcher between P0 Layer Inspector and P1-P4 Environment Controls */}
                  <div className="grid grid-cols-2 gap-1.5 bg-[#09161b] p-1.5 rounded-xl border border-teal-900/60">
                    <button
                      onClick={() => setWorkspace('p0-inspector')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        workspace === 'p0-inspector' ? 'bg-teal-500 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>P0 图层与形变蒙版检视</span>
                    </button>
                    <button
                      onClick={() => {
                        setWorkspace('p1-p4-studio')
                        setInspectMode('live-composite')
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        workspace === 'p1-p4-studio' ? 'bg-teal-500 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>P1-P4 风场/昼夜/季节控制台</span>
                    </button>
                  </div>

                  {workspace === 'p0-inspector' ? (
                    /* P0 LAYER & DEFORM MASK INSPECTOR */
                    <div className="space-y-5">
                      {/* Selected Layer Detailed Card */}
                      <div className="bg-[#09161b] border border-teal-900/60 rounded-xl p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3 border-b border-teal-900/50 pb-3">
                          <div>
                            <div className="text-xs font-mono text-teal-300">当前选中图层 · ID: {selectedLayer.id}</div>
                            <h3 className="text-base font-display font-bold text-white mt-0.5">{selectedLayer.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setInspectMode(inspectMode === 'single-layer' ? 'live-composite' : 'single-layer')}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                inspectMode === 'single-layer'
                                  ? 'bg-teal-500 text-slate-950 font-semibold border-teal-400'
                                  : 'bg-[#061014] text-teal-200 border-teal-800/60 hover:bg-teal-950'
                              }`}
                            >
                              {inspectMode === 'single-layer' ? '返回全树合成' : '单独隔离显示'}
                            </button>
                            <a
                              href={selectedLayer.file}
                              download={selectedLayer.file.split('/').pop()}
                              className="p-1.5 rounded-lg bg-[#061014] hover:bg-teal-500/20 text-teal-300 border border-teal-800/60 transition-colors"
                              title="下载该透明 PNG 图层"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </div>

                        {/* Layer Metadata Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono tabular-nums">
                          <div className="bg-[#061014] border border-teal-950 rounded-lg p-2.5">
                            <div className="text-[11px] text-slate-400">绘制深度 (depth)</div>
                            <div className="text-sm font-semibold text-white mt-0.5">z = {selectedLayer.depth}</div>
                          </div>
                          <div className="bg-[#061014] border border-teal-950 rounded-lg p-2.5">
                            <div className="text-[11px] text-slate-400">包围盒 (bounds)</div>
                            <div className="text-xs font-semibold text-teal-200 mt-0.5">[{selectedLayer.bounds.join(', ')}]</div>
                          </div>
                          <div className="bg-[#061014] border border-teal-950 rounded-lg p-2.5">
                            <div className="text-[11px] text-slate-400">固定锚点 (anchor)</div>
                            <div className="text-sm font-semibold text-amber-300 mt-0.5">
                              {selectedLayer.anchor
                                ? `(${selectedLayer.anchor[0]}, ${selectedLayer.anchor[1]})`
                                : selectedLayer.rootAnchor
                                  ? `(${selectedLayer.rootAnchor[0]}, ${selectedLayer.rootAnchor[1]})`
                                  : 'Static [0, 0]'}
                            </div>
                          </div>
                          <div className="bg-[#061014] border border-teal-950 rounded-lg p-2.5">
                            <div className="text-[11px] text-slate-400">风场权重 (windWeight)</div>
                            <div className="text-sm font-semibold text-white mt-0.5">{selectedLayer.windWeight ?? 0}</div>
                          </div>
                          <div className="bg-[#061014] border border-teal-950 rounded-lg p-2.5">
                            <div className="text-[11px] text-slate-400">枝叶刚度 (stiffness)</div>
                            <div className="text-sm font-semibold text-white mt-0.5">{selectedLayer.stiffness ?? 1.0}</div>
                          </div>
                          <div className="bg-[#061014] border border-teal-950 rounded-lg p-2.5">
                            <div className="text-[11px] text-slate-400">相位延迟 / 最大位移</div>
                            <div className="text-sm font-semibold text-emerald-300 mt-0.5">
                              {selectedLayer.phaseOffset ?? 0} rad · {selectedLayer.maxDisplacementPx ?? 0}px
                            </div>
                          </div>
                        </div>

                        {/* Side-by-side PNG Thumbnail + Deform Weight Mask Thumbnail */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#061014] border border-teal-950 rounded-lg p-2.5 space-y-1.5">
                            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                              <span>透明 RGBA 图层</span>
                              <span>492×412</span>
                            </div>
                            <div className="checkerboard-bg rounded h-28 flex items-center justify-center overflow-hidden">
                              <img src={selectedLayer.file} alt={selectedLayer.name} referrerPolicy="no-referrer" className="max-h-28 w-auto object-contain" />
                            </div>
                          </div>

                          <div className="bg-[#061014] border border-teal-950 rounded-lg p-2.5 space-y-1.5">
                            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                              <span>形变权重蒙版 (deformMask)</span>
                              {selectedLayer.deformMask && (
                                <button
                                  onClick={() => {
                                    setInspectMode('single-layer')
                                    setShowDeformMaskOverlay((v) => !v)
                                  }}
                                  className="text-teal-300 hover:underline cursor-pointer"
                                >
                                  {showDeformMaskOverlay ? '隐藏叠加' : '叠加检视'}
                                </button>
                              )}
                            </div>
                            <div className="bg-[#040a0d] rounded h-28 flex items-center justify-center overflow-hidden">
                              {selectedLayer.deformMask ? (
                                <img src={selectedLayer.deformMask} alt="形变权重图" referrerPolicy="no-referrer" className="max-h-28 w-auto object-contain" />
                              ) : (
                                <span className="text-[11px] text-slate-500 px-3 text-center">静态骨架层位移权重恒为 0 (不随风晃动)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Layer Stack List (18 Layers + 3 Global Masks) */}
                      <div className="bg-[#09161b] border border-teal-900/60 rounded-xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-display font-bold text-white">分层资产树 (点击图层切换检视，双击进入单层隔离)</h4>
                          <span className="text-xs font-mono text-slate-400">共 {TREE_LAYERS.length} 层 + 3 遮罩</span>
                        </div>

                        {/* Global Masks Quick Buttons */}
                        <div className="grid grid-cols-3 gap-2 pb-1">
                          {[
                            { id: 'glow-mask', label: '能量发光遮罩 (glow_mask)' },
                            { id: 'node-mask', label: 'Git 节点遮罩 (node_mask)' },
                            { id: 'inpainted-mask', label: '补绘记录 (inpainted)' },
                          ].map((m) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                setSelectedLayerId(m.id)
                                setInspectMode('single-layer')
                              }}
                              className={`px-2 py-1.5 rounded text-[11px] font-mono border text-center transition-colors cursor-pointer truncate ${
                                selectedLayerId === m.id && inspectMode === 'single-layer'
                                  ? 'bg-teal-500/20 text-teal-200 border-teal-400'
                                  : 'bg-[#061014] text-slate-300 border-teal-950 hover:border-teal-800'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>

                        <div className="max-h-[290px] overflow-y-auto space-y-1 pr-1">
                          {TREE_LAYERS.slice()
                            .reverse()
                            .map((layer) => {
                              const isSel = selectedLayerId === layer.id
                              return (
                                <button
                                  key={layer.id}
                                  onClick={() => setSelectedLayerId(layer.id)}
                                  onDoubleClick={() => {
                                    setSelectedLayerId(layer.id)
                                    setInspectMode('single-layer')
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                                    isSel ? 'bg-teal-500/20 border border-teal-400/50 text-white' : 'bg-[#061014]/70 hover:bg-[#0c1e26] text-slate-300 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    <span className="font-mono text-[11px] text-teal-400 w-24 text-left shrink-0">{layer.id}</span>
                                    <span className="truncate font-medium">{layer.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                                    <span>z:{layer.depth}</span>
                                    {layer.windWeight !== undefined && <span className="text-emerald-300">w:{layer.windWeight.toFixed(2)}</span>}
                                  </div>
                                </button>
                              )
                            })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* P1-P4 WIND, DAY/NIGHT LIGHTING & SEASONAL STUDIO CONTROLS */
                    <div className="space-y-5">
                      {/* P1 Wind Field & Mesh Deformation Panel */}
                      <div className="bg-[#09161b] border border-teal-900/60 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-teal-900/50 pb-3">
                          <div className="flex items-center gap-2">
                            <Wind className="w-4 h-4 text-teal-400" />
                            <h3 className="text-sm font-display font-bold text-white">01. P1 局部网格风场驱动 (树干固定 · 叶簇错时摇曳)</h3>
                          </div>
                          <button
                            onClick={() => setWind((w) => ({ ...w, enabled: !w.enabled }))}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                              wind.enabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {wind.enabled ? '风场运行中' : '已静态降级 (0px)'}
                          </button>
                        </div>

                        <div className="space-y-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex justify-between font-mono">
                              <span className="text-slate-300">风力强度 (windStrength)</span>
                              <span className="text-teal-300 tabular-nums">{Math.round(wind.strength * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.02}
                              value={wind.strength}
                              onChange={(e) =>
                                setWind((w) => ({
                                  ...w,
                                  enabled: true,
                                  strength: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-teal-400 cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between font-mono">
                              <span className="text-slate-300">风向角度 (windDirection — 决定波浪传导方向)</span>
                              <span className="text-teal-300 tabular-nums">
                                {wind.directionDeg}° ({wind.directionDeg < 90 || wind.directionDeg > 270 ? '自左向右传导' : '自右向左传导'})
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={360}
                              step={5}
                              value={wind.directionDeg}
                              onChange={(e) =>
                                setWind((w) => ({
                                  ...w,
                                  directionDeg: parseInt(e.target.value, 10),
                                }))
                              }
                              className="w-full accent-teal-400 cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between font-mono">
                              <span className="text-slate-300">阵风湍流 (gustiness)</span>
                              <span className="text-teal-300 tabular-nums">{Math.round(wind.gustiness * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={wind.gustiness}
                              onChange={(e) =>
                                setWind((w) => ({
                                  ...w,
                                  gustiness: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-teal-400 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {/* P2 Unified Day/Night Material Lighting Panel */}
                      <div className="bg-[#09161b] border border-teal-900/60 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-teal-900/50 pb-3">
                          <div className="flex items-center gap-2">
                            <Sun className="w-4 h-4 text-amber-300" />
                            <h3 className="text-sm font-display font-bold text-white">02. P2 昼夜动态光照 (复用同一套树木材质，不画 4 张树)</h3>
                          </div>
                        </div>

                        {/* 4 Keyframe Time-of-Day Buttons */}
                        <div className="grid grid-cols-4 gap-1.5 bg-[#061014] p-1 rounded-lg border border-teal-950">
                          {TIME_OF_DAY_PRESETS.map((tp) => (
                            <button
                              key={tp.id}
                              onClick={() => handleSelectTimePreset(tp)}
                              className={`py-1.5 px-2 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                timePresetId === tp.id ? 'bg-teal-500/25 text-teal-200 border border-teal-400/50' : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {tp.name.split(' · ')[0]}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div className="space-y-1">
                            <div className="flex justify-between font-mono">
                              <span className="text-slate-300">环境亮度 (ambientBrightness)</span>
                              <span className="text-teal-300 tabular-nums">{lighting.ambientBrightness.toFixed(2)}</span>
                            </div>
                            <input
                              type="range"
                              min={0.45}
                              max={1.35}
                              step={0.02}
                              value={lighting.ambientBrightness}
                              onChange={(e) =>
                                setLighting((l) => ({
                                  ...l,
                                  ambientBrightness: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-teal-400 cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between font-mono">
                              <span className="text-slate-300">色温冷暖倾向 (temperature)</span>
                              <span className="text-teal-300 tabular-nums">
                                {lighting.temperature > 0 ? `+${lighting.temperature.toFixed(2)} 暖金` : `${lighting.temperature.toFixed(2)} 冷青`}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-0.6}
                              max={0.8}
                              step={0.04}
                              value={lighting.temperature}
                              onChange={(e) =>
                                setLighting((l) => ({
                                  ...l,
                                  temperature: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-teal-400 cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between font-mono">
                              <span className="text-slate-300">树干与根系流光强度 (glowIntensity)</span>
                              <span className="text-teal-300 tabular-nums">{Math.round(lighting.glowIntensity * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={1.6}
                              step={0.05}
                              value={lighting.glowIntensity}
                              onChange={(e) =>
                                setLighting((l) => ({
                                  ...l,
                                  glowIntensity: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-teal-400 cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between font-mono">
                              <span className="text-slate-300">Git 节点脉冲亮度 (nodeIntensity)</span>
                              <span className="text-teal-300 tabular-nums">{Math.round(lighting.nodeIntensity * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={1.6}
                              step={0.05}
                              value={lighting.nodeIntensity}
                              onChange={(e) =>
                                setLighting((l) => ({
                                  ...l,
                                  nodeIntensity: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-teal-400 cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between font-mono">
                              <span className="text-slate-300">林间雾气浓度 (fogAmount)</span>
                              <span className="text-teal-300 tabular-nums">{Math.round(lighting.fogAmount * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={0.85}
                              step={0.03}
                              value={lighting.fogAmount}
                              onChange={(e) =>
                                setLighting((l) => ({
                                  ...l,
                                  fogAmount: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-teal-400 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {/* P3-P4 Particles & Weather Modular Toggles */}
                      <div className="bg-[#09161b] border border-teal-900/60 rounded-xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-teal-400" />
                            <h3 className="text-sm font-display font-bold text-white">03. P3–P4 环境粒子、雨雪模块与主题调度优先级</h3>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <button
                            onClick={() =>
                              setLighting((l) => ({
                                ...l,
                                particlesEnabled: !l.particlesEnabled,
                              }))
                            }
                            className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                              lighting.particlesEnabled ? 'bg-teal-500/20 text-teal-200 border-teal-500/40' : 'bg-[#061014] text-slate-400 border-teal-950'
                            }`}
                          >
                            季节粒子 ({activeSeason.particleType})：{lighting.particlesEnabled ? '开启' : '关闭'}
                          </button>

                          {(['none', 'rain', 'snow'] as const).map((wMode) => (
                            <button
                              key={wMode}
                              onClick={() => setLighting((l) => ({ ...l, weatherRainSnow: wMode }))}
                              className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                lighting.weatherRainSnow === wMode ? 'bg-teal-500/20 text-teal-200 border-teal-500/40' : 'bg-[#061014] text-slate-400 border-teal-950'
                              }`}
                            >
                              {wMode === 'none' ? '天气：晴朗' : wMode === 'rain' ? '天气：细雨' : '天气：飘雪'}
                            </button>
                          ))}
                        </div>

                        <div className="text-[11px] font-mono text-slate-400 pt-1">
                          调度规则：{activeSeason.scheduleRule} · 优先级顺序：用户手动选择 &gt; 订阅节庆 &gt; 自动节日 &gt; 自动季节 &gt; 永恒默认
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </details>
        )}

        {/* WORKSPACE 4: SOURCE AUDIT & DELIVERABLE FILES */}
        {workspace === 'audit-docs' && <AuditAndDeliverablesView />}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-teal-950/80 py-5 px-6 text-xs text-slate-500 max-w-[1440px] w-full mx-auto flex flex-wrap items-center justify-between gap-4">
        <div>Yggit Living Tree · 492 × 412 px 历史原型报告</div>
        <div className="flex items-center gap-4 font-mono">
          <a href="/world-tree-assets/audit.md" download className="hover:text-teal-300 transition-colors">
            audit.md
          </a>
          <span>·</span>
          <a href="/world-tree-assets/rebuild_report.md" download className="hover:text-teal-300 transition-colors">
            rebuild_report.md
          </a>
          <span>·</span>
          <a href="/world-tree-assets/tree_meta.json" download className="hover:text-teal-300 transition-colors">
            tree_meta.json
          </a>
          <span>·</span>
          <a href="/world-tree-assets/nodes.json" download className="hover:text-teal-300 transition-colors">
            nodes.json
          </a>
        </div>
      </footer>
    </div>
  )
}
