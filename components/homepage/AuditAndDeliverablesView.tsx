'use client'
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react'
import { LuCheck, LuDownload, LuExternalLink, LuFileCode, LuFileImage, LuFileText, LuTriangleAlert } from 'react-icons/lu'

import { HERO_ASSETS } from './data/heroAssets'
import { GIT_NODES, MASTER_CANVAS, TREE_LAYERS } from './data/worldTreeData'

const HERO_DELIVERABLE_GROUPS = [
  {
    name: '源图与场景底图',
    files: [
      { path: HERO_ASSETS.daySource, label: '白天源图' },
      { path: HERO_ASSETS.nightSource, label: '黑夜修复母版' },
      { path: HERO_ASSETS.dayBase, label: '白天底图 · 首页使用' },
      { path: HERO_ASSETS.nightBase, label: '黑夜底图 · 首页使用' },
    ],
  },
  {
    name: '卡片与遮挡',
    files: [
      { path: HERO_ASSETS.cardShell, label: '卡片玻璃外壳' },
      { path: HERO_ASSETS.dayOverhang, label: '白天局部前景' },
      { path: HERO_ASSETS.nightOverhang, label: '黑夜局部前景' },
    ],
  },
  {
    name: '溪流纹理',
    files: [
      { path: HERO_ASSETS.waterMask, label: '水域遮罩' },
      { path: HERO_ASSETS.waterFlow, label: '流向与流速贴图' },
      { path: HERO_ASSETS.waterNormal, label: '水纹法线 · 512 × 512' },
      { path: HERO_ASSETS.dayWaterBanks, label: '白天河岸遮罩' },
      { path: HERO_ASSETS.nightWaterBanks, label: '黑夜河岸遮罩' },
      { path: HERO_ASSETS.waterConfig, label: '溪流参数记录 · JSON' },
    ],
  },
]

interface DeliverableFile {
  path: string
  category: 'report' | 'json' | 'base' | 'canopy' | 'mask' | 'preview' | 'season'
  desc: string
  resolution: string
  format: string
}

