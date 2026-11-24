const FONT = 'system-ui, sans-serif'

const ICONS = {
  tree: 'M12 22V3M12 17C7 17 4 14 4 10M12 13C17 13 20 10 20 6M12 9C9 9 7 7 7 3M5 22H19M2 10H7M17 6H22M5 3H9M10 3H14',
  branch: 'M6 8V16M8 17C14 17 17 13 17 8M6 4A2 2 0 1 0 6 8A2 2 0 1 0 6 4M6 16A2 2 0 1 0 6 20A2 2 0 1 0 6 16M17 4A2 2 0 1 0 17 8A2 2 0 1 0 17 4',
  search: 'M10.5 4A6.5 6.5 0 1 0 10.5 17A6.5 6.5 0 1 0 10.5 4M15.5 15.5L21 21',
  folder: 'M3 7A1 1 0 0 1 4 6H9L11 8H20A1 1 0 0 1 21 9V18A1 1 0 0 1 20 19H4A1 1 0 0 1 3 18Z',
  star: 'M12 3L15 9L22 10L17 15L18 21L12 18L6 21L7 15L2 10L9 9Z',
  clock: 'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3M12 7V12L15 14',
  chevron: 'M7 10L12 15L17 10',
} as const

type IconName = keyof typeof ICONS
type Box = readonly [x: number, y: number, width: number, height: number]
type CardControl = { id: string; label: string; box: Box; icon: IconName; chevron?: boolean }

export const CARD_UI_BOUNDS = { x: 662, y: 247, width: 878, height: 434 }
export const CARD_BRANCH_BOUNDS = { x: 898, y: 345, width: 205, height: 357 }
export const CARD_ROOT_BOUNDS = { x: 510, y: 630, width: 770, height: 200 }
const CARD_ROOT_ORIGIN = [1056, 657] as const

const panelInset = 12
const panelLeft = CARD_UI_BOUNDS.x + panelInset
const panelWidth = CARD_UI_BOUNDS.width - panelInset * 2
const controlRight = panelLeft + panelWidth - panelInset
const commitLeft = 1073
const commitDotX = commitLeft + 17
const commitTitleLeft = commitDotX + 12
const commitTimeRight = 1350
const commitTitleWidth = commitTimeRight - 68 - commitTitleLeft
const searchLeft = 1157
const laneX = [918, 980, CARD_ROOT_ORIGIN[0]]
const rowTop = 360
const rowHeight = 44
const commits = [
  { lane: 0, title: 'feat: multi-repo view', time: '2h ago', color: '#61c8ff' },
  { lane: 2, title: 'fix: conflict hints', time: '3h ago', color: '#ff7ae6' },
  { lane: 1, title: 'merge: feature/search', time: '4h ago', color: '#41ffe0' },
  { lane: 2, title: 'feat: branch search', time: '6h ago', color: '#ffe154' },
  { lane: 0, title: 'refactor: faster graph', time: '8h ago', color: '#eb80ff' },
  { lane: 1, title: 'chore: update deps', time: '1d ago', color: '#26ddff' },
]

export const CARD_INNER_ORBS = commits.map((commit, commitIdx) => ({
  ...commit,
  id: `commit-${commitIdx}`,
  commitIdx,
  x: laneX[commit.lane],
  y: rowTop + rowHeight * (commitIdx + 0.5),
  rowBox: [commitLeft, rowTop + rowHeight * commitIdx + 3, controlRight - commitLeft, rowHeight - 6] as const,
}))

export const SIDEBAR_HOTSPOTS: CardControl[] = [
  { id: 'repos', label: 'All repositories', box: [686, 358, 183, 36], icon: 'folder' },
  { id: 'saved', label: 'Favorites', box: [686, 399, 183, 35], icon: 'star' },
  { id: 'recent', label: 'Recently viewed', box: [686, 439, 183, 35], icon: 'clock' },
  { id: 'web-app', label: 'web-app', box: [686, 510, 183, 31], icon: 'folder' },
  { id: 'api-service', label: 'api-service', box: [686, 545, 183, 31], icon: 'folder' },
  { id: 'mobile', label: 'mobile', box: [686, 580, 183, 31], icon: 'folder' },
  { id: 'infra', label: 'infra', box: [686, 615, 183, 31], icon: 'folder' },
]

