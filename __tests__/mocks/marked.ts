export interface TokenCode {
  type: 'code'
  text: string
  lang?: string
  raw: string
  highlightedHtml?: string
}

export interface MarkedOptions {
  gfm?: boolean
  breaks?: boolean
  async?: boolean
}

export class Marked {
  private hooks: Array<{
    walkTokens?: (token: TokenCode) => Promise<void> | void
    renderer?: {
      code?: (token: TokenCode) => string | false
      blockquote?: (token: { type: string; text: string; raw: string }) => string | false
    }
  }> = []

  public options: MarkedOptions

  constructor(options: MarkedOptions = {}) {
    this.options = options
  }

  use(
    ...plugins: Array<{
      walkTokens?: (token: TokenCode) => Promise<void> | void
      renderer?: {
        code?: (token: TokenCode) => string | false
        blockquote?: (token: { type: string; text: string; raw: string }) => string | false
      }
    }>
  ) {
    this.hooks.push(...plugins)
    return this
  }

  setOptions(options: MarkedOptions) {
    this.options = { ...this.options, ...options }
    return this
  }

  async parse(src: string): Promise<string> {
    let html = src
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
    const matches: Array<{ full: string; lang: string; code: string }> = []
    let match
    while ((match = codeBlockRegex.exec(src)) !== null) {
      matches.push({ full: match[0], lang: match[1], code: match[2].trimEnd() })
    }

    for (const m of matches) {
      const token: TokenCode = { type: 'code', text: m.code, lang: m.lang, raw: m.full }
      for (const h of this.hooks) {
        if (h.walkTokens) {
          await h.walkTokens(token)
        }
      }
      let rendered = ''
      for (const h of this.hooks) {
        if (h.renderer?.code) {
          const res = h.renderer.code(token)
          if (res) {
            rendered = res
            break
          }
        }
      }
      if (!rendered) {
        rendered = `<pre><code class="language-${m.lang}">${m.code}</code></pre>`
      }
      html = html.replace(m.full, rendered)
    }

    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')

    const bqRegex = /(?:^|\n)((?:>[^\n]*(?:\n|$))+)/g
    let bqMatch
    const bqMatches: Array<{ full: string; text: string }> = []
    while ((bqMatch = bqRegex.exec(html)) !== null) {
      const lines = bqMatch[1]
        .split('\n')
        .map((l) => l.replace(/^>\s?/, ''))
        .join('\n')
        .trim()
      bqMatches.push({ full: bqMatch[1], text: lines })
    }
    for (const b of bqMatches) {
      const token = { type: 'blockquote', text: b.text, raw: b.full }
      let rendered = ''
      for (const h of this.hooks) {
        if (h.renderer?.blockquote) {
          const res = h.renderer.blockquote.call(
            {
              parser: {
                parse: (items: Array<{ text?: string }>) => items.map((i) => i.text || '').join(''),
              },
            },
            token
          )
          if (res) {
            rendered = res
            break
          }
        }
      }
      if (rendered) {
        html = html.replace(b.full, rendered)
      }
    }

    return html
  }
}

export const marked = new Marked()
