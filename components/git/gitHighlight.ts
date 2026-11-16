import { Marked } from 'marked'
import { type BundledLanguage, bundledLanguages, getSingletonHighlighter, type Highlighter, type SpecialLanguage, type ThemedToken } from 'shiki'

type GitLang = BundledLanguage | SpecialLanguage

/** VS Code–grade TextMate themes matching Yggdrasil palette; pick by `html[data-theme]`. */
const THEME_DARK = 'vitesse-dark'
const THEME_LIGHT = 'vitesse-light'

function activeHighlightTheme(): typeof THEME_DARK | typeof THEME_LIGHT {
  if (typeof document === 'undefined') return THEME_DARK
  return document.documentElement.getAttribute('data-theme') === 'light' ? THEME_LIGHT : THEME_DARK
}

/**
 * Extension → Shiki language. Unknown extensions fall back to `text`.
 * Languages load on demand from Shiki’s full bundle (~300+).
 */
const EXT_LANG: Record<string, BundledLanguage> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  json: 'json',
  jsonc: 'jsonc',
  json5: 'json5',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  styl: 'stylus',
  stylus: 'stylus',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  xml: 'xml',
  svg: 'xml',
  xsl: 'xml',
  xsd: 'xml',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'mdx',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'fish',
  ps1: 'powershell',
  psm1: 'powershell',
  py: 'python',
  pyw: 'python',
  pyi: 'python',
  rb: 'ruby',
  rake: 'ruby',
  gemspec: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',
  hh: 'cpp',
  cs: 'csharp',
  fs: 'fsharp',
  fsx: 'fsharp',
  fsi: 'fsharp',
  php: 'php',
  lua: 'lua',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  conf: 'ini',
  cfg: 'ini',
  env: 'ini',
  properties: 'properties',
  sql: 'sql',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',
  graphql: 'graphql',
  gql: 'graphql',
  diff: 'diff',
  patch: 'diff',
  dockerfile: 'dockerfile',
  zig: 'zig',
  scala: 'scala',
  sc: 'scala',
  dart: 'dart',
  elm: 'elm',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hrl: 'erlang',
  hs: 'haskell',
  lhs: 'haskell',
  ml: 'ocaml',
  mli: 'ocaml',
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  tf: 'terraform',
  hcl: 'hcl',
  proto: 'proto',
  prisma: 'prisma',
  wasm: 'wasm',
  asm: 'asm',
  s: 'asm',
  nim: 'nim',
  cr: 'crystal',
  d: 'd',
  jl: 'julia',
  r: 'r',
  pl: 'perl',
  pm: 'perl',
  groovy: 'groovy',
  gradle: 'groovy',
  cmake: 'cmake',
  nix: 'nix',
  lisp: 'lisp',
  cl: 'lisp',
  scm: 'scheme',
  rkt: 'racket',
  vb: 'vb',
  sol: 'solidity',
  move: 'move',
  coffee: 'coffeescript',
  litcoffee: 'coffeescript',
  wgsl: 'wgsl',
  glsl: 'glsl',
  vert: 'glsl',
  frag: 'glsl',
  hlsl: 'hlsl',
  cu: 'cpp',
  cuh: 'cpp',
  bat: 'bat',
  cmd: 'bat',
  make: 'makefile',
  mk: 'makefile',
  makefile: 'makefile',
  razor: 'razor',
  cshtml: 'razor',
  vbhtml: 'razor',
  resx: 'xml',
  plist: 'xml',
  storyboard: 'xml',
  xib: 'xml',
  bib: 'bibtex',
  tex: 'latex',
  latex: 'latex',
  sty: 'latex',
  cls: 'latex',
  rst: 'rst',
  ado: 'stata',
  do: 'stata',
  sas: 'sas',
  matlab: 'matlab',
  m: 'objective-c',
  mm: 'objective-cpp',
  beancount: 'beancount',
  bean: 'beancount',
  nginx: 'nginx',
  apache: 'apache',
  htaccess: 'apache',
  v: 'v',
  vv: 'v',
  lean: 'lean',
  lean4: 'lean',
  wit: 'wit',
  reg: 'reg',
  http: 'http',
  rest: 'http',
  gherkin: 'gherkin',
  feature: 'gherkin',
  csv: 'csv',
  tsv: 'tsv',
}

const BASE_NAME_LANG: Record<string, BundledLanguage> = {
  dockerfile: 'dockerfile',
  containerfile: 'dockerfile',
  makefile: 'makefile',
  gnumakefile: 'makefile',
  cmakelists: 'cmake',
  'go.mod': 'go',
  'go.sum': 'go',
  gemfile: 'ruby',
  rakefile: 'ruby',
  podfile: 'ruby',
  brewfile: 'ruby',
  vagrantfile: 'ruby',
  procfile: 'yaml',
  'cargo.toml': 'toml',
  'cargo.lock': 'toml',
  'pyproject.toml': 'toml',
  'rust-toolchain.toml': 'toml',
  'tsconfig.json': 'jsonc',
  'jsconfig.json': 'jsonc',
  '.eslintrc': 'json',
  '.babelrc': 'json',
  '.prettierrc': 'json',
  '.firebaserc': 'json',
  cmakecache: 'cmake',
}

let highlighterPromise: Promise<Highlighter> | null = null
const loadingLangs = new Map<string, Promise<void>>()

function highlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = getSingletonHighlighter({
      themes: [THEME_DARK, THEME_LIGHT],
      langs: [],
    })
  }
  return highlighterPromise
}

function isBundledLanguage(id: string): id is BundledLanguage {
  return id in bundledLanguages
}

