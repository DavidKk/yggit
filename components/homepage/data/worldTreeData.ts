export interface LayerMeta {
  id: string;
  name: string;
  file: string;
  type: 'background' | 'static' | 'branch-flex' | 'deformable';
  depth: number;
  bounds: [number, number, number, number];
  anchor?: [number, number];
  rootAnchor?: [number, number];
  tipAnchor?: [number, number];
  offset: [number, number];
  windWeight?: number;
  stiffness?: number;
  phaseOffset?: number;
  maxDisplacementPx?: number;
  deformMask?: string;
  overlapGroup?: string;
}

export interface GitNodeMeta {
  id: string;
  center: [number, number];
  normalizedCenter: [number, number];
  radius: number;
  defaultColor: string;
  gitRole: 'commit' | 'branch' | 'merge';
  branchRef: string;
  label: string;
  pulsePhase: number;
  pulseSpeed: number;
}

export interface TimeOfDayPreset {
  id: 'dawn' | 'day' | 'dusk' | 'night';
  name: string;
  timeRange: string;
  ambientBrightness: number;
  temperature: number; // -1 cool to +1 warm
  glowIntensity: number;
  nodeIntensity: number;
  fogAmount: number;
  backgroundTint: string;
  skyGradient: [string, string];
  description: string;
}

export interface SeasonThemePack {
  id: 'default' | 'spring' | 'summer' | 'autumn' | 'winter' | 'festival-sakura';
  code: string;
  name: string;
  subtitle: string;
  panelRefImage: string;
  canopyOverlayFile: string;
  decorOverlayFile?: string;
  hueRotateDeg: number;
  saturate: number;
  veinColor: string;
  nodePalette: {
    commit: string;
    branch: string;
    merge: string;
  };
  particleType: 'spores' | 'petals' | 'fireflies' | 'maple' | 'snow' | 'sakura-lantern';
  particleColor: string;
  scheduleRule: string;
  priorityLevel: number;
}

export const MASTER_CANVAS = {
  width: 492,
  height: 412,
  parentGridFile: '/assets/aistudio/ChatGPT_Image_Nov_16__2026__11_37_37_PM_33b467c5.webp',
  standaloneRefFile: '/assets/aistudio/Glowing_Teal_World_Tree_6d2f1e18.webp',
  landingDefaultFile: '/assets/aistudio/Yggit_____Git______f7021535.webp',
  landingSakuraFile: '/assets/aistudio/Yggit_Sakura_Git_History_Interface_3332fa93.webp',
  unoccludedMae: 0.0432,
  unoccludedPsnr: 66.07,
  ssim: 0.9984,
  inpaintedBadgeRect: [6, 6, 156, 44] as [number, number, number, number],
};

