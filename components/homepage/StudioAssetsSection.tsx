'use client'
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react'
import { LuDownload, LuEye, LuLayers } from 'react-icons/lu'

import { SettingsSectionCard } from '@/components/git/agent/settings/SettingsSectionCard'
import { Badge, Button } from '@/components/sk'

import { HERO_ASSETS } from './data/heroAssets'
import { TREE_LAYERS } from './data/worldTreeData'

export function StudioAssetsSection() {
  const [activeLayer, setActiveLayer] = useState<'repaired-master' | 'empty-card-master' | 'foreground-rgba' | 'distant-bg' | 'tree-rgba' | 'water-flow-map'>('foreground-rgba')
  const [isDay, setIsDay] = useState(true)

  const layersList = [
    {
      id: 'repaired-master' as const,
      name: '1. 修复后无水印母图',
      desc: '1672 × 941 高清完整母版 (含世界树、近景与背景融合层)',
      img: isDay ? HERO_ASSETS.dayBase : HERO_ASSETS.nightBase,
      isRgba: false,
    },
    {
      id: 'empty-card-master' as const,
      name: '2. 无卡片世界树母图',
      desc: '已剥离中央卡片，底层树皮与枝叶经数字无缝修复',
      img: isDay ? HERO_ASSETS.dayBase : HERO_ASSETS.nightBase,
      isRgba: false,
    },
    {
      id: 'foreground-rgba' as const,
      name: '3. 独立统一近景层 RGBA',
      desc: '双岸岩石、白花、巨石与溪流透明图层 (覆盖于卡片之前)',
      img: isDay ? HERO_ASSETS.dayOverhang : HERO_ASSETS.nightOverhang,
      isRgba: true,
    },
    {
      id: 'distant-bg' as const,
      name: '4. 独立远景背景层',
      desc: '天空、远山、晨曦/极光层，作为最底层静态或微动背景',
      img: isDay ? HERO_ASSETS.dayBase : HERO_ASSETS.nightBase,
      isRgba: false,
    },
    {
      id: 'tree-rgba' as const,
      name: '5. 独立世界树 RGBA',
      desc: '主干、繁茂树冠与 16 发光节点透明通道，供物理风场网格驱动',
      img: isDay ? HERO_ASSETS.daySource : HERO_ASSETS.nightSource,
      isRgba: true,
    },
    {
      id: 'water-flow-map' as const,
      name: '6. 溪流 Water Flow Map',
      desc: 'R=流向X, G=流向Y, B=局部流速, A=水域遮罩，驱动 WebGL 连续水纹',
      img: HERO_ASSETS.waterFlow,
      isRgba: true,
    },
  ]

  const currentLayer = layersList.find((l) => l.id === activeLayer) || layersList[2]

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 6-Layer Texture Inspector */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuLayers className="size-4 text-accent" />
            <span>官网首屏 6 核心独立图层检视</span>
          </div>
        }
        description="所有图层均为 1672 × 941 标准坐标对齐，严格分层隔离以支持 60 FPS 独立风场与着色器运算"
        titleAction={
          <div className="flex items-center gap-2">
            <Button size="sm" variant={isDay ? 'accent' : 'default'} onClick={() => setIsDay(true)} className="text-xs">
              ☀️ 白天母版
            </Button>
            <Button size="sm" variant={!isDay ? 'accent' : 'default'} onClick={() => setIsDay(false)} className="text-xs">
              🌙 暗黑母版
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Layer Selector Chips */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {layersList.map((layer) => {
              const isSelected = layer.id === activeLayer
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setActiveLayer(layer.id)}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-all cursor-pointer ${
                    isSelected ? 'border-accent bg-accent/10 font-bold text-accent shadow-xs' : 'border-line bg-panel hover:bg-hover text-ink-soft hover:text-ink'
                  }`}
                >
                  <span className="text-xs font-semibold">{layer.name}</span>
                  <span className="text-[10px] text-ink-muted line-clamp-1">{layer.desc}</span>
                </button>
              )
            })}
          </div>

          {/* Active Layer Viewport with Checkerboard */}
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">{currentLayer.name}</span>
                <Badge tone={currentLayer.isRgba ? 'ok' : 'neutral'}>{currentLayer.isRgba ? '32-bit RGBA 透明通道' : '24-bit RGB 底图'}</Badge>
              </div>
              <a href={currentLayer.img} download={currentLayer.img.split('/').pop()} className="flex items-center gap-1.5 font-medium text-accent hover:underline text-xs">
                <LuDownload className="size-3.5" />
                <span>下载当前分层 PNG</span>
              </a>
            </div>

            <div
              className={`flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-line/60 ${
                currentLayer.isRgba ? 'checkerboard-bg' : 'bg-[#03090d]'
              }`}
            >
              <img src={currentLayer.img} alt={currentLayer.name} className="h-full w-full object-contain select-none" />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted pt-1">
              <span>分辨率：1672 × 941 px · 标准 16:9 画布</span>
              <span>路径：{currentLayer.img}</span>
            </div>
          </div>
        </div>
      </SettingsSectionCard>

      {/* 2. Decomposed World Tree Sub-layers Table */}
      <SettingsSectionCard
        title={
          <div className="flex items-center gap-2">
            <LuEye className="size-4 text-accent" />
            <span>世界树独立叶簇与枝干图层清单 (TREE_LAYERS)</span>
          </div>
        }
        description="用于局部风场微摆模拟与深度排序的 12 个独立叶簇与 4 根细枝元数据"
      >
        <div className="overflow-x-auto rounded-lg border border-line/60">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b border-line bg-panel-2/60 text-[11px] font-semibold text-ink-soft">
              <tr>
                <th className="py-2.5 px-3">图层 ID</th>
                <th className="py-2.5 px-3">描述</th>
                <th className="py-2.5 px-3">母版中心 (px)</th>
                <th className="py-2.5 px-3">深度 (Z-Index)</th>
                <th className="py-2.5 px-3">摆动权重</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40 text-ink">
              {TREE_LAYERS.map((layer) => (
                <tr key={layer.id} className="hover:bg-hover/50 font-mono">
                  <td className="py-2 px-3 font-semibold text-accent">{layer.id}</td>
                  <td className="py-2 px-3 font-sans text-ink">{layer.name}</td>
                  <td className="py-2 px-3 text-ink-soft">{layer.anchor ? `(${layer.anchor[0]}, ${layer.anchor[1]})` : '-'}</td>
                  <td className="py-2 px-3 text-ink-soft">{layer.depth}</td>
                  <td className="py-2 px-3 text-ink-soft">{layer.windWeight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
