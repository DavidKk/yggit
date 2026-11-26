import type { Metadata } from 'next'

import { PRODUCT_DISPLAY_NAME } from '@/constants/brand'
import { type Locale, LOCALE_HTML_LANG, LOCALES } from '@/lib/i18n'

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://yggit.vercel.app').replace(/\/+$/, '')

export const HERO_OG_IMAGE = '/world-tree-assets/hero/hero_day_master_1672x941.webp'

/** Non-default locales exposed as dedicated SEO landing subpaths (`/<locale>`). `/` serves English (`en`). */
export const LANDING_SUBPATH_LOCALES = LOCALES.filter((l): l is Exclude<Locale, 'en'> => l !== 'en')

interface LandingSeoCopy {
  title: string
  description: string
  ogLocale: string
  keywords: string[]
  featureList: string[]
}

const LANDING_SEO_BY_LOCALE: Record<Locale, LandingSeoCopy> = {
  en: {
    title: `${PRODUCT_DISPLAY_NAME} — Open Source AI Git Workspace`,
    description:
      'Explore Git history, visualize branches in an organic World Tree DAG, manage worktrees, and understand your code with Yggi AI. An open-source, local-first Git workspace.',
    ogLocale: 'en_US',
    keywords: [
      'Yggit',
      'Yggdrasil',
      'Git graph visualization',
      'Git DAG client',
      'World Tree Git',
      'local-first Git workbench',
      'AI Git assistant',
      'Workdesk',
      'WebAssembly Git',
      'isomorphic-git',
      'MCP Git tools',
    ],
    featureList: [
      'Organic Life-Tree Git DAG Visualization',
      'Dual-Engine Architecture (Local Native Git + Edge WebAssembly)',
      'Yggi AI Repository Assistant with Spotlight Attribution',
      'Browser WebGPU / WASM Offline LLM & CLI Agent Support',
      '4-Column Adaptive Git Workdesk & Branch Hygiene Diagnostics',
    ],
  },
  zh: {
    title: `${PRODUCT_DISPLAY_NAME} — 生命树架构 Git 图谱与 AI 仓库工作台`,
    description: '让每一次代码提交、分支演进与合并脉络清晰可见。支持本地原生 Git 与浏览器 Edge 双引擎、毫秒级世界树 DAG 渲染、Yggi AI 助手与智能工作台。',
    ogLocale: 'zh_CN',
    keywords: ['Yggit', '世界树 Git', 'Git 图谱', 'Git 可视化', 'Git 客户端', 'DAG 拓扑', 'AI 代码审查', 'Workdesk', 'WebAssembly Git'],
    featureList: [
      '有机生命树 Git DAG 可视化图谱',
      '双引擎原生驱动（本地 Git CLI + 浏览器 Edge）',
      'Yggi AI 仓库助手与 Spotlight 归因巡检',
      '支持浏览器 WebGPU 离线大模型与本地 CLI Agent',
      '四栏自适应工作台与分支健康诊断',
    ],
  },
  cht: {
    title: `${PRODUCT_DISPLAY_NAME} — 生命樹架構 Git 圖譜與 AI 倉庫工作台`,
    description: '讓每一次程式碼提交、分支演進與合併脈絡清晰可見。支援本機原生 Git 與瀏覽器 Edge 雙引擎、毫秒級世界樹 DAG 渲染、Yggi AI 助手與智慧工作台。',
    ogLocale: 'zh_TW',
    keywords: ['Yggit', '世界樹 Git', 'Git 圖譜', 'Git 視覺化', 'Git 客戶端', 'DAG 拓撲', 'AI 程式碼審查', 'Workdesk'],
    featureList: [
      '有機生命樹 Git DAG 視覺化圖譜',
      '雙引擎原生驅動（本機 Git CLI + 瀏覽器 Edge）',
      'Yggi AI 倉庫助手與 Spotlight 歸因巡檢',
      '支援瀏覽器 WebGPU 離線大模型與本機 CLI Agent',
      '四欄自適應工作台與分支健康診斷',
    ],
  },
  ja: {
    title: `${PRODUCT_DISPLAY_NAME} — 有機的な世界樹 Git グラフ & AI リポジトリワークベンチ`,
    description:
      'すべてのコミット、ブランチの進化、マージ履歴を世界樹 DAG で美しく可視化。ローカル Git とブラウザ Edge のデュアルエンジン、Yggi AI アシスタント、Workdesk 診断を搭載。',
    ogLocale: 'ja_JP',
    keywords: ['Yggit', 'Git 可視化', 'Git グラフ', 'Git クライアント', 'DAG', 'AI コードレビュー', 'Workdesk', 'WebAssembly Git'],
    featureList: [
      '有機的な世界樹 Git DAG ビジュアライゼーション',
      'デュアルエンジン（ローカル Git CLI + ブラウザ Edge）',
      'Yggi AI リポジトリアシスタント & Spotlight 診断',
      'ブラウザ WebGPU オフライン LLM & CLI エージェント対応',
      '4カラム適応型 Git Workdesk',
    ],
  },
  ko: {
    title: `${PRODUCT_DISPLAY_NAME} — 세계수 Git 그래프 & AI 저장소 워크벤치`,
    description: '모든 커밋, 브랜치 변화, 병합 계보를 유기적인 세계수 DAG로 시각화하세요. 로컬 Git과 브라우저 Edge 듀얼 엔진, Yggi AI 어시스턴트, Workdesk 진단을 제공합니다.',
    ogLocale: 'ko_KR',
    keywords: ['Yggit', 'Git 시각화', 'Git 그래프', 'Git 클라이언트', 'DAG', 'AI 코드 리뷰', 'Workdesk'],
    featureList: [
      '유기적 세계수 Git DAG 시각화',
      '듀얼 엔진 아키텍처 (로컬 Git CLI + 브라우저 Edge)',
      'Yggi AI 저장소 어시스턴트 및 Spotlight 진단',
      '브라우저 WebGPU 오프라인 LLM 및 CLI 에이전트 지원',
      '4컬럼 적응형 Git Workdesk',
    ],
  },
  fr: {
    title: `${PRODUCT_DISPLAY_NAME} — Graphe Git Arbre-Monde & Atelier IA Local-First`,
    description:
      'Visualisez chaque commit, branche et fusion dans un DAG organique. Moteur hybride Git natif et navigateur Edge, assistant IA Yggi, diagnostics Workdesk et outils MCP.',
    ogLocale: 'fr_FR',
    keywords: ['Yggit', 'Git graph', 'visualisation Git', 'client Git', 'DAG', 'assistant IA Git', 'Workdesk'],
    featureList: [
      'Visualisation DAG Git organique en Arbre-Monde',
      'Double moteur (Git natif local + Edge WebAssembly)',
      'Assistant IA Yggi avec inspection Spotlight',
      'Modèles locaux WebGPU / WASM et agents CLI',
      'Workdesk adaptatif à 4 colonnes',
    ],
  },
  de: {
    title: `${PRODUCT_DISPLAY_NAME} — Organischer Weltenbaum Git-Graph & KI-Workbench`,
    description:
      'Visualisiere Commits, Branches und Merge-Historie als organischen Weltenbaum-DAG. Local-first Git-Client mit Yggi KI-Assistent, Workdesk-Diagnose und MCP-Unterstützung.',
    ogLocale: 'de_DE',
    keywords: ['Yggit', 'Git Graph', 'Git Visualisierung', 'Git Client', 'DAG', 'KI Code Review', 'Workdesk'],
    featureList: [
      'Organische Weltenbaum-Git-DAG-Visualisierung',
      'Dual-Engine (Lokales Git CLI + Edge WebAssembly)',
      'Yggi KI-Assistent mit Spotlight-Analyse',
      'Browser-WebGPU Offline-LLM & CLI-Agenten',
      'Adaptives 4-Spalten Git-Workdesk',
    ],
  },
  es: {
    title: `${PRODUCT_DISPLAY_NAME} — Grafo Git Árbol del Mundo y Mesa de Trabajo IA`,
    description:
      'Visualiza cada commit, rama y fusión en un DAG orgánico. Cliente Git local-first con motor dual nativo y navegador Edge, asistente IA Yggi, Workdesk y soporte MCP.',
    ogLocale: 'es_ES',
    keywords: ['Yggit', 'grafo Git', 'visualización Git', 'cliente Git', 'DAG', 'asistente IA Git', 'Workdesk'],
    featureList: [
      'Visualización orgánica DAG Git Árbol del Mundo',
      'Arquitectura dual (Git nativo local + Edge WebAssembly)',
      'Asistente IA Yggi con inspección Spotlight',
      'LLM offline en navegador WebGPU y agentes CLI',
      'Workdesk adaptativo de 4 columnas',
    ],
  },
  'pt-BR': {
    title: `${PRODUCT_DISPLAY_NAME} — Grafo Git Árvore do Mundo & Workbench com IA`,
    description: 'Visualize cada commit, branch e merge em um DAG orgânico. Cliente Git local-first com motor dual, assistente IA Yggi, diagnósticos Workdesk e suporte a MCP.',
    ogLocale: 'pt_BR',
    keywords: ['Yggit', 'grafo Git', 'visualização Git', 'cliente Git', 'DAG', 'assistente IA Git', 'Workdesk'],
    featureList: [
      'Visualização orgânica DAG Git Árvore do Mundo',
      'Arquitetura dual (Git nativo local + Edge WebAssembly)',
      'Assistente IA Yggi com inspeção Spotlight',
      'LLM offline no navegador WebGPU e agentes CLI',
      'Workdesk adaptativo de 4 colunas',
    ],
  },
  ru: {
    title: `${PRODUCT_DISPLAY_NAME} — Органический граф Git и AI-платформа репозиториев`,
    description:
      'Визуализируйте коммиты, ветки и историю слияний в виде органического дерева DAG. Local-first Git-клиент, AI-ассистент Yggi, диагностика Workdesk и поддержка MCP.',
    ogLocale: 'ru_RU',
    keywords: ['Yggit', 'Git граф', 'визуализация Git', 'Git клиент', 'DAG', 'AI ассистент Git', 'Workdesk'],
    featureList: [
      'Органическая визуализация Git DAG в виде Древа Мира',
      'Двойной движок (локальный Git CLI + браузерный Edge)',
      'AI-ассистент Yggi с инспекцией Spotlight',
      'Офлайн LLM в браузере на WebGPU и CLI-агенты',
      'Адаптивный 4-колоночный Git Workdesk',
    ],
  },
}