export const TREE_LAYERS: LayerMeta[] = [
  {
    id: 'background-scene',
    name: '森林环境底图 (去树与去角标)',
    file: '/world-tree-assets/background/scene_clean.webp',
    type: 'background',
    depth: 10,
    bounds: [0, 0, 492, 412],
    offset: [0, 0],
  },
  {
    id: 'base-trunk',
    name: '固定世界树骨架 (主干/粗枝/根系)',
    file: '/world-tree-assets/base/base_trunk.webp',
    type: 'static',
    depth: 20,
    bounds: [12, 102, 480, 406],
    offset: [0, 0],
  },
  {
    id: 'branch-flex-01',
    name: '左侧外延细枝',
    file: '/world-tree-assets/branches/branch_flex_01.webp',
    type: 'branch-flex',
    depth: 24,
    bounds: [108, 122, 222, 170],
    rootAnchor: [222, 156],
    tipAnchor: [118, 140],
    offset: [0, 0],
    windWeight: 0.28,
    stiffness: 0.86,
    phaseOffset: 0.2,
    maxDisplacementPx: 2.5,
  },
  {
    id: 'branch-flex-02',
    name: '左上分叉细枝',
    file: '/world-tree-assets/branches/branch_flex_02.webp',
    type: 'branch-flex',
    depth: 25,
    bounds: [188, 82, 282, 142],
    rootAnchor: [268, 138],
    tipAnchor: [198, 88],
    offset: [0, 0],
    windWeight: 0.25,
    stiffness: 0.88,
    phaseOffset: 0.9,
    maxDisplacementPx: 2.2,
  },
  {
    id: 'branch-flex-03',
    name: '右上分叉细枝',
    file: '/world-tree-assets/branches/branch_flex_03.webp',
    type: 'branch-flex',
    depth: 26,
    bounds: [320, 78, 416, 138],
    rootAnchor: [342, 136],
    tipAnchor: [404, 86],
    offset: [0, 0],
    windWeight: 0.26,
    stiffness: 0.87,
    phaseOffset: 2.4,
    maxDisplacementPx: 2.4,
  },
  {
    id: 'branch-flex-04',
    name: '右侧横展细枝',
    file: '/world-tree-assets/branches/branch_flex_04.webp',
    type: 'branch-flex',
    depth: 27,
    bounds: [345, 128, 450, 176],
    rootAnchor: [358, 158],
    tipAnchor: [436, 150],
    offset: [0, 0],
    windWeight: 0.30,
    stiffness: 0.85,
    phaseOffset: 3.2,
    maxDisplacementPx: 2.6,
  },
  {
    id: 'canopy-01',
    name: '左侧外缘垂叶簇',
    file: '/world-tree-assets/canopy/cluster_01.webp',
    deformMask: '/world-tree-assets/masks/cluster_01_deform.webp',
    type: 'deformable',
    depth: 36,
    bounds: [8, 96, 152, 198],
    anchor: [132, 144],
    offset: [0, 0],
    windWeight: 0.78,
    stiffness: 0.58,
    phaseOffset: 0.0,
    maxDisplacementPx: 6.5,
    overlapGroup: 'left-canopy',
  },
  {
    id: 'canopy-02',
    name: '左中主枝叶簇',
    file: '/world-tree-assets/canopy/cluster_02.webp',
    deformMask: '/world-tree-assets/masks/cluster_02_deform.webp',
    type: 'deformable',
    depth: 38,
    bounds: [42, 52, 206, 156],
    anchor: [178, 122],
    offset: [0, 0],
    windWeight: 0.68,
    stiffness: 0.64,
    phaseOffset: 0.45,
    maxDisplacementPx: 5.5,
    overlapGroup: 'left-canopy',
  },
  {
    id: 'canopy-03',
    name: '左上树冠叶簇',
    file: '/world-tree-assets/canopy/cluster_03.webp',
    deformMask: '/world-tree-assets/masks/cluster_03_deform.webp',
    type: 'deformable',
    depth: 40,
    bounds: [112, 14, 276, 122],
    anchor: [228, 96],
    offset: [0, 0],
    windWeight: 0.72,
    stiffness: 0.62,
    phaseOffset: 0.85,
    maxDisplacementPx: 6.0,
    overlapGroup: 'left-canopy',
  },
  {
    id: 'canopy-04',
    name: '左内侧分枝叶簇',
    file: '/world-tree-assets/canopy/cluster_04.webp',
    deformMask: '/world-tree-assets/masks/cluster_04_deform.webp',
    type: 'deformable',
    depth: 32,
    bounds: [132, 84, 278, 182],
    anchor: [242, 152],
    offset: [0, 0],
    windWeight: 0.46,
    stiffness: 0.76,
    phaseOffset: 1.15,
    maxDisplacementPx: 4.0,
    overlapGroup: 'left-canopy',
  },
  {
    id: 'canopy-05',
    name: '中左顶冠叶簇',
    file: '/world-tree-assets/canopy/cluster_05.webp',
    deformMask: '/world-tree-assets/masks/cluster_05_deform.webp',
    type: 'deformable',
    depth: 42,
    bounds: [188, 4, 348, 114],
    anchor: [284, 94],
    offset: [0, 0],
    windWeight: 0.74,
    stiffness: 0.60,
    phaseOffset: 1.55,
    maxDisplacementPx: 6.0,
    overlapGroup: 'center-crown',
  },
  {
    id: 'canopy-06',
    name: '中央主冠核心叶簇',
    file: '/world-tree-assets/canopy/cluster_06.webp',
    deformMask: '/world-tree-assets/masks/cluster_06_deform.webp',
    type: 'deformable',
    depth: 46,
    bounds: [248, 2, 424, 94],
    anchor: [336, 76],
    offset: [0, 0],
    windWeight: 0.82,
    stiffness: 0.56,
    phaseOffset: 1.95,
    maxDisplacementPx: 7.0,
    overlapGroup: 'center-crown',
  },
  {
    id: 'canopy-07',
    name: '中内侧荧光叶簇',
    file: '/world-tree-assets/canopy/cluster_07.webp',
    deformMask: '/world-tree-assets/masks/cluster_07_deform.webp',
    type: 'deformable',
    depth: 34,
    bounds: [236, 48, 378, 146],
    anchor: [314, 126],
    offset: [0, 0],
    windWeight: 0.48,
    stiffness: 0.75,
    phaseOffset: 2.25,
    maxDisplacementPx: 4.2,
    overlapGroup: 'center-crown',
  },
  {
    id: 'canopy-08',
    name: '中右高光叶簇',
    file: '/world-tree-assets/canopy/cluster_08.webp',
    deformMask: '/world-tree-assets/masks/cluster_08_deform.webp',
    type: 'deformable',
    depth: 48,
    bounds: [302, 14, 462, 122],
    anchor: [358, 102],
    offset: [0, 0],
    windWeight: 0.76,
    stiffness: 0.60,
    phaseOffset: 2.65,
    maxDisplacementPx: 6.2,
    overlapGroup: 'right-canopy',
  },
  {
    id: 'canopy-09',
    name: '右上外展叶簇',
    file: '/world-tree-assets/canopy/cluster_09.webp',
    deformMask: '/world-tree-assets/masks/cluster_09_deform.webp',
    type: 'deformable',
    depth: 44,
    bounds: [374, 4, 491, 112],
    anchor: [406, 86],
    offset: [0, 0],
    windWeight: 0.84,
    stiffness: 0.55,
    phaseOffset: 3.05,
    maxDisplacementPx: 7.2,
    overlapGroup: 'right-canopy',
  },
  {
    id: 'canopy-10',
    name: '右中层叠叶簇',
    file: '/world-tree-assets/canopy/cluster_10.webp',
    deformMask: '/world-tree-assets/masks/cluster_10_deform.webp',
    type: 'deformable',
    depth: 41,
    bounds: [368, 64, 491, 166],
    anchor: [396, 128],
    offset: [0, 0],
    windWeight: 0.70,
    stiffness: 0.63,
    phaseOffset: 3.45,
    maxDisplacementPx: 5.8,
    overlapGroup: 'right-canopy',
  },
  {
    id: 'canopy-11',
    name: '右下垂枝叶簇',
    file: '/world-tree-assets/canopy/cluster_11.webp',
    deformMask: '/world-tree-assets/masks/cluster_11_deform.webp',
    type: 'deformable',
    depth: 39,
    bounds: [378, 118, 491, 202],
    anchor: [404, 162],
    offset: [0, 0],
    windWeight: 0.75,
    stiffness: 0.60,
    phaseOffset: 3.85,
    maxDisplacementPx: 6.0,
    overlapGroup: 'right-canopy',
  },
  {
    id: 'canopy-12',
    name: '左下近景小叶簇',
    file: '/world-tree-assets/canopy/cluster_12.webp',
    deformMask: '/world-tree-assets/masks/cluster_12_deform.webp',
    type: 'deformable',
    depth: 52,
    bounds: [68, 128, 198, 202],
    anchor: [176, 156],
    offset: [0, 0],
    windWeight: 0.64,
    stiffness: 0.66,
    phaseOffset: 4.2,
    maxDisplacementPx: 5.0,
    overlapGroup: 'left-canopy',
  },
];