const DELIVERABLE_FILES: DeliverableFile[] = [
  { path: '/world-tree-assets/audit.md', category: 'report', desc: 'Task 0 源图像素级审计与遮挡/烘焙光效边界报告', resolution: 'UTF-8 Markdown', format: 'MD' },
  {
    path: '/world-tree-assets/rebuild_report.md',
    category: 'report',
    desc: 'Task 5 重组验证量化报告 (MAE = 0.0432 px, PSNR = 66.07 dB)',
    resolution: 'UTF-8 Markdown',
    format: 'MD',
  },
  { path: '/world-tree-assets/README.md', category: 'report', desc: '资产包目录规范与使用说明', resolution: 'UTF-8 Markdown', format: 'MD' },
  { path: '/world-tree-assets/tree_meta.json', category: 'json', desc: '世界树分层坐标、锚点、绘制深度与风场权重元数据', resolution: 'Schema v1.0.0', format: 'JSON' },
  { path: '/world-tree-assets/nodes.json', category: 'json', desc: '16 个真实 Git 发光节点的母版坐标与脉冲配置', resolution: 'Schema v1.0.0', format: 'JSON' },
  {
    path: '/world-tree-assets/original/default_world_tree_original.webp',
    category: 'base',
    desc: '01 永恒·默认 原始未修补母版裁切图',
    resolution: '492 × 412',
    format: 'WebP',
  },
  { path: '/world-tree-assets/background/scene_clean.webp', category: 'base', desc: '移除世界树与左上角 UI 角标后的森林底图', resolution: '492 × 412', format: 'WebP' },
  {
    path: '/world-tree-assets/extracted/tree_full_rgba.webp',
    category: 'base',
    desc: 'Task 1 提取的完整世界树透明图层 (Un-premultiplied)',
    resolution: '492 × 412',
    format: 'WebP RGBA',
  },
  {
    path: '/world-tree-assets/base/base_trunk.webp',
    category: 'base',
    desc: 'Task 2 固定骨架层 (树干/主枝/根系，无浮动叶簇幽灵)',
    resolution: '492 × 412',
    format: 'WebP RGBA',
  },
  { path: '/world-tree-assets/branches/branch_flex_01.webp', category: 'base', desc: '左侧外延可微弯细枝图层', resolution: '492 × 412', format: 'WebP RGBA' },
  { path: '/world-tree-assets/branches/branch_flex_02.webp', category: 'base', desc: '左上分叉可微弯细枝图层', resolution: '492 × 412', format: 'WebP RGBA' },
  { path: '/world-tree-assets/branches/branch_flex_03.webp', category: 'base', desc: '右上分叉可微弯细枝图层', resolution: '492 × 412', format: 'WebP RGBA' },
  { path: '/world-tree-assets/branches/branch_flex_04.webp', category: 'base', desc: '右侧横展可微弯细枝图层', resolution: '492 × 412', format: 'WebP RGBA' },
  ...Array.from({ length: 12 }, (_, i) => {
    const num = String(i + 1).padStart(2, '0')
    return {
      path: `/world-tree-assets/canopy/cluster_${num}.png`,
      category: 'canopy' as const,
      desc: `Task 3 独立不规则 Alpha 叶簇 #${num} (${TREE_LAYERS.find((l) => l.id === `canopy-${num}`)?.name || ''})`,
      resolution: '492 × 412',
      format: 'WebP RGBA',
    }
  }),
  ...Array.from({ length: 12 }, (_, i) => {
    const num = String(i + 1).padStart(2, '0')
    return {
      path: `/world-tree-assets/masks/cluster_${num}_deform.png`,
      category: 'mask' as const,
      desc: `叶簇 #${num} 局部网格形变权重蒙版 (锚点=0, 叶尖=255)`,
      resolution: '492 × 412',
      format: 'WebP Lossless',
    }
  }),
  { path: '/world-tree-assets/masks/glow_mask.webp', category: 'mask', desc: 'Task 4 树干能量线与树冠发光灰度权重遮罩', resolution: '492 × 412', format: 'WebP Lossless' },
  { path: '/world-tree-assets/masks/glow_emission.webp', category: 'mask', desc: '动态发光色彩参考贴图 (供昼夜/季节着色)', resolution: '492 × 412', format: 'WebP RGBA' },
  { path: '/world-tree-assets/masks/node_mask.webp', category: 'mask', desc: 'Task 4 Git 发光节点像素级遮罩', resolution: '492 × 412', format: 'WebP Lossless' },
  {
    path: '/world-tree-assets/masks/inpainted_mask.webp',
    category: 'mask',
    desc: '左上角 UI 角标移除与下层遮挡补绘显式记录遮罩',
    resolution: '492 × 412',
    format: 'WebP Lossless',
  },
  {
    path: '/world-tree-assets/reference/baked_lighting.webp',
    category: 'preview',
    desc: '原图已烘焙环境光晕参考图 (不重复叠加)',
    resolution: '492 × 412',
    format: 'WebP RGBA',
  },
  { path: '/world-tree-assets/previews/preview_rebuild.webp', category: 'preview', desc: 'Task 5 全图层无损重组预览图', resolution: '492 × 412', format: 'WebP' },
  {
    path: '/world-tree-assets/previews/difference.webp',
    category: 'preview',
    desc: 'Task 5 重组图与原图逐像素差异热图 (8× 增益可视化)',
    resolution: '492 × 412',
    format: 'WebP',
  },
  { path: '/world-tree-assets/previews/transparent_checkerboard.webp', category: 'preview', desc: '透明棋盘格背景边缘抗锯齿核查图', resolution: '492 × 412', format: 'WebP' },
  {
    path: '/world-tree-assets/previews/closeups/closeup_canopy_edge.webp',
    category: 'preview',
    desc: '2× 微距放大：树冠顶部叶缘与发光节点',
    resolution: '280 × 220',
    format: 'WebP',
  },
  {
    path: '/world-tree-assets/previews/closeups/closeup_trunk_veins.webp',
    category: 'preview',
    desc: '2× 微距放大：主干烘焙流光与分叉锚点',
    resolution: '280 × 240',
    format: 'WebP',
  },
  {
    path: '/world-tree-assets/previews/closeups/closeup_root_nodes.webp',
    category: 'preview',
    desc: '2× 微距放大：左侧根系流光与青色 Commit 节点',
    resolution: '320 × 220',
    format: 'WebP',
  },
  { path: '/world-tree-assets/seasons/spring_sakura_rgba.webp', category: 'season', desc: '02 春·樱花 同骨架对齐透明外观层', resolution: '492 × 412', format: 'WebP RGBA' },
  { path: '/world-tree-assets/seasons/summer_lush_rgba.webp', category: 'season', desc: '03 夏·繁盛 同骨架对齐透明外观层', resolution: '492 × 412', format: 'WebP RGBA' },
  { path: '/world-tree-assets/seasons/autumn_maple_rgba.webp', category: 'season', desc: '04 秋·红叶 同骨架对齐透明外观层', resolution: '492 × 412', format: 'WebP RGBA' },
  { path: '/world-tree-assets/seasons/winter_frost_rgba.webp', category: 'season', desc: '05 冬·霜雪 同骨架对齐透明外观层', resolution: '492 × 412', format: 'WebP RGBA' },
  {
    path: '/world-tree-assets/seasons/festival_lanterns_only.webp',
    category: 'season',
    desc: '06 节日·夜樱祭 独立暖光灯笼挂载层',
    resolution: '492 × 412',
    format: 'WebP RGBA',
  },
]