async function ensureLanguage(engine: Highlighter, lang: GitLang): Promise<GitLang> {
  if (lang === 'text' || lang === 'ansi') return lang
  const loaded = engine.getLoadedLanguages()
  if (loaded.includes(lang)) return lang
  if (!isBundledLanguage(lang)) return 'text'
  let pending = loadingLangs.get(lang)
  if (!pending) {
    pending = engine.loadLanguage(lang).then(() => undefined)
    loadingLangs.set(lang, pending)
  }
  try {
    await pending
    return lang
  } catch {
    loadingLangs.delete(lang)
    return 'text'
  }
}

export function gitHighlightLang(path: string): GitLang {
  const base = (path.split('/').pop() || path).trim().toLowerCase()
  if (!base) return 'text'
  if (BASE_NAME_LANG[base]) return BASE_NAME_LANG[base]
  if (base.startsWith('dockerfile')) return 'dockerfile'
  if (base.endsWith('.cmake')) return 'cmake'
  if (EXT_LANG[base]) return EXT_LANG[base]
  if (isBundledLanguage(base)) return base
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : ''
  if (!ext) return 'text'
  const mapped = EXT_LANG[ext] || EXT_LANG[ext.toLowerCase()]
  if (mapped) return mapped
  if (isBundledLanguage(ext)) return ext
  return 'text'
}

/** Highlight code snippet directly to HTML using Shiki with consistent theme tokens. */
export async function highlightGitCodeHtml(content: string, langOrPath: string, themeMode?: 'light' | 'dark'): Promise<string> {
  const code = content.replace(/\n$/, '')
  const requested = gitHighlightLang(langOrPath)
  const engine = await highlighter()
  const lang = await ensureLanguage(engine, requested)
  const theme = themeMode === 'light' ? THEME_LIGHT : themeMode === 'dark' ? THEME_DARK : activeHighlightTheme()
  try {
    return engine.codeToHtml(code, {
      lang,
      theme,
      transformers: [
        {
          pre(node) {
            delete node.properties.style
          },
        },
      ],
    })
  } catch {
    return engine.codeToHtml(code, {
      lang: 'text',
      theme,
      transformers: [
        {
          pre(node) {
            delete node.properties.style
          },
        },
      ],
    })
  }
}

/** Tokenize a full source string (best grammar quality — keep multi-line blocks together). */
export async function highlightGitCode(content: string, path: string): Promise<ThemedToken[][]> {
  const code = content.replace(/\n$/, '')
  const requested = gitHighlightLang(path)
  const engine = await highlighter()
  const lang = await ensureLanguage(engine, requested)
  const theme = activeHighlightTheme()
  try {
    return engine.codeToTokens(code, { lang, theme }).tokens
  } catch {
    return engine.codeToTokens(code, { lang: 'text', theme }).tokens
  }
}

/** Join lines, highlight as one unit, return one token row per input line. */
export async function highlightGitLines(lines: string[], path: string): Promise<ThemedToken[][]> {
  if (lines.length === 0) return []
  const tokens = await highlightGitCode(lines.join('\n'), path)
  if (tokens.length >= lines.length) return tokens.slice(0, lines.length)
  const padded = tokens.slice()
  while (padded.length < lines.length) padded.push([])
  return padded
}

/**
 * Asynchronously parse markdown and highlight enclosed code fences using Shiki TextMate themes.
 */
export async function renderMarkdownWithHighlight(content: string, themeMode?: 'light' | 'dark'): Promise<string> {
  if (!content) return ''
  const markedInstance = new Marked({
    gfm: true,
    breaks: false,
    async: true,
  })

  markedInstance.use({
    async: true,
    walkTokens: async (token) => {
      if (token.type === 'code') {
        const highlighted = await highlightGitCodeHtml(token.text, token.lang || '', themeMode)
        ;(token as unknown as { highlightedHtml?: string }).highlightedHtml = highlighted
      }
    },
    renderer: {
      code(token) {
        const custom = (token as unknown as { highlightedHtml?: string }).highlightedHtml
        const lang = token.lang ? token.lang.trim().toLowerCase() : ''
        if (custom) {
          return `<div class="git-code-block my-4 overflow-hidden rounded-lg border border-[color-mix(in_oklab,var(--line)_70%,transparent)] bg-[color-mix(in_oklab,var(--panel-2)_75%,var(--inset))] shadow-[0_2px_8px_rgba(0,0,0,0.12)]">${
            lang
              ? `<div class="flex items-center justify-between border-b border-[color-mix(in_oklab,var(--line)_40%,transparent)] bg-[color-mix(in_oklab,var(--panel-2)_95%,transparent)] px-3.5 py-1.5 font-mono text-[11px] font-medium text-ink-soft select-none"><span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-accent/70"></span>${lang}</span></div>`
              : ''
          }<div class="overflow-x-auto p-3.5 font-mono text-[12px] leading-[1.65]">${custom}</div></div>\n`
        }
        return false
      },
      blockquote(token) {
        const match = token.text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\n|\r\n)?([\s\S]*)$/i)
        if (match) {
          const type = match[1].toUpperCase()
          const bodyText = match[2]
          const bodyHtml = this.parser.parse([{ type: 'paragraph', raw: bodyText, text: bodyText, tokens: [{ type: 'text', raw: bodyText, text: bodyText }] }])
          return `<div class="git-alert git-alert-${type.toLowerCase()}" data-alert="${type.toLowerCase()}"><div class="git-alert-title">${type}</div><div class="git-alert-body">${bodyHtml}</div></div>\n`
        }
        return false
      },
    },
  })

  return (await markedInstance.parse(content)) as string
}
