import { gitHighlightLang, renderMarkdownWithHighlight } from '@/components/git/gitHighlight'

describe('renderMarkdownWithHighlight', () => {
  it('highlights code blocks with syntax coloring and shiki tokens', async () => {
    const md = `
# Section

\`\`\`typescript
export type EvidenceLevel = 'fact' | 'derived' | 'hypothesis'
export interface Annotation {
  id: string
}
\`\`\`
`
    const htmlDark = await renderMarkdownWithHighlight(md, 'dark')
    expect(htmlDark).toContain('<h1')
    expect(htmlDark).toContain('Section</h1>')
    expect(htmlDark).toContain('class="shiki github-dark-default"')
    expect(htmlDark).toContain('style="color:')
    expect(htmlDark).toContain('EvidenceLevel')

    const htmlLight = await renderMarkdownWithHighlight(md, 'light')
    expect(htmlLight).toContain('class="shiki github-light-default"')
    expect(htmlLight).toContain('style="color:')
  })

  it('safely handles untagged or unknown language blocks', async () => {
    const md = `
\`\`\`
plain untagged text
\`\`\`

\`\`\`unknownlang404
some custom code
\`\`\`
`
    const html = await renderMarkdownWithHighlight(md, 'dark')
    expect(html).toContain('plain untagged text')
    expect(html).toContain('some custom code')
    expect(html).toContain('<pre')
  })

  it('correctly maps file paths and bare language tags with gitHighlightLang', () => {
    expect(gitHighlightLang('file.ts')).toBe('typescript')
    expect(gitHighlightLang('file.tsx')).toBe('tsx')
    expect(gitHighlightLang('typescript')).toBe('typescript')
    expect(gitHighlightLang('ts')).toBe('typescript')
    expect(gitHighlightLang('json')).toBe('json')
    expect(gitHighlightLang('bash')).toBe('bash')
    expect(gitHighlightLang('sh')).toBe('bash')
    expect(gitHighlightLang('unknown-xyz-123')).toBe('text')
  })
})