export const GIT_NODES: GitNodeMeta[] = [
  { id: 'node-root-left-01', center: [80, 338], normalizedCenter: [0.1626, 0.8204], radius: 9, defaultColor: '#5efce8', gitRole: 'commit', branchRef: 'root/origin', label: 'Initial Root Commit', pulsePhase: 0.0, pulseSpeed: 0.8 },
  { id: 'node-root-left-02', center: [115, 353], normalizedCenter: [0.2337, 0.8568], radius: 6, defaultColor: '#7df9ff', gitRole: 'commit', branchRef: 'root/origin', label: 'Core Graph Init', pulsePhase: 0.42, pulseSpeed: 0.95 },
  { id: 'node-root-left-03', center: [172, 354], normalizedCenter: [0.3496, 0.8592], radius: 6, defaultColor: '#fde047', gitRole: 'merge', branchRef: 'root/core', label: 'Root Stream Merge', pulsePhase: 0.84, pulseSpeed: 1.1 },
  { id: 'node-root-center-01', center: [241, 320], normalizedCenter: [0.4898, 0.7767], radius: 7, defaultColor: '#fde047', gitRole: 'merge', branchRef: 'main', label: 'Trunk Sap Flow', pulsePhase: 1.26, pulseSpeed: 1.25 },
  { id: 'node-root-right-01', center: [398, 328], normalizedCenter: [0.8089, 0.7961], radius: 7, defaultColor: '#fde047', gitRole: 'branch', branchRef: 'feat/storage', label: 'Sub-root Fork', pulsePhase: 1.68, pulseSpeed: 0.8 },
  { id: 'node-root-right-02', center: [451, 353], normalizedCenter: [0.9167, 0.8568], radius: 9, defaultColor: '#5efce8', gitRole: 'commit', branchRef: 'feat/storage', label: 'Anchor Endpoint', pulsePhase: 2.1, pulseSpeed: 0.95 },
  { id: 'node-trunk-mid-01', center: [302, 288], normalizedCenter: [0.6138, 0.699], radius: 7, defaultColor: '#fde047', gitRole: 'merge', branchRef: 'main', label: 'Main Trunk Convergence', pulsePhase: 2.52, pulseSpeed: 1.1 },
  { id: 'node-trunk-upper-01', center: [350, 220], normalizedCenter: [0.7114, 0.534], radius: 8, defaultColor: '#fde047', gitRole: 'merge', branchRef: 'main', label: 'Primary Crown Split', pulsePhase: 2.94, pulseSpeed: 1.25 },
  { id: 'node-canopy-left-01', center: [148, 160], normalizedCenter: [0.3008, 0.3883], radius: 8, defaultColor: '#fde047', gitRole: 'commit', branchRef: 'feat/ui-graph', label: 'Left Bough Lantern Node', pulsePhase: 0.22, pulseSpeed: 0.8 },
  { id: 'node-canopy-left-02', center: [176, 91], normalizedCenter: [0.3577, 0.2209], radius: 7, defaultColor: '#a3e635', gitRole: 'branch', branchRef: 'feat/ui-graph', label: 'Upper Left Branch Tip', pulsePhase: 0.64, pulseSpeed: 0.95 },
  { id: 'node-canopy-left-03', center: [209, 71], normalizedCenter: [0.4248, 0.1723], radius: 7, defaultColor: '#5efce8', gitRole: 'commit', branchRef: 'feat/ui-graph', label: 'Canopy Leaf Node', pulsePhase: 1.06, pulseSpeed: 1.1 },
  { id: 'node-canopy-inner-01', center: [243, 147], normalizedCenter: [0.4939, 0.3568], radius: 7, defaultColor: '#fde047', gitRole: 'merge', branchRef: 'release/v2', label: 'Inner Fork Junction', pulsePhase: 1.48, pulseSpeed: 1.25 },
  { id: 'node-canopy-center-01', center: [304, 69], normalizedCenter: [0.6179, 0.1675], radius: 8, defaultColor: '#fde047', gitRole: 'commit', branchRef: 'main', label: 'Crown Heart Node', pulsePhase: 1.9, pulseSpeed: 0.8 },
  { id: 'node-canopy-top-01', center: [352, 44], normalizedCenter: [0.7154, 0.1068], radius: 8, defaultColor: '#fef08a', gitRole: 'commit', branchRef: 'main', label: 'Apex Starlight Node', pulsePhase: 2.32, pulseSpeed: 0.95 },
  { id: 'node-canopy-right-01', center: [386, 122], normalizedCenter: [0.7846, 0.2961], radius: 7, defaultColor: '#a3e635', gitRole: 'branch', branchRef: 'feat/mesh-wind', label: 'Right Bough Node', pulsePhase: 2.74, pulseSpeed: 1.1 },
  { id: 'node-canopy-right-02', center: [430, 60], normalizedCenter: [0.874, 0.1456], radius: 8, defaultColor: '#fef08a', gitRole: 'commit', branchRef: 'feat/mesh-wind', label: 'Right Crown Peak', pulsePhase: 0.12, pulseSpeed: 1.25 },
];