export const AuditAndDeliverablesView: React.FC = () => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'documents' | DeliverableFile['category']>('all')
  const [heroPreview, setHeroPreview] = useState<{ path: string; label: string }>({
    path: HERO_ASSETS.dayBase,
    label: '白天底图 · 首页使用',
  })
  const [previewAssetUrl, setPreviewAssetUrl] = useState<string>('/world-tree-assets/previews/preview_rebuild.webp')

  const filteredFiles =
    categoryFilter === 'all'
      ? DELIVERABLE_FILES
      : categoryFilter === 'documents'
        ? DELIVERABLE_FILES.filter((f) => f.category === 'report' || f.category === 'json')
        : DELIVERABLE_FILES.filter((f) => f.category === categoryFilter)

  return (
    <div className="space-y-8">
      <section className="space-y-5 rounded-xl border border-line bg-panel p-6">
        <div className="space-y-2 border-b border-line pb-4">
          <h2 className="text-lg font-display font-bold text-ink">当前首页 Hero 资产</h2>
          <p className="text-sm text-ink-soft">昼夜底图沿用原世界树构图，预览版对近景草地与溪流做了局部融合。卡片外壳与昼夜局部前景共用 1672 × 941 px 坐标。</p>
          <p className="text-sm text-ink-soft">
            英文面板、Git 分支与根系流光由 Canvas 绘制，可在 P0 检视并导出单层 PNG。叶尖与近景花草复用场景像素做网格形变，溪流使用下方纹理实时渲染。
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {HERO_DELIVERABLE_GROUPS.map((group) => (
              <div key={group.name} className="space-y-1">
                <h3 className="pb-1 text-sm font-semibold text-accent">{group.name}</h3>
                {group.files.map((file) => (
                  <div key={file.path} className="flex items-center gap-2 rounded-md bg-panel-2 px-3 py-1.5">
                    {file.path.endsWith('.png') ? (
                      <button
                        type="button"
                        aria-pressed={heroPreview.path === file.path}
                        onClick={() => setHeroPreview(file)}
                        className="min-w-0 flex-1 text-left text-sm text-ink-soft hover:text-accent aria-pressed:text-accent"
                      >
                        {file.label}
                      </button>
                    ) : (
                      <span className="flex-1 text-sm text-ink-soft">{file.label}</span>
                    )}
                    <a href={file.path} download aria-label={`下载${file.label}`} className="rounded p-1 text-accent hover:bg-teal-500/20">
                      <LuDownload className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <figure className="mt-1 space-y-3 self-start lg:sticky lg:top-24">
            <figcaption className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
              {heroPreview.label}
              <a href={heroPreview.path} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                原尺寸打开 <LuExternalLink className="h-3 w-3" />
              </a>
            </figcaption>
            <div className="checkerboard-bg flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-line">
              <img src={heroPreview.path} alt={heroPreview.label} className="h-full w-full object-contain" />
            </div>
            <div className="break-all text-xs font-mono text-ink-soft">{heroPreview.path.split('/').pop()}</div>
          </figure>
        </div>
      </section>

      <details className="space-y-8">
        <summary className="cursor-pointer text-sm font-medium text-ink-soft">历史源图审计与像素验收 · 492 × 412 px</summary>
        {/* Section 1: Source Image Audit Table (Task 0) */}
        <div className="bg-panel border border-line rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-display font-bold text-ink">01. 源图审计与母版唯一性核查 (audit.md)</h2>
              <p className="text-xs text-ink-soft mt-0.5">
                严格遵循 PRD V3 第 3 节输入优先级与顶部红线：采用「世界树主题六宫格」左上角 01 永恒·默认 为唯一母版，拒绝使用白底大型树替换母版。
              </p>
            </div>
            <a
              href="/world-tree-assets/audit.md"
              download="audit.md"
              className="px-3.5 py-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-accent border border-teal-500/30 text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <LuDownload className="w-3.5 h-3.5" />
              <span>下载 audit.md</span>
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-line text-ink-soft">
                  <th className="py-2.5 px-3 font-medium">输入源图文件</th>
                  <th className="py-2.5 px-3 font-medium">像素宽高</th>
                  <th className="py-2.5 px-3 font-medium">色彩通道</th>
                  <th className="py-2.5 px-3 font-medium">PRD V3 分级判定</th>
                  <th className="py-2.5 px-3 font-medium">遮挡、烘焙光效与结构审计结论</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-950/70">
                <tr className="bg-teal-500/5">
                  <td className="py-3 px-3 font-mono text-accent">ChatGPT_Image_Nov_16...33b467c5.png</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-ink">1536 × 1024 (单格 492 × 412)</td>
                  <td className="py-3 px-3 font-mono text-ink-soft">8-bit RGB</td>
                  <td className="py-3 px-3 text-emerald-300 font-medium">唯一确认母版 (01 永恒·默认)</td>
                  <td className="py-3 px-3 text-ink-soft">
                    左上角 [6, 6, 156, 44] 存在胶囊角标遮挡暗林背景（已无痕修补并记录于 inpainted_mask.webp）；树干流光已与树皮烘焙，保留底纹并导出 glow_mask.webp。
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-mono text-ink-soft">Glowing_Teal_World_Tree_6d2f1e18.webp</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-ink-soft">1122 × 1402</td>
                  <td className="py-3 px-3 font-mono text-ink-soft">8-bit RGBA</td>
                  <td className="py-3 px-3 text-amber-300 font-medium flex items-center gap-1.5">
                    <LuTriangleAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>禁用替代项 (白底独立树)</span>
                  </td>
                  <td className="py-3 px-3 text-ink-soft">
                    虽具透明通道与更高像素，但主干向左弯曲、根部为 3 颗青球且叶缘烘焙强烈白底环境光，与官网母版非同一棵树；严格遵照 PRD 禁止用于替代母版。
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-mono text-ink-soft">Yggit_____Git______f7021535.webp</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-ink-soft">1024 × 1536</td>
                  <td className="py-3 px-3 font-mono text-ink-soft">8-bit RGB</td>
                  <td className="py-3 px-3 text-ink-soft">官网默认布局参考</td>
                  <td className="py-3 px-3 text-ink-soft">
                    右上角世界树被倾斜 Git 图谱窗口大面积遮挡（PRD 3.1 第 4 级：不建议从整站截图强行补绘主树），用于核对官网实景挂载坐标。
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-mono text-ink-soft">Yggit_Sakura_Git...3332fa93.png</td>
                  <td className="py-3 px-3 font-mono tabular-nums text-ink-soft">1024 × 1536</td>
                  <td className="py-3 px-3 font-mono text-ink-soft">8-bit RGB</td>
                  <td className="py-3 px-3 text-ink-soft">官网樱花主题参考</td>
                  <td className="py-3 px-3 text-ink-soft">验证春季樱花主题下，顶部导航、绿色 CTA 按钮与功能卡片图标保持 Yggit 青绿色不变的设计准则。</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual Comparison of the 2 Tree Inputs + 3 Micro-Closeups */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 pt-2">
            <div className="bg-panel-2 border border-line rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-emerald-300 flex items-center justify-between">
                <span>采用母版：01 永恒·默认</span>
                <span className="font-mono text-[11px] text-ink-soft">492×412</span>
              </div>
              <img
                src="/world-tree-assets/original/default_world_tree_original.webp"
                alt="01 永恒·默认 母版"
                referrerPolicy="no-referrer"
                className="w-full h-36 object-contain rounded bg-paper-2"
              />
              <div className="text-[11px] text-ink-soft">六宫格左上角唯一确认母版，与四季/节日树形 100% 重合。</div>
            </div>

            <div className="bg-panel-2 border border-amber-800/40 rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-amber-300 flex items-center justify-between">
                <span>审计排除：白底独立树</span>
                <span className="font-mono text-[11px] text-ink-soft">1122×1402</span>
              </div>
              <img src={MASTER_CANVAS.standaloneRefFile} alt="白底独立树参考" referrerPolicy="no-referrer" className="w-full h-36 object-contain rounded bg-white/95" />
              <div className="text-[11px] text-ink-soft">PRD 明确禁止用来替代母版（树干朝向与分枝结构不同）。</div>
            </div>

            <div className="bg-panel-2 border border-line rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-accent flex items-center justify-between">
                <span>2× 局部放大：树冠叶缘</span>
                <span className="font-mono text-[11px] text-ink-soft">100% 检视</span>
              </div>
              <img
                src="/world-tree-assets/previews/closeups/closeup_canopy_edge.webp"
                alt="树冠叶缘放大"
                referrerPolicy="no-referrer"
                className="w-full h-36 object-cover rounded"
              />
              <div className="text-[11px] text-ink-soft">无黑边、白边或方形硬切接缝，保留柔和半透明抗锯齿。</div>
            </div>

            <div className="bg-panel-2 border border-line rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-accent flex items-center justify-between">
                <span>2× 局部放大：主干流光</span>
                <span className="font-mono text-[11px] text-ink-soft">烘焙纹理</span>
              </div>
              <img
                src="/world-tree-assets/previews/closeups/closeup_trunk_veins.webp"
                alt="主干流光放大"
                referrerPolicy="no-referrer"
                className="w-full h-36 object-cover rounded"
              />
              <div className="text-[11px] text-ink-soft">保留原图烘焙进树皮的能量纹，配合 glow_mask 控制动态呼吸。</div>
            </div>

            <div className="bg-panel-2 border border-line rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-accent flex items-center justify-between">
                <span>2× 局部放大：根系节点</span>
                <span className="font-mono text-[11px] text-ink-soft">Git 锚点</span>
              </div>
              <img
                src="/world-tree-assets/previews/closeups/closeup_root_nodes.webp"
                alt="根系节点放大"
                referrerPolicy="no-referrer"
                className="w-full h-36 object-cover rounded"
              />
              <div className="text-[11px] text-ink-soft">精确对应 nodes.json 中 (80, 338) 与 (115, 353) 根节点。</div>
            </div>
          </div>
        </div>

        {/* Section 2: Complete Deliverable Files Browser (`world-tree-assets/`) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-panel border border-line rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-3">
              <div>
                <h3 className="text-base font-display font-bold text-ink">02. P0 标准资产交付目录 (world-tree-assets/ 共 {DELIVERABLE_FILES.length} 个实盘文件)</h3>
                <p className="text-xs text-ink-soft mt-0.5">点击任意 PNG 图层或遮罩可在右侧透明棋盘格预览窗实时检视，点击下载按钮可直接获取文件。</p>
              </div>

              <div className="flex flex-wrap items-center gap-1 bg-paper-2 p-1 rounded-lg border border-line">
                {[
                  { id: 'all', label: `全部 (${DELIVERABLE_FILES.length})` },
                  { id: 'documents', label: '报告 & JSON' },
                  { id: 'base', label: '骨架 & 细枝' },
                  { id: 'canopy', label: '12 叶簇' },
                  { id: 'mask', label: '形变 & 发光遮罩' },
                  { id: 'preview', label: '重组 & 差异图' },
                  { id: 'season', label: '四季对齐层' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setCategoryFilter(tab.id as typeof categoryFilter)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      categoryFilter === tab.id ? 'bg-teal-500/20 text-accent border border-teal-500/40' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto divide-y divide-teal-950/60 pr-1">
              {filteredFiles.map((f) => {
                const isImage = f.path.endsWith('.png')
                const isSelected = previewAssetUrl === f.path
                return (
                  <div
                    key={f.path}
                    onClick={() => {
                      if (isImage) setPreviewAssetUrl(f.path)
                    }}
                    className={`py-2.5 px-3 flex items-center justify-between gap-4 rounded-lg transition-colors ${isImage ? 'cursor-pointer' : ''} ${
                      isSelected ? 'bg-teal-500/15 border border-teal-500/30' : 'hover:bg-hover'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {f.format === 'MD' ? (
                        <LuFileText className="w-4 h-4 text-teal-400 shrink-0" />
                      ) : f.format === 'JSON' ? (
                        <LuFileCode className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <LuFileImage className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-ink truncate">{f.path.replace('/world-tree-assets/', '')}</div>
                        <div className="text-[11px] text-ink-soft truncate">{f.desc}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[11px] text-ink-soft tabular-nums hidden sm:inline">
                        {f.resolution} · {f.format}
                      </span>
                      <a
                        href={f.path}
                        download={f.path.split('/').pop()}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded bg-panel-2 hover:bg-teal-500/20 text-accent border border-line transition-colors"
                        title="下载该资产文件"
                      >
                        <LuDownload className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Live File Preview & Go/No-Go Checklist */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-panel border border-line rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-display font-semibold text-ink">资产单文件透明通道预览</h4>
                <a href={previewAssetUrl} target="_blank" rel="noreferrer" className="text-xs font-mono text-accent hover:underline flex items-center gap-1">
                  <span>原尺寸打开</span>
                  <LuExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="checkerboard-bg rounded-lg border border-line p-2 flex items-center justify-center min-h-[240px]">
                <img src={previewAssetUrl} alt="当前选中图层预览" referrerPolicy="no-referrer" className="max-h-[240px] w-auto object-contain" />
              </div>
              <div className="font-mono text-[11px] text-accent truncate">{previewAssetUrl}</div>
            </div>

            <div className="bg-panel border border-line rounded-xl p-5 space-y-3">
              <h4 className="text-sm font-display font-semibold text-ink">PRD 第 9.1 节 Go/No-Go 验收核对单</h4>
              <div className="space-y-2 text-xs text-ink-soft">
                {[
                  '使用左上角「01 永恒·默认」母版，未替换成白底新树',
                  '原始树形、主枝、树干、根系结构与位置 100% 一致',
                  '所有主要图层均为 32-bit RGBA，画布统一 492×412',
                  '12 个独立不规则叶簇 + 4 根细枝，均具锚点与深度',
                  '重组预览无空洞、重影、接缝或光晕翻倍 (MAE=0.043px)',
                  '细枝、叶缘在深色/浅色/棋盘背景下无明显抠图毛边',
                  'tree_meta.json 与 nodes.json 结构合规，引用全部存在',
                  '显式标注角标修补与底层树皮补全区域 (inpainted_mask)',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <LuCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Git Nodes Coordinate Table (`nodes.json`) */}
        <div className="bg-panel border border-line rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-3">
            <div>
              <h3 className="text-base font-display font-bold text-ink">03. Git 发光节点母版坐标清单 (nodes.json — 共 16 个逻辑节点)</h3>
              <p className="text-xs text-ink-soft mt-0.5">所有节点坐标均在母版像素坐标系 (492 × 412) 与归一化坐标 (u, v) 下双重记录，动态光晕与脉冲由前端渲染层驱动。</p>
            </div>
            <a
              href="/world-tree-assets/nodes.json"
              download="nodes.json"
              className="px-3.5 py-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-accent border border-teal-500/30 text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <LuDownload className="w-3.5 h-3.5" />
              <span>下载 nodes.json</span>
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {GIT_NODES.map((nd) => (
              <div key={nd.id} className="bg-panel-2 border border-line rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-accent">{nd.id}</span>
                  <span className="font-mono text-[11px] text-ink-soft uppercase">{nd.gitRole}</span>
                </div>
                <div className="text-xs text-ink font-medium">{nd.label}</div>
                <div className="text-[11px] font-mono text-ink-soft tabular-nums">
                  px: ({nd.center[0]}, {nd.center[1]}) · r={nd.radius}px · {nd.branchRef}
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  )
}
