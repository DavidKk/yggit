export type GitFileKind = 'image' | 'svg' | 'markdown' | 'text' | 'binary'

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif'])
const MARKDOWN = new Set(['md', 'markdown', 'mdx'])

export function gitFileKind(path: string, binary = false): GitFileKind {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  if (ext === 'svg') return 'svg'
  if (MARKDOWN.has(ext)) return 'markdown'
  if (IMAGE.has(ext)) return 'image'
  if (binary) return 'binary'
  return 'text'
}

export function gitBlobUrl(repo: string, hash: string, path: string): string {
  const params = new URLSearchParams({ repo, hash, path })
  return `/api/git/blob?${params.toString()}`
}