export const TIME_OF_DAY_PRESETS: TimeOfDayPreset[] = [
  {
    id: 'dawn',
    name: '清晨 · 破晓薄雾',
    timeRange: '05:30 – 08:30',
    ambientBrightness: 0.92,
    temperature: -0.18,
    glowIntensity: 0.68,
    nodeIntensity: 0.75,
    fogAmount: 0.45,
    backgroundTint: '#112a36',
    skyGradient: ['#0d222e', '#1a3a44'],
    description: '冷青晨雾与柔和斜射晨光，树干流光温润内敛，叶缘泛起清新露水反光。',
  },
  {
    id: 'day',
    name: '白昼 · 林间晴光',
    timeRange: '08:30 – 16:30',
    ambientBrightness: 1.16,
    temperature: 0.15,
    glowIntensity: 0.42,
    nodeIntensity: 0.55,
    fogAmount: 0.12,
    backgroundTint: '#14332e',
    skyGradient: ['#0f2926', '#183f39'],
    description: '提高环境漫反射亮度并适度收敛夜间荧光增益，突出叶片层次与树皮自然体积感。',
  },
  {
    id: 'dusk',
    name: '黄昏 · 暮色流金',
    timeRange: '16:30 – 19:30',
    ambientBrightness: 0.88,
    temperature: 0.52,
    glowIntensity: 0.86,
    nodeIntensity: 0.9,
    fogAmount: 0.28,
    backgroundTint: '#1f1b2c',
    skyGradient: ['#141624', '#2b1e28'],
    description: '暖金与紫暮色温插值，能量脉络与节点脉冲渐次苏醒，营造黄昏过渡氛围。',
  },
  {
    id: 'night',
    name: '夜晚 · 幽林荧光 (母版基准)',
    timeRange: '19:30 – 05:30',
    ambientBrightness: 0.78,
    temperature: -0.05,
    glowIntensity: 1.0,
    nodeIntensity: 1.0,
    fogAmount: 0.22,
    backgroundTint: '#061216',
    skyGradient: ['#040b0e', '#091c22'],
    description: '还原「01 永恒·默认」经典暗夜森林对比度，树干能量线与 Git 节点呈现饱满荧光呼吸。',
  },
];

