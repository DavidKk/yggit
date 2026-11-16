export const bundledLanguages = {
  typescript: {},
  ts: {},
  javascript: {},
  js: {},
  jsx: {},
  tsx: {},
  json: {},
  bash: {},
  sh: {},
  shell: {},
  python: {},
  py: {},
  rust: {},
  rs: {},
  go: {},
  markdown: {},
  md: {},
  yaml: {},
  yml: {},
  html: {},
  css: {},
  sql: {},
  diff: {},
}

export const getSingletonHighlighter = jest.fn(async () => ({
  getLoadedLanguages: () => Object.keys(bundledLanguages),
  loadLanguage: jest.fn(async () => {}),
  codeToHtml: (code: string, options: { lang: string; theme: string }) => {
    return `<pre class="shiki ${options.theme}"><code><span class="line"><span style="color:#FF7B72">${code}</span></span></code></pre>`
  },
  codeToTokens: (code: string) => {
    return { tokens: [[{ content: code, color: '#FF7B72' }]] }
  },
}))
