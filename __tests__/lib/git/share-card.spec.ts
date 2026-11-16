import { formatIssueShareCard, makeIssueShareUrl } from '@/lib/git/share-card'
import type { GitCommit } from '@/lib/git/types'

describe('share-card', () => {
  const sampleCommit: GitCommit = {
    hash: '7f0b0d8a12345678',
    short: '7f0b0d8',
    parents: ['c1', 'c2'],
    author: 'David',
    date: '2026-11-15T12:00:00Z',
    refs: [],
    subject: "Merge branch 'feature/pay' into main",
  }

  it('generates precision issue share URL with file and lines', () => {
    const url = makeIssueShareUrl({
      repoName: 'billing',
      repoPathOrUrl: '/Users/david/dev/billing',
      remoteUrl: 'https://github.com/my-org/billing.git',
      commit: sampleCommit,
      file: 'src/pay.ts',
      lines: '42-58',
    })

    expect(url).toBe('/git/github/my-org/billing/commit/7f0b0d8a12345678?file=src%2Fpay.ts#L42-58')
  })

  it('formats structured markdown issue share card', () => {
    const fullUrl = 'https://yggit.dev/git/github/my-org/billing/commit/7f0b0d8a12345678?file=src%2Fpay.ts#L42-58'
    const card = formatIssueShareCard(
      {
        repoName: 'billing',
        repoPathOrUrl: '/Users/david/dev/billing',
        remoteUrl: 'https://github.com/my-org/billing.git',
        commit: sampleCommit,
        file: 'src/pay.ts',
        lines: '42-58',
        topology: {
          isMerge: true,
          highlightHashes: [],
          sourceBranchHint: 'feature/pay',
          targetBranchHint: 'main',
          commitsIncluded: ['c2'],
        },
      },
      fullUrl
    )

    expect(card.markdown).toContain('🔍 **[Yggit 代码问题排查]**')
    expect(card.markdown).toContain('- **提交**：`7f0b0d8`')
    expect(card.markdown).toContain('- **合并脉络**：`feature/pay` ➔ `main`')
    expect(card.markdown).toContain('- **问题文件**：`src/pay.ts` (L42-58)')
    expect(card.markdown).toContain(fullUrl)
  })
})