export const SEASON_THEMES: SeasonThemePack[] = [
  {
    id: 'default',
    code: '01',
    name: '永恒·默认',
    subtitle: 'Yggit 经典青绿荧光世界树',
    panelRefImage: '/world-tree-assets/original/default_world_tree_original.webp',
    canopyOverlayFile: '/world-tree-assets/extracted/tree_full_rgba.webp',
    hueRotateDeg: 0,
    saturate: 1.0,
    veinColor: '#5efce8',
    nodePalette: { commit: '#34d399', branch: '#c084fc', merge: '#fde047' },
    particleType: 'spores',
    particleColor: '#5efce8',
    scheduleRule: '全年默认兜底 (Priority 10)',
    priorityLevel: 10,
  },
  {
    id: 'spring',
    code: '02',
    name: '春·樱花',
    subtitle: '原有枝条绽放粉樱，落英随风',
    panelRefImage: '/world-tree-assets/original/panel_02_spring.webp',
    canopyOverlayFile: '/world-tree-assets/seasons/spring_sakura_rgba.webp',
    hueRotateDeg: 0,
    saturate: 1.05,
    veinColor: '#f472b6',
    nodePalette: { commit: '#f472b6', branch: '#c084fc', merge: '#fde047' },
    particleType: 'petals',
    particleColor: '#fbcfe8',
    scheduleRule: '自动季节：03-01 至 05-15 (Priority 20)',
    priorityLevel: 20,
  },
  {
    id: 'summer',
    code: '03',
    name: '夏·繁盛',
    subtitle: '翠绿繁茂树冠与林间丁达尔阳光',
    panelRefImage: '/world-tree-assets/original/panel_03_summer.webp',
    canopyOverlayFile: '/world-tree-assets/seasons/summer_lush_rgba.webp',
    hueRotateDeg: 0,
    saturate: 1.12,
    veinColor: '#a3e635',
    nodePalette: { commit: '#4ade80', branch: '#38bdf8', merge: '#facc15' },
    particleType: 'fireflies',
    particleColor: '#bef264',
    scheduleRule: '自动季节：05-16 至 08-31 (Priority 20)',
    priorityLevel: 20,
  },
  {
    id: 'autumn',
    code: '04',
    name: '秋·红叶',
    subtitle: '金黄与绯红枫叶层林尽染',
    panelRefImage: '/world-tree-assets/original/panel_04_autumn.webp',
    canopyOverlayFile: '/world-tree-assets/seasons/autumn_maple_rgba.webp',
    hueRotateDeg: 0,
    saturate: 1.08,
    veinColor: '#fb923c',
    nodePalette: { commit: '#fb923c', branch: '#f43f5e', merge: '#fde047' },
    particleType: 'maple',
    particleColor: '#fdba74',
    scheduleRule: '自动季节：09-01 至 11-30 (Priority 20)',
    priorityLevel: 20,
  },
  {
    id: 'winter',
    code: '05',
    name: '冬·霜雪',
    subtitle: '冰晶覆雪枝头与静谧寒霜流光',
    panelRefImage: '/world-tree-assets/original/panel_05_winter.webp',
    canopyOverlayFile: '/world-tree-assets/seasons/winter_frost_rgba.webp',
    hueRotateDeg: 0,
    saturate: 0.95,
    veinColor: '#7dd3fc',
    nodePalette: { commit: '#7dd3fc', branch: '#c084fc', merge: '#e0f2fe' },
    particleType: 'snow',
    particleColor: '#e0f2fe',
    scheduleRule: '自动季节：12-01 至 02-28 (Priority 20)',
    priorityLevel: 20,
  },
  {
    id: 'festival-sakura',
    code: '06',
    name: '节日·夜樱祭',
    subtitle: '春季樱冠叠加锚点挂载暖光灯笼',
    panelRefImage: '/world-tree-assets/original/panel_06_festival.webp',
    canopyOverlayFile: '/world-tree-assets/seasons/festival_night_sakura_rgba.webp',
    decorOverlayFile: '/world-tree-assets/seasons/festival_lanterns_only.webp',
    hueRotateDeg: 0,
    saturate: 1.1,
    veinColor: '#f472b6',
    nodePalette: { commit: '#fb7185', branch: '#e879f9', merge: '#fcd34d' },
    particleType: 'sakura-lantern',
    particleColor: '#fda4af',
    scheduleRule: '节庆活动包：03-25 至 04-10 (Priority 30)',
    priorityLevel: 30,
  },
];