export const SIDEBAR_COMMITS: Record<string, number> = {
  repos: 0,
  saved: 2,
  recent: 1,
  'web-app': 2,
  'api-service': 0,
  mobile: 3,
  infra: 5,
}

export const TOOLBAR_HOTSPOTS: CardControl[] = [
  { id: 'tb-repo', label: 'yggit / web-app', box: [856, 303, 178, 33], icon: 'folder', chevron: true },
  { id: 'tb-branch', label: 'main', box: [1045, 303, 100, 33], icon: 'branch', chevron: true },
  { id: 'tb-search', label: 'Search commits', box: [searchLeft, 303, controlRight - searchLeft, 33], icon: 'search' },
]

export type CardUiState = {
  activeCommitIdx: number
  activeSidebarId: string
  hoveredSidebarId: string | null
  activeToolbarId: string | null
  hoveredToolbarId: string | null
}

export const DEFAULT_CARD_UI_STATE: CardUiState = {
  activeCommitIdx: 2,
  activeSidebarId: 'web-app',
  hoveredSidebarId: null,
  activeToolbarId: null,
  hoveredToolbarId: null,
}

const iconPaths = new Map<IconName, Path2D>()

function drawIcon(ctx: CanvasRenderingContext2D, icon: IconName, x: number, y: number, size: number, color: string) {
  let path = iconPaths.get(icon)
  if (!path) {
    path = new Path2D(ICONS[icon])
    iconPaths.set(icon, path)
  }
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.stroke(path)
  ctx.restore()
}

