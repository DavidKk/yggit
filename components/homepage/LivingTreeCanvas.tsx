'use client'

import React, { useEffect, useRef, useState } from 'react'

import { GIT_NODES, GitNodeMeta, LayerMeta, MASTER_CANVAS, SEASON_THEMES, SeasonThemePack, TREE_LAYERS } from './data/worldTreeData'

export type InspectMode = 'live-composite' | 'original' | 'rebuild' | 'split-compare' | 'difference' | 'single-layer' | 'exploded'

export type CanvasBackdrop = 'forest' | 'checker-dark' | 'checker-light' | 'solid-dark'

export interface WindConfig {
  enabled: boolean
  directionDeg: number // 0 = left-to-right, 180 = right-to-left
  strength: number // 0..1
  gustiness: number // 0..1
  showMeshWireframe: boolean
  showAnchors: boolean
  showNodes: boolean
  showBounds: boolean
}

export interface LightingConfig {
  ambientBrightness: number // 0.4 .. 1.5
  temperature: number // -1 (cool) .. +1 (warm)
  glowIntensity: number // 0 .. 1.8
  nodeIntensity: number // 0 .. 1.8
  fogAmount: number // 0 .. 1
  particlesEnabled: boolean
  weatherRainSnow: 'none' | 'rain' | 'snow'
}

interface LivingTreeCanvasProps {
  inspectMode: InspectMode
  backdrop: CanvasBackdrop
  selectedLayerId: string
  showDeformMaskOverlay: boolean
  showInpaintedOverlay: boolean
  seasonId: SeasonThemePack['id']
  wind: WindConfig
  lighting: LightingConfig
  onSelectLayer?: (layerId: string) => void
  onSelectNode?: (node: GitNodeMeta | null) => void
  selectedNodeId?: string | null
  className?: string
  compactMode?: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  angle: number
  spin: number
  phase: number
}

