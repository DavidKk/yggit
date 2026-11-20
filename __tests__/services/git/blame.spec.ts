import { parseGitBlame } from '@/services/git/blame'

describe('parseGitBlame', () => {
  it('parses porcelain blame text correctly into line map', () => {
    const raw = `3396b55bc761290d475757211d9f69aa2d11cf88 1 1 2
author DavidJones
author-mail <qowera@gmail.com>
author-time 1763257939
author-tz +0800
committer DavidJones
committer-mail <qowera@gmail.com>
committer-time 1763257939
committer-tz +0800
summary feat: initial commit
filename app/page.tsx
\texport default function Page() {
3396b55bc761290d475757211d9f69aa2d11cf88 2 2
author DavidJones
author-mail <qowera@gmail.com>
author-time 1763257939
author-tz +0800
committer DavidJones
committer-mail <qowera@gmail.com>
committer-time 1763257939
committer-tz +0800
summary feat: initial commit
filename app/page.tsx
\t  return <div>Hello</div>
`
    const map = parseGitBlame(raw)
    expect(map[1]).toBeDefined()
    expect(map[1].line).toBe(1)
    expect(map[1].author).toBe('DavidJones')
    expect(map[1].hash).toBe('3396b55bc761290d475757211d9f69aa2d11cf88')
    expect(map[1].summary).toBe('feat: initial commit')

    expect(map[2]).toBeDefined()
    expect(map[2].line).toBe(2)
    expect(map[2].author).toBe('DavidJones')
  })

  it('handles empty text gracefully', () => {
    const map = parseGitBlame('')
    expect(map).toEqual({})
  })
})
