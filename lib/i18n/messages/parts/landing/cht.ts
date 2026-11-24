import type { LandingMessages } from './types'

export const landingCht: { landing: LandingMessages } = {
  landing: {
    header: {
      gitWorkspace: 'Git 倉庫',
      devStudio: '官網工坊',
      day: '白天',
      night: '暗黑',
      dayAria: '切換至暗黑模式',
      nightAria: '切換至白天模式',
      dayTitle: '目前為白天模式，點擊體驗錯峰平滑過渡至暗黑',
      nightTitle: '目前為暗黑模式，點擊體驗錯峰平滑過渡至白天',
    },
    hero: {
      categoryPill: 'Git 視覺化 · 智慧工作台 · 合併追溯',
      headlinePart1: '每一次提交，',
      headlineHighlight: '都有跡可循。',
      description: '從分支建立到合併提交，以世界樹 DAG 原生拓撲看清代碼演進脈絡，虛擬隊友協同，毫秒級響應，讓複雜的 Git 歷史清晰可見。',
      enterWorkdesk: '進入工作台',
      addLocal: '新增本機倉庫',
      onlineDemo: '線上體驗',
      edgeLocal: 'Edge / 本機',
      webgl60Fps: '60 FPS WebGL',
    },
    card: {
      allRepos: '全部倉庫',
      favorites: '收藏',
      recentlyViewed: '最近造訪',
      workspace: '工作區',
      searchCommits: '搜尋提交',
    },
  },
}