export const LivingTreeCanvas: React.FC<LivingTreeCanvasProps> = ({
  inspectMode,
  backdrop,
  selectedLayerId,
  showDeformMaskOverlay,
  showInpaintedOverlay,
  seasonId,
  wind,
  lighting,
  onSelectLayer,
  onSelectNode,
  selectedNodeId,
  className = '',
  compactMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imagesRef = useRef<Record<string, HTMLImageElement>>({})
  const [loadedCount, setLoadedCount] = useState(0)
  const [splitPos, setSplitPos] = useState(0.5)
  const [isDraggingSplit, setIsDraggingSplit] = useState(false)
  const [explodeFactor, setExplodeFactor] = useState(0.55)
  const [hoveredNode, setHoveredNode] = useState<GitNodeMeta | null>(null)
  const particlesRef = useRef<Particle[]>([])

  const W = MASTER_CANVAS.width
  const H = MASTER_CANVAS.height

  // Preload all required PNG layers & masks
  useEffect(() => {
    const urlsToLoad = new Set<string>([
      '/world-tree-assets/original/default_world_tree_original.webp',
      '/world-tree-assets/background/scene_clean.webp',
      '/world-tree-assets/extracted/tree_full_rgba.webp',
      '/world-tree-assets/base/base_trunk.webp',
      '/world-tree-assets/masks/glow_mask.webp',
      '/world-tree-assets/masks/glow_emission.webp',
      '/world-tree-assets/masks/node_mask.webp',
      '/world-tree-assets/masks/inpainted_mask.webp',
      '/world-tree-assets/reference/baked_lighting.webp',
      '/world-tree-assets/previews/preview_rebuild.webp',
      '/world-tree-assets/previews/difference.webp',
      '/world-tree-assets/seasons/spring_sakura_rgba.webp',
      '/world-tree-assets/seasons/summer_lush_rgba.webp',
      '/world-tree-assets/seasons/autumn_maple_rgba.webp',
      '/world-tree-assets/seasons/winter_frost_rgba.webp',
      '/world-tree-assets/seasons/festival_night_sakura_rgba.webp',
      '/world-tree-assets/seasons/festival_lanterns_only.webp',
    ])

    for (const layer of TREE_LAYERS) {
      urlsToLoad.add(layer.file)
      if (layer.deformMask) urlsToLoad.add(layer.deformMask)
    }

    let cancelled = false
    for (const url of urlsToLoad) {
      if (imagesRef.current[url]) continue
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (!cancelled) {
          imagesRef.current[url] = img
          setLoadedCount((c) => c + 1)
        }
      }
      img.src = url
    }
    return () => {
      cancelled = true
    }
  }, [])

  // Initialize particles
  useEffect(() => {
    const pts: Particle[] = []
    for (let i = 0; i < 42; i++) {
      pts.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.85,
        vx: (Math.random() - 0.3) * 0.4,
        vy: 0.25 + Math.random() * 0.55,
        size: 2 + Math.random() * 3.5,
        alpha: 0.35 + Math.random() * 0.55,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.03,
        phase: Math.random() * Math.PI * 2,
      })
    }
    particlesRef.current = pts
  }, [W, H])

  // Main animation & rendering loop
  useEffect(() => {
    let rafId = 0
    const startTime = performance.now()

    const render = (now: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const t = (now - startTime) * 0.001
      const imgs = imagesRef.current
      const activeSeason = SEASON_THEMES.find((s) => s.id === seasonId) || SEASON_THEMES[0]

      ctx.clearRect(0, 0, W, H)

      // 1. Draw Backdrop
      if (backdrop === 'forest') {
        const bgImg = imgs['/world-tree-assets/background/scene_clean.webp']
        if (bgImg) {
          ctx.save()
          ctx.filter = `brightness(${lighting.ambientBrightness})`
          ctx.drawImage(bgImg, 0, 0, W, H)
          ctx.restore()
        } else {
          ctx.fillStyle = '#071418'
          ctx.fillRect(0, 0, W, H)
        }
      } else if (backdrop === 'solid-dark') {
        ctx.fillStyle = '#060d10'
        ctx.fillRect(0, 0, W, H)
      } else {
        // Checkerboard rendered by CSS class on canvas, keep transparent or subtle grid
      }

      // Helper to compute pinned-anchor wind displacement for a layer at time t
      const getLayerWindOffset = (layer: LayerMeta) => {
        if (!wind.enabled || wind.strength <= 0.001 || (layer.type !== 'deformable' && layer.type !== 'branch-flex')) {
          return { dx: 0, dy: 0, rotRad: 0 }
        }
        const rad = (wind.directionDeg * Math.PI) / 180
        const dirX = Math.cos(rad)
        const dirY = Math.sin(rad) * 0.35
        const anchor = layer.anchor || layer.rootAnchor || [W / 2, H / 2]
        // Spatial propagation delay across the canopy in wind direction
        const proj = (anchor[0] / W) * dirX + (anchor[1] / H) * dirY
        const phase = t * (1.8 + wind.strength * 1.6) - proj * 3.2 + (layer.phaseOffset || 0)
        const gust = 1 + wind.gustiness * 0.45 * Math.sin(t * 0.85 + (layer.phaseOffset || 0) * 1.7)
        const wave = Math.sin(phase) * 0.7 + Math.sin(phase * 2.1 + 0.6) * 0.3
        // Directional bias + oscillation
        const amp = (layer.maxDisplacementPx || 5) * (layer.windWeight || 0.5) * wind.strength * gust
        const dx = (dirX * 0.38 + dirX * wave * 0.62) * amp
        const dy = (dirY * 0.25 + Math.cos(phase * 1.3) * 0.35) * amp * 0.55
        const rotRad = (dx / 95) * (1 - (layer.stiffness || 0.65) * 0.65)
        return { dx, dy, rotRad }
      }

      // Helper to draw a deformable cluster using local mesh strips pinned at its branch anchor
      const drawDeformedCluster = (img: HTMLImageElement, layer: LayerMeta, extraExplode = 0) => {
        const [bx0, by0, bx1, by1] = layer.bounds
        const bw = Math.max(1, bx1 - bx0)
        const bh = Math.max(1, by1 - by0)
        const anchor = layer.anchor || layer.rootAnchor || [(bx0 + bx1) / 2, by1]

        const { dx, dy, rotRad } = getLayerWindOffset(layer)

        // If exploded mode is active, shift cluster radially outward from center (300, 140)
        let expX = 0
        let expY = 0
        if (extraExplode > 0) {
          const cx = (bx0 + bx1) / 2
          const cy = (by0 + by1) / 2
          const vx = cx - 300
          const vy = cy - 155
          expX = vx * extraExplode * 0.36
          expY = vy * extraExplode * 0.36
        }

        // Subdivide bounding box into 6 horizontal strips so strips near the anchor stay pinned
        // while outer strips bend smoothly (local Mesh Deformation without rigid card sliding!)
        const strips = 6
        const stripH = bh / strips

        ctx.save()
        for (let s = 0; s < strips; s++) {
          const sy = by0 + s * stripH
          const stripCenterY = sy + stripH * 0.5
          const stripCenterX = (bx0 + bx1) * 0.5
          const distToAnchor = Math.hypot(stripCenterX - anchor[0], stripCenterY - anchor[1])
          const maxSpan = Math.max(32, Math.hypot(bw, bh) * 0.78)
          // Smooth weight: 0 at anchor, 1 at outer leaf tips
          const rawW = Math.min(1, Math.max(0, (distToAnchor - 4) / maxSpan))
          const weight = rawW * rawW * (3 - 2 * rawW)

          const sDx = dx * weight + expX
          const sDy = dy * weight + expY
          const sRot = rotRad * weight

          ctx.save()
          ctx.translate(anchor[0] + sDx, anchor[1] + sDy)
          ctx.rotate(sRot)
          ctx.translate(-anchor[0], -anchor[1])

          // Clip to current horizontal strip (with 0.6px overlap to prevent subpixel hairline cracks)
          ctx.drawImage(img, bx0, Math.max(0, sy - 0.4), bw, stripH + 0.8, bx0, Math.max(0, sy - 0.4), bw, stripH + 0.8)
          ctx.restore()
        }
        ctx.restore()
      }

      // Helper to render the full assembled tree (used in 'live-composite', 'rebuild', 'exploded', and right half of 'split-compare')
      const drawRebuiltTree = (isExploded = false) => {
        ctx.save()
        // Apply day/night brightness & color temperature filter
        const tempSepia = lighting.temperature > 0 ? lighting.temperature * 0.24 : 0
        const tempHue = lighting.temperature < 0 ? lighting.temperature * 14 : lighting.temperature * 6
        ctx.filter = `brightness(${lighting.ambientBrightness}) saturate(${activeSeason.saturate}) sepia(${tempSepia}) hue-rotate(${tempHue}deg)`

        // 1. Static Trunk & Root Skeleton (NEVER moves with wind)
        const trunkImg = imgs['/world-tree-assets/base/base_trunk.webp']
        if (trunkImg) {
          ctx.drawImage(trunkImg, 0, 0, W, H)
        }

        // 2. Flexible Secondary Branches
        for (const layer of TREE_LAYERS.filter((l) => l.type === 'branch-flex')) {
          const bImg = imgs[layer.file]
          if (bImg) {
            drawDeformedCluster(bImg, layer, isExploded ? explodeFactor * 0.5 : 0)
          }
        }

        // 3. Deformable Canopy Leaf Clusters (sorted by depth)
        const canopyLayers = TREE_LAYERS.filter((l) => l.type === 'deformable').sort((a, b) => a.depth - b.depth)

        // If a non-default season is active and not in exploded mode, we deform the seasonal RGBA canopy using the same cluster bounds & anchors!
        const seasonalImg = seasonId !== 'default' ? imgs[activeSeason.canopyOverlayFile] : null

        for (const layer of canopyLayers) {
          const cImg = seasonalImg || imgs[layer.file]
          if (cImg) {
            if (seasonalImg) {
              // Clip to the cluster's organic alpha mask by drawing into cluster bounds
              drawDeformedCluster(imgs[layer.file] || cImg, layer, isExploded ? explodeFactor : 0)
            } else {
              drawDeformedCluster(cImg, layer, isExploded ? explodeFactor : 0)
            }
          }
        }

        // If seasonal overlay is active, blend the aligned seasonal artwork across the deforming canopy & trunk
        if (seasonalImg && !isExploded) {
          ctx.save()
          const globalWindX = wind.enabled && wind.strength > 0 ? Math.sin(t * 2.1) * wind.strength * 2.4 * Math.cos((wind.directionDeg * Math.PI) / 180) : 0
          // Draw static lower trunk/roots of season (y >= 185) stationary
          ctx.drawImage(seasonalImg, 0, 185, W, H - 185, 0, 185, W, H - 185)
          // Draw upper canopy of season (y < 185) with subtle multi-band wave matching the clusters
          const bands = 8
          const bandH = 185 / bands
          for (let b = 0; b < bands; b++) {
            const by = b * bandH
            const w = Math.pow(1 - b / bands, 1.3)
            const bxShift = globalWindX * w + (wind.enabled ? Math.sin(t * 2.4 + b * 0.6) * wind.strength * 1.8 * w : 0)
            ctx.drawImage(seasonalImg, 0, by, W, bandH + 0.8, bxShift, by, W, bandH + 0.8)
          }
          ctx.restore()
        }

        // 4. Festival Anchor-Mounted Decorations (e.g., Night Sakura Hanging Lanterns)
        if (activeSeason.decorOverlayFile && imgs[activeSeason.decorOverlayFile]) {
          const decorImg = imgs[activeSeason.decorOverlayFile]
          const pendulumAngle = wind.enabled ? Math.sin(t * 2.3) * wind.strength * 0.08 : Math.sin(t * 1.2) * 0.02
          ctx.save()
          ctx.translate(W / 2, 140)
          ctx.rotate(pendulumAngle)
          ctx.translate(-W / 2, -140)
          ctx.drawImage(decorImg, 0, 0, W, H)
          ctx.restore()
        }

        ctx.restore()

        // 5. Dynamic Code-Driven Vein Glow (`masks/glow_emission.webp`)
        const glowEmitImg = imgs['/world-tree-assets/masks/glow_emission.webp']
        if (glowEmitImg && lighting.glowIntensity > 0.05) {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          const pulse = 0.82 + 0.18 * Math.sin(t * 1.8)
          ctx.globalAlpha = Math.min(1, Math.max(0, (lighting.glowIntensity - 0.35) * 0.65 * pulse))
          ctx.drawImage(glowEmitImg, 0, 0, W, H)
          ctx.restore()
        }

        // 6. Dynamic Pulsing Git Nodes (`nodes.json`)
        if (lighting.nodeIntensity > 0.05) {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          for (const nd of GIT_NODES) {
            const pulse = 0.65 + 0.35 * Math.sin(t * nd.pulseSpeed * 2.4 + nd.pulsePhase)
            const alpha = Math.min(1, lighting.nodeIntensity * pulse * 0.78)
            const rOuter = nd.radius * (1.6 + 0.45 * pulse)
            const grad = ctx.createRadialGradient(nd.center[0], nd.center[1], 1, nd.center[0], nd.center[1], rOuter)
            const roleColor = nd.gitRole === 'commit' ? activeSeason.nodePalette.commit : nd.gitRole === 'branch' ? activeSeason.nodePalette.branch : activeSeason.nodePalette.merge
            grad.addColorStop(0, '#ffffff')
            grad.addColorStop(0.35, roleColor)
            grad.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.globalAlpha = alpha
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(nd.center[0], nd.center[1], rOuter, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()
        }

        // 7. Atmospheric Fog / Mist Layer
        if (lighting.fogAmount > 0.02) {
          ctx.save()
          const fogGrad = ctx.createLinearGradient(0, H * 0.35, 0, H)
          fogGrad.addColorStop(0, `rgba(16, 42, 48, 0)`)
          fogGrad.addColorStop(0.6, `rgba(18, 48, 56, ${lighting.fogAmount * 0.32})`)
          fogGrad.addColorStop(1, `rgba(10, 26, 32, ${lighting.fogAmount * 0.55})`)
          ctx.fillStyle = fogGrad
          ctx.fillRect(0, 0, W, H)
          ctx.restore()
        }
      }

      // --- Switch by InspectMode ---
      if (inspectMode === 'original') {
        const origImg = imgs['/world-tree-assets/original/default_world_tree_original.webp']
        if (origImg) ctx.drawImage(origImg, 0, 0, W, H)
      } else if (inspectMode === 'difference') {
        const diffImg = imgs['/world-tree-assets/previews/difference.webp']
        if (diffImg) ctx.drawImage(diffImg, 0, 0, W, H)
        // Highlight badge rectangle [6, 6, 156, 44]
        ctx.save()
        ctx.strokeStyle = '#f43f5e'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.strokeRect(6, 6, 156, 44)
        ctx.fillStyle = '#fda4af'
        ctx.font = '11px "JetBrains Mono", monospace'
        ctx.fillText('UI 角标修补区 [6,6,156,44]', 10, 64)
        ctx.restore()
      } else if (inspectMode === 'single-layer') {
        const layer = TREE_LAYERS.find((l) => l.id === selectedLayerId)
        if (selectedLayerId === 'glow-mask' && imgs['/world-tree-assets/masks/glow_mask.webp']) {
          ctx.drawImage(imgs['/world-tree-assets/masks/glow_mask.webp'], 0, 0, W, H)
        } else if (selectedLayerId === 'node-mask' && imgs['/world-tree-assets/masks/node_mask.webp']) {
          ctx.drawImage(imgs['/world-tree-assets/masks/node_mask.webp'], 0, 0, W, H)
        } else if (selectedLayerId === 'inpainted-mask' && imgs['/world-tree-assets/masks/inpainted_mask.webp']) {
          ctx.drawImage(imgs['/world-tree-assets/masks/inpainted_mask.webp'], 0, 0, W, H)
        } else if (layer && imgs[layer.file]) {
          // Faint ghost trunk reference so user sees where this isolated cluster sits on the skeleton
          const trunkImg = imgs['/world-tree-assets/base/base_trunk.webp']
          if (trunkImg && layer.id !== 'base-trunk') {
            ctx.save()
            ctx.globalAlpha = 0.16
            ctx.drawImage(trunkImg, 0, 0, W, H)
            ctx.restore()
          }
          drawDeformedCluster(imgs[layer.file], layer, 0)

          if (showDeformMaskOverlay && layer.deformMask && imgs[layer.deformMask]) {
            ctx.save()
            ctx.globalAlpha = 0.65
            ctx.globalCompositeOperation = 'screen'
            ctx.drawImage(imgs[layer.deformMask], 0, 0, W, H)
            ctx.restore()
          }

          // Draw bounding box & anchor pin for the selected layer
          const [x0, y0, x1, y1] = layer.bounds
          ctx.save()
          ctx.strokeStyle = '#2dd4bf'
          ctx.lineWidth = 1.2
          ctx.setLineDash([4, 3])
          ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
          ctx.setLineDash([])
          const anc = layer.anchor || layer.rootAnchor
          if (anc) {
            ctx.fillStyle = '#fde047'
            ctx.beginPath()
            ctx.arc(anc[0], anc[1], 4.5, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#060d10'
            ctx.lineWidth = 1.5
            ctx.stroke()
          }
          ctx.restore()
        }
      } else if (inspectMode === 'split-compare') {
        const splitX = Math.round(splitPos * W)
        // Left side: Original panel
        const origImg = imgs['/world-tree-assets/original/default_world_tree_original.webp']
        if (origImg) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, 0, splitX, H)
          ctx.clip()
          ctx.drawImage(origImg, 0, 0, W, H)
          ctx.restore()
        }
        // Right side: Rebuilt from decomposed layers
        ctx.save()
        ctx.beginPath()
        ctx.rect(splitX, 0, W - splitX, H)
        ctx.clip()
        drawRebuiltTree(false)
        ctx.restore()

        // Divider line
        ctx.save()
        ctx.strokeStyle = '#5efce8'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(splitX, 0)
        ctx.lineTo(splitX, H)
        ctx.stroke()

        // Handle circle
        ctx.fillStyle = '#0d2329'
        ctx.strokeStyle = '#5efce8'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(splitX, H / 2, 12, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#5efce8'
        ctx.font = '10px "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('↔', splitX, H / 2 + 3.5)
        ctx.restore()
      } else {
        // 'live-composite', 'rebuild', or 'exploded'
        drawRebuiltTree(inspectMode === 'exploded')
      }

      // Optional Inpainted Region Mask Overlay
      if (showInpaintedOverlay && imgs['/world-tree-assets/masks/inpainted_mask.webp']) {
        ctx.save()
        ctx.globalAlpha = 0.55
        ctx.globalCompositeOperation = 'screen'
        ctx.drawImage(imgs['/world-tree-assets/masks/inpainted_mask.webp'], 0, 0, W, H)
        ctx.strokeStyle = '#f43f5e'
        ctx.lineWidth = 1.5
        ctx.strokeRect(6, 6, 156, 44)
        ctx.restore()
      }

      // Optional Particle System (Seasonal Petals / Fireflies / Maple / Snow / Spores)
      if (lighting.particlesEnabled && (inspectMode === 'live-composite' || inspectMode === 'rebuild')) {
        const rad = (wind.directionDeg * Math.PI) / 180
        const windVx = wind.enabled ? Math.cos(rad) * wind.strength * 1.35 : 0.15
        ctx.save()
        for (const p of particlesRef.current) {
          p.x += p.vx + windVx + Math.sin(t * 1.5 + p.phase) * 0.25
          p.y += activeSeason.particleType === 'fireflies' || activeSeason.particleType === 'spores' ? Math.cos(t * 1.2 + p.phase) * 0.35 - 0.15 : p.vy
          p.angle += p.spin

          if (p.x > W + 10) p.x = -10
          if (p.x < -10) p.x = W + 10
          if (p.y > H + 10) {
            p.y = -8
            p.x = Math.random() * W
          }
          if (p.y < -10) p.y = H - 20

          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.angle)
          ctx.globalAlpha = p.alpha * (0.65 + 0.35 * Math.sin(t * 2.5 + p.phase))
          ctx.fillStyle = activeSeason.particleColor

          if (activeSeason.particleType === 'petals' || activeSeason.particleType === 'sakura-lantern') {
            // Sakura petal oval
            ctx.beginPath()
            ctx.ellipse(0, 0, p.size * 1.3, p.size * 0.7, 0.3, 0, Math.PI * 2)
            ctx.fill()
          } else if (activeSeason.particleType === 'maple') {
            // Autumn diamond leaf
            ctx.beginPath()
            ctx.moveTo(0, -p.size * 1.3)
            ctx.lineTo(p.size, 0)
            ctx.lineTo(0, p.size * 1.3)
            ctx.lineTo(-p.size, 0)
            ctx.closePath()
            ctx.fill()
          } else {
            // Glowing spore / firefly / snowflake
            ctx.beginPath()
            ctx.arc(0, 0, p.size * 0.75, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()
        }
        ctx.restore()
      }

      // Optional Weather Rain / Snow Overlay
      if (lighting.weatherRainSnow !== 'none' && inspectMode === 'live-composite') {
        ctx.save()
        ctx.strokeStyle = lighting.weatherRainSnow === 'rain' ? 'rgba(125, 211, 252, 0.32)' : 'rgba(224, 242, 254, 0.55)'
        ctx.lineWidth = lighting.weatherRainSnow === 'rain' ? 1 : 2.2
        for (let i = 0; i < 36; i++) {
          const rx = ((i * 73 + t * (lighting.weatherRainSnow === 'rain' ? 140 : 35)) % (W + 40)) - 20
          const ry = ((i * 47 + t * (lighting.weatherRainSnow === 'rain' ? 320 : 65)) % (H + 40)) - 20
          ctx.beginPath()
          ctx.moveTo(rx, ry)
          ctx.lineTo(rx + (lighting.weatherRainSnow === 'rain' ? 5 : 1.5), ry + (lighting.weatherRainSnow === 'rain' ? 14 : 2.5))
          ctx.stroke()
        }
        ctx.restore()
      }

      // Optional Technical Overlays: Mesh Wireframe, Bounding Boxes, Anchors, and Git Nodes
      if (wind.showMeshWireframe || inspectMode === 'exploded') {
        ctx.save()
        for (const layer of TREE_LAYERS.filter((l) => l.type === 'deformable')) {
          const [bx0, by0, bx1, by1] = layer.bounds
          const anchor = layer.anchor || [(bx0 + bx1) / 2, by1]
          const { dx, dy } = getLayerWindOffset(layer)
          const cx = (bx0 + bx1) / 2
          const cy = (by0 + by1) / 2
          const expX = inspectMode === 'exploded' ? (cx - 300) * explodeFactor * 0.36 : 0
          const expY = inspectMode === 'exploded' ? (cy - 155) * explodeFactor * 0.36 : 0

          if (inspectMode === 'exploded') {
            // Draw tether line from static trunk anchor to exploded cluster
            ctx.strokeStyle = 'rgba(94, 252, 232, 0.55)'
            ctx.lineWidth = 1
            ctx.setLineDash([3, 3])
            ctx.beginPath()
            ctx.moveTo(anchor[0], anchor[1])
            ctx.lineTo(cx + expX, cy + expY)
            ctx.stroke()
            ctx.setLineDash([])
          }

          if (wind.showMeshWireframe) {
            ctx.strokeStyle = layer.id === selectedLayerId ? 'rgba(253, 224, 71, 0.75)' : 'rgba(45, 212, 191, 0.28)'
            ctx.lineWidth = layer.id === selectedLayerId ? 1.2 : 0.7
            const strips = 4
            const sh = (by1 - by0) / strips
            for (let s = 0; s <= strips; s++) {
              const w = Math.pow(1 - s / strips, 1.3)
              const ly = by0 + s * sh + dy * w + expY
              const lx0 = bx0 + dx * w + expX
              const lx1 = bx1 + dx * w + expX
              ctx.beginPath()
              ctx.moveTo(lx0, ly)
              ctx.lineTo(lx1, ly)
              ctx.stroke()
            }
          }
        }
        ctx.restore()
      }

      if (wind.showBounds) {
        ctx.save()
        for (const layer of TREE_LAYERS.filter((l) => l.type === 'deformable')) {
          const [bx0, by0, bx1, by1] = layer.bounds
          const isSel = layer.id === selectedLayerId
          ctx.strokeStyle = isSel ? '#fde047' : 'rgba(94, 252, 232, 0.38)'
          ctx.lineWidth = isSel ? 1.5 : 0.8
          ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0)
        }
        ctx.restore()
      }

      if (wind.showAnchors || inspectMode === 'exploded') {
        ctx.save()
        for (const layer of TREE_LAYERS.filter((l) => l.type === 'deformable')) {
          const anc = layer.anchor
          if (!anc) continue
          const { dx, dy } = getLayerWindOffset(layer)
          const [bx0, by0, bx1, by1] = layer.bounds
          const tipX = (bx0 + bx1) / 2 + dx
          const tipY = by0 + (by1 - by0) * 0.25 + dy

          // Draw vector from pinned anchor to displaced outer center
          ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)'
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(anc[0], anc[1])
          ctx.lineTo(tipX, tipY)
          ctx.stroke()

          // Anchor pin (stationary on branch)
          ctx.fillStyle = layer.id === selectedLayerId ? '#f43f5e' : '#fde047'
          ctx.beginPath()
          ctx.arc(anc[0], anc[1], 3.8, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#060d10'
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
        ctx.restore()
      }

      if (wind.showNodes) {
        ctx.save()
        for (const nd of GIT_NODES) {
          const isSel = nd.id === selectedNodeId || nd.id === hoveredNode?.id
          ctx.strokeStyle = isSel ? '#ffffff' : nd.defaultColor
          ctx.lineWidth = isSel ? 2 : 1.2
          ctx.beginPath()
          ctx.arc(nd.center[0], nd.center[1], nd.radius + (isSel ? 3 : 0), 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      }

      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId)
  }, [
    W,
    H,
    loadedCount,
    inspectMode,
    backdrop,
    selectedLayerId,
    showDeformMaskOverlay,
    showInpaintedOverlay,
    seasonId,
    wind,
    lighting,
    splitPos,
    explodeFactor,
    selectedNodeId,
    hoveredNode,
  ])

  // Handle pointer interaction on canvas (split curtain drag, node click, cluster selection)
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const y = ((e.clientY - rect.top) / rect.height) * H

    if (inspectMode === 'split-compare' && (isDraggingSplit || e.buttons === 1)) {
      setSplitPos(Math.max(0.05, Math.min(0.95, x / W)))
      return
    }

    // Check if hovering over a Git node
    let foundNode: GitNodeMeta | null = null
    for (const nd of GIT_NODES) {
      if (Math.hypot(x - nd.center[0], y - nd.center[1]) <= nd.radius + 5) {
        foundNode = nd
        break
      }
    }
    setHoveredNode(foundNode)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const y = ((e.clientY - rect.top) / rect.height) * H

    if (inspectMode === 'split-compare') {
      setIsDraggingSplit(true)
      setSplitPos(Math.max(0.05, Math.min(0.95, x / W)))
      return
    }

    // Check Git node click first
    for (const nd of GIT_NODES) {
      if (Math.hypot(x - nd.center[0], y - nd.center[1]) <= nd.radius + 6) {
        onSelectNode?.(nd)
        return
      }
    }

    // Check canopy cluster click (top-most depth first)
    const clickableClusters = TREE_LAYERS.filter((l) => l.type === 'deformable').sort((a, b) => b.depth - a.depth)
    for (const cl of clickableClusters) {
      const [x0, y0, x1, y1] = cl.bounds
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
        onSelectLayer?.(cl.id)
        return
      }
    }
  }

  const backdropClass = backdrop === 'checker-dark' ? 'checkerboard-bg' : backdrop === 'checker-light' ? 'checkerboard-light-bg' : 'bg-[#071418]'

  return (
    <div className={`relative select-none ${className}`}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setIsDraggingSplit(false)}
        onPointerLeave={() => {
          setIsDraggingSplit(false)
          setHoveredNode(null)
        }}
        className={`w-full h-auto rounded-lg border border-teal-900/50 cursor-crosshair block ${backdropClass}`}
      />

      {/* Split Compare Overlay Labels */}
      {inspectMode === 'split-compare' && !compactMode && (
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between text-xs font-mono">
          <span className="bg-[#061014]/85 text-teal-200 px-2.5 py-1 rounded border border-teal-800/60">左：01 永恒·默认 源图 (Original)</span>
          <span className="bg-[#061014]/85 text-emerald-300 px-2.5 py-1 rounded border border-emerald-700/60">右：17 层 RGBA 无损重组 (MAE = 0.0432 px)</span>
        </div>
      )}

      {/* Exploded Mode Slider */}
      {inspectMode === 'exploded' && !compactMode && (
        <div className="absolute bottom-3 left-3 right-3 bg-[#061014]/90 border border-teal-800/60 rounded-lg px-3.5 py-2 flex items-center justify-between gap-4">
          <span className="text-xs text-teal-200 whitespace-nowrap">叶簇径向展开距离 (验证独立 Alpha 蒙版与锚点连接线)</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={explodeFactor}
            onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
            className="w-40 accent-teal-400 cursor-pointer"
          />
          <span className="text-xs font-mono text-teal-300 tabular-nums w-12 text-right">{Math.round(explodeFactor * 100)}%</span>
        </div>
      )}

      {/* Hovered Git Node Tooltip */}
      {hoveredNode && !compactMode && (
        <div
          className="pointer-events-none absolute z-20 bg-[#07151a]/95 border border-teal-500/60 rounded-md px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${Math.min(72, (hoveredNode.center[0] / W) * 100)}%`,
            top: `${Math.max(6, (hoveredNode.center[1] / H) * 100 - 14)}%`,
          }}
        >
          <div className="font-semibold text-teal-200">{hoveredNode.label}</div>
          <div className="text-slate-400 font-mono text-[11px] mt-0.5">
            {hoveredNode.id} · ({hoveredNode.center[0]}, {hoveredNode.center[1]}) · {hoveredNode.gitRole.toUpperCase()} · {hoveredNode.branchRef}
          </div>
        </div>
      )}
    </div>
  )
}