function surface(ctx: CanvasRenderingContext2D, box: Box, radius: number, fill: string | CanvasGradient, border?: string) {
  ctx.beginPath()
  ctx.roundRect(...box, radius)
  ctx.fillStyle = fill
  ctx.fill()
  if (border) {
    ctx.strokeStyle = border
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function text(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, size: number, color: string, weight = 500) {
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.fillStyle = color
  ctx.fillText(label, x, y)
}

export interface CardUiLabels {
  allRepos?: string
  favorites?: string
  recentlyViewed?: string
  workspace?: string
  searchCommits?: string
}

export function drawHeroCardUi(ctx: CanvasRenderingContext2D, state: CardUiState, night: number, labels?: CardUiLabels) {
  const { x, y, width, height } = CARD_UI_BOUNDS
  const ink = '#eaf9fc'
  const muted = '#a5c6cf'
  const accent = '#6ef9d4'
  const cardLabels = {
    allRepos: labels?.allRepos ?? 'All repositories',
    favorites: labels?.favorites ?? 'Favorites',
    recentlyViewed: labels?.recentlyViewed ?? 'Recently viewed',
    workspace: labels?.workspace ?? 'Workspace',
    searchCommits: labels?.searchCommits ?? 'Search commits',
  }
  const chrome = ctx.createLinearGradient(x, y, x, y + height)
  chrome.addColorStop(0, `rgb(${12 - 5 * night} ${47 - 14 * night} ${58 - 15 * night})`)
  chrome.addColorStop(1, `rgb(${8 - 3 * night} ${33 - 10 * night} ${45 - 13 * night})`)
  ctx.save()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  surface(ctx, [x, y, width, height], 25, chrome)
  surface(ctx, [panelLeft, 293, panelWidth, 52], 10, '#061f2b')
  surface(ctx, [panelLeft, 352, panelWidth, 305], 9, `rgb(${9 - 3 * night} ${35 - 9 * night} ${47 - 9 * night})`)
  ctx.fillStyle = '#a3eaf51c'
  ctx.fillRect(882, 355, 1, 299)
  ctx.fillRect(1069, 355, 1, 299)
  ctx.fillRect(panelLeft, 286, panelWidth, 1)
  ctx.fillRect(panelLeft, 662, panelWidth, 1)
  for (let row = 1; row < commits.length; row++) {
    ctx.fillRect(commitLeft, rowTop + rowHeight * row, controlRight - commitLeft, 1)
  }

  for (const [index, color] of ['#ff575d', '#ffd256', '#9bed55'].entries()) {
    ctx.beginPath()
    ctx.arc(686 + index * 19, 271, 6.5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  surface(ctx, [688, 304, 29, 29], 7, '#133c44', '#347c76')
  drawIcon(ctx, 'tree', 692, 307, 21, accent)
  text(ctx, 'Yggit', 727, 319, 23, ink, 750)
  for (const control of TOOLBAR_HOTSPOTS) {
    const [left, top, controlWidth, controlHeight] = control.box
    const highlighted = control.id === state.activeToolbarId || control.id === state.hoveredToolbarId
    surface(ctx, control.box, 7, highlighted ? '#1a514f' : '#10313d', highlighted ? '#4abda8' : '#234754')
    drawIcon(ctx, control.icon, left + 10, top + 8, 17, highlighted ? accent : muted)
    const labelText = control.id === 'tb-search' ? cardLabels.searchCommits : control.label
    text(ctx, labelText, left + 34, top + controlHeight / 2, 14, control.chevron ? ink : muted, 550)
    if (control.chevron) drawIcon(ctx, 'chevron', left + controlWidth - 22, top + 9, 15, muted)
  }

  for (const control of SIDEBAR_HOTSPOTS) {
    const [left, top, , controlHeight] = control.box
    const selected = control.id === state.activeSidebarId
    if (selected || control.id === state.hoveredSidebarId) {
      surface(ctx, control.box, 6, selected ? '#124c48' : '#103844', selected ? '#378f86' : undefined)
    }
    drawIcon(ctx, control.icon, left + 10, top + (controlHeight - 17) / 2, 17, selected ? accent : muted)
    let labelText = control.label
    if (control.id === 'repos') labelText = cardLabels.allRepos
    else if (control.id === 'saved') labelText = cardLabels.favorites
    else if (control.id === 'recent') labelText = cardLabels.recentlyViewed
    text(ctx, labelText, left + 37, top + controlHeight / 2, 15, selected ? accent : ink, selected ? 650 : 500)
  }
  ctx.fillStyle = '#30545c'
  ctx.fillRect(698, 480, 159, 1)
  text(ctx, cardLabels.workspace, 698, 496, 13, muted, 600)

  for (const commit of CARD_INNER_ORBS) {
    const active = commit.commitIdx === state.activeCommitIdx
    if (active) surface(ctx, commit.rowBox, 7, '#144a48', '#3f9c90')
    ctx.beginPath()
    ctx.arc(commitDotX, commit.y, 3, 0, Math.PI * 2)
    ctx.fillStyle = commit.color
    ctx.fill()
    ctx.font = `${active ? 700 : 500} 14px ${FONT}`
    ctx.fillStyle = ink
    ctx.fillText(commit.title, commitTitleLeft, commit.y, commitTitleWidth)
    ctx.textAlign = 'right'
    text(ctx, commit.time, commitTimeRight, commit.y, 12, muted)
    ctx.textAlign = 'left'
  }
  ctx.restore()
}

type Point = readonly [number, number]
type Curve = readonly [Point, Point, Point, Point]

function trace(ctx: CanvasRenderingContext2D, curve: Curve) {
  const [start, controlA, controlB, end] = curve
  ctx.beginPath()
  ctx.moveTo(...start)
  ctx.bezierCurveTo(...controlA, ...controlB, ...end)
}

function pointAt(curve: Curve, phase: number): Point {
  const [start, controlA, controlB, end] = curve
  const inverse = 1 - phase
  const interpolate = (axis: 0 | 1) => inverse ** 3 * start[axis] + 3 * inverse ** 2 * phase * controlA[axis] + 3 * inverse * phase ** 2 * controlB[axis] + phase ** 3 * end[axis]
  return [interpolate(0), interpolate(1)]
}

const lanes = [
  {
    color: '#df78ff',
    top: '#5ba7ff',
    card: [
      [
        [918, 345],
        [918, 460],
        [918, 565],
        [918, 636],
      ],
      [
        [918, 636],
        [918, 656],
        [940, 670],
        [946, 684],
      ],
    ],
    ground: [
      [
        [946, 684],
        [952, 698],
        [943, 713],
        [926, 732],
      ],
      [
        [926, 732],
        [909, 751],
        [862, 757],
        [838, 773],
      ],
    ],
  },
  {
    color: '#32e7ff',
    top: '#43e8cc',
    card: [
      [
        [980, 345],
        [980, 460],
        [980, 565],
        [980, 638],
      ],
      [
        [980, 638],
        [980, 660],
        [1011, 670],
        [1013, 684],
      ],
    ],
    ground: [
      [
        [1013, 684],
        [1017, 712],
        [985, 724],
        [964, 748],
      ],
      [
        [964, 748],
        [949, 765],
        [942, 779],
        [926, 790],
      ],
    ],
  },
  {
    color: '#ffe067',
    top: '#ff69b8',
    card: [[[1056, 345], [1056, 458], [1056, 584], CARD_ROOT_ORIGIN]],
    ground: [
      [CARD_ROOT_ORIGIN, [1056, 694], [1010, 725], [978, 755]],
      [
        [978, 755],
        [946, 785],
        [902, 785],
        [880, 799],
      ],
    ],
  },
] satisfies { color: string; top: string; card: Curve[]; ground: Curve[] }[]

const merges = [
  {
    color: '#48ffeb',
    curve: [
      [918, 382],
      [918, 438],
      [980, 424],
      [980, 470],
    ],
  },
  {
    color: '#ffe75b',
    curve: [
      [980, 470],
      [980, 509],
      [1056, 476],
      [1056, 514],
    ],
  },
] satisfies { color: string; curve: Curve }[]

const roots = [
  {
    color: '#50edff',
    ground: [
      [CARD_ROOT_ORIGIN, [1032, 670], [1016, 687], [979, 694]],
      [
        [979, 694],
        [933, 703],
        [903, 674],
        [865, 700],
      ],
      [
        [865, 700],
        [817, 732],
        [754, 701],
        [690, 714],
      ],
    ],
  },
  {
    color: '#f28aff',
    ground: [
      [CARD_ROOT_ORIGIN, [1066, 670], [1071, 683], [1095, 696]],
      [
        [1095, 696],
        [1111, 723],
        [1204, 733],
        [1247, 772],
      ],
    ],
  },
  {
    color: '#ffe067',
    ground: [
      [
        [805, 734],
        [756, 756],
        [711, 731],
        [659, 749],
      ],
      [
        [659, 749],
        [607, 767],
        [563, 775],
        [530, 787],
      ],
    ],
  },
] satisfies { color: string; ground: Curve[] }[]

function strokeTrack(ctx: CanvasRenderingContext2D, curves: Curve[], color: string, top?: string) {
  const start = curves[0][0]
  const end = curves[curves.length - 1][3]
  const gradient = ctx.createLinearGradient(...start, ...end)
  gradient.addColorStop(0, top ? `${top}20` : color)
  if (top) gradient.addColorStop(0.14, top)
  gradient.addColorStop(1, color)
  ctx.beginPath()
  ctx.moveTo(...start)
  for (const [, controlA, controlB, target] of curves) ctx.bezierCurveTo(...controlA, ...controlB, ...target)
  ctx.strokeStyle = gradient
  ctx.globalAlpha = 0.14
  ctx.lineWidth = 9
  ctx.stroke()
  ctx.globalAlpha = 0.32
  ctx.lineWidth = 4.5
  ctx.stroke()
  ctx.globalAlpha = 0.95
  ctx.lineWidth = 2.1
  ctx.stroke()
}

function sampleFlow(color: string, card: Curve[], ground: Curve[]) {
  const samples: { point: Point; distance: number }[] = []
  let distance = 0
  for (const curve of [...card, ...ground]) {
    for (let step = samples.length ? 1 : 0; step <= 32; step++) {
      const point = pointAt(curve, step / 32)
      const prev = samples[samples.length - 1]?.point ?? point
      distance += Math.hypot(point[0] - prev[0], point[1] - prev[1])
      samples.push({ point, distance })
    }
  }
  const edge = samples[card.length * 32].distance
  return { color, samples, length: distance, edge }
}

const flows = [
  ...lanes.map(({ color, card, ground }) => sampleFlow(color, card, ground)),
  ...roots.map(({ color, ground }) => sampleFlow(color, [], ground)),
  ...merges.map(({ color, curve }) => sampleFlow(color, [curve], [])),
]

function flowPoint(samples: ReturnType<typeof sampleFlow>['samples'], distance: number): Point {
  let left = 0
  let right = samples.length - 1
  while (right - left > 1) {
    const mid = (left + right) >>> 1
    if (samples[mid].distance < distance) left = mid
    else right = mid
  }
  const start = samples[left]
  const end = samples[right]
  const ratio = (distance - start.distance) / (end.distance - start.distance)
  return [start.point[0] + (end.point[0] - start.point[0]) * ratio, start.point[1] + (end.point[1] - start.point[1]) * ratio]
}

type GlowSprite = (core: string, color: string, stop?: number) => HTMLCanvasElement

export function drawHeroCardBranches(ctx: CanvasRenderingContext2D, state: CardUiState, time: number, getGlowSprite: GlowSprite, showBranches: boolean, showRoots: boolean) {
  const glow = (x: number, y: number, radius: number, color: string) => {
    ctx.drawImage(getGlowSprite('#ffffff', color, 0.4), x - radius, y - radius, radius * 2, radius * 2)
  }
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (showBranches) {
    for (const { color, card, top } of lanes) strokeTrack(ctx, card, color, top)
    for (const { color, curve } of merges) strokeTrack(ctx, [curve], color)
  }

  if (showRoots) {
    for (const { color, ground } of [...lanes, ...roots.slice(0, 2)]) {
      const curve: Curve = ground[0]
      const gradient = ctx.createLinearGradient(...curve[0], ...curve[3])
      gradient.addColorStop(0, showBranches ? color : `${color}00`)
      gradient.addColorStop(0.38, `${color}90`)
      gradient.addColorStop(1, `${color}00`)
      trace(ctx, curve)
      ctx.strokeStyle = gradient
      ctx.globalAlpha = 0.3
      ctx.lineWidth = 5
      ctx.stroke()
      ctx.globalAlpha = 0.93
      ctx.lineWidth = 2.1
      ctx.stroke()
    }
    const [x, y] = CARD_ROOT_ORIGIN
    ctx.globalAlpha = 0.86 + 0.11 * Math.sin(time * 3)
    ctx.drawImage(getGlowSprite('#ffffff', '#ffe76d', 0.28), x - 18, y - 28, 36, 56)
  }

  for (const [index, flow] of flows.entries()) {
    const { length, edge, color, samples } = flow
    const spacing = Math.min(length, 205)
    const offset = (time * (82 + index * 5) + index * 61) % spacing
    for (let head = length - offset; head >= 0; head -= spacing) {
      for (let tail = 0; tail <= 4; tail++) {
        const distance = head + tail * 5
        if (distance > length || !(distance <= edge ? showBranches : showRoots)) continue
        const fade = Math.min(1, distance / 25, (length - distance) / 24)
        const [x, y] = flowPoint(samples, distance)
        ctx.globalAlpha = fade * (tail === 0 ? 0.85 : 0.38 * (1 - tail / 5))
        glow(x, y, 9 - tail, color)
      }
    }
  }

  if (!showBranches) {
    ctx.restore()
    return
  }

  const active = CARD_INNER_ORBS[state.activeCommitIdx]
  if (active) {
    ctx.beginPath()
    ctx.moveTo(active.x + 11, active.y)
    ctx.lineTo(commitDotX - 5, active.y)
    ctx.strokeStyle = active.color
    ctx.globalAlpha = 0.34
    ctx.lineWidth = 1
    ctx.setLineDash([2, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  for (const commit of CARD_INNER_ORBS) {
    const selected = commit.commitIdx === state.activeCommitIdx
    const pulse = Math.sin(time * 2.7 + commit.commitIdx * 0.9)
    ctx.globalAlpha = selected ? 1 : 0.78
    glow(commit.x, commit.y, selected ? 20 + pulse * 3 : 14 + pulse * 2, commit.color)
    ctx.beginPath()
    ctx.arc(commit.x, commit.y, selected ? 6.5 : 5.1, 0, Math.PI * 2)
    ctx.fillStyle = commit.color
    ctx.fill()
    ctx.beginPath()
    ctx.arc(commit.x, commit.y, selected ? 3.4 : 2.6, 0, Math.PI * 2)
    ctx.fillStyle = '#f6ffff'
    ctx.fill()
    if (selected) {
      ctx.beginPath()
      ctx.arc(commit.x, commit.y, 10 + pulse, 0, Math.PI * 2)
      ctx.strokeStyle = commit.color
      ctx.lineWidth = 1.4
      ctx.stroke()
    }
  }
  ctx.restore()
}