export function getLandingLanguageAlternates(): Record<string, string> {
  const languages: Record<string, string> = {
    'x-default': '/',
  }
  for (const locale of LOCALES) {
    languages[LOCALE_HTML_LANG[locale]] = locale === 'en' ? '/' : `/${locale}`
  }
  return languages
}

export function buildLandingMetadata(locale: Locale): Metadata {
  const seo = LANDING_SEO_BY_LOCALE[locale] || LANDING_SEO_BY_LOCALE.en
  const canonicalPath = locale === 'en' ? '/' : `/${locale}`

  return {
    title: {
      absolute: seo.title,
    },
    description: seo.description,
    keywords: seo.keywords,
    authors: [{ name: 'DavidJones', url: 'https://github.com/DavidKk' }],
    creator: 'DavidJones',
    publisher: PRODUCT_DISPLAY_NAME,
    alternates: {
      canonical: canonicalPath,
      languages: getLandingLanguageAlternates(),
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonicalPath,
      siteName: PRODUCT_DISPLAY_NAME,
      images: [
        {
          url: HERO_OG_IMAGE,
          width: 1672,
          height: 941,
          alt: 'Yggit World Tree Git Visualization',
        },
      ],
      locale: seo.ogLocale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: [HERO_OG_IMAGE],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export function buildLandingJsonLd(locale: Locale) {
  const seo = LANDING_SEO_BY_LOCALE[locale] || LANDING_SEO_BY_LOCALE.en
  const pageUrl = locale === 'en' ? SITE_URL : `${SITE_URL}/${locale}`

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: PRODUCT_DISPLAY_NAME,
    url: pageUrl,
    inLanguage: LOCALE_HTML_LANG[locale],
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'macOS, Windows, Linux, Web',
    license: 'https://opensource.org/licenses/MIT',
    codeRepository: 'https://github.com/DavidKk/yggit',
    screenshot: `${SITE_URL}${HERO_OG_IMAGE}`,
    description: seo.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: seo.featureList,
  }
}

export function buildWebSiteJsonLd(locale: Locale) {
  const seo = LANDING_SEO_BY_LOCALE[locale] || LANDING_SEO_BY_LOCALE.en
  const pageUrl = locale === 'en' ? SITE_URL : `${SITE_URL}/${locale}`

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: PRODUCT_DISPLAY_NAME,
    url: pageUrl,
    inLanguage: LOCALE_HTML_LANG[locale],
    description: seo.description,
  }
}
