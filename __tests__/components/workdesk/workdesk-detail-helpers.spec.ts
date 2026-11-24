import { getCrAnalysis, getItemCardSummary, getItemProblemTitle } from '@/components/workdesk/workdesk-detail-helpers'
import type { WorkItem } from '@/lib/workdesk/types'

describe('workdesk-detail-helpers', () => {
  const dummyItem: WorkItem = {
    id: 'item-1',
    cardId: 'merge-diverged-branches',
    name: 'feature/test',
    repoId: 'repo-1',
    repoAlias: 'MyRepo',
    summary: '领先 3 / 落后 5，需要合流',
    state: 'warn',
    findingIds: [],
  }

  describe('getCrAnalysis', () => {
    it('returns Chinese analysis by default', () => {
      const cr = getCrAnalysis('merge-diverged-branches', dummyItem)
      expect(cr.cause).toContain('分叉')
      expect(cr.risk).toContain('强制推送')
      expect(cr.suggestion).toContain('变基')
      expect(cr.solution).toContain('git fetch origin')
    })

    it('returns English analysis when locale starts with en', () => {
      const cr = getCrAnalysis('merge-diverged-branches', dummyItem, 'en')
      expect(cr.cause).toContain('Local branch has unpushed commits')
      expect(cr.risk).toContain('Direct force-pushing risks')
      expect(cr.suggestion).toContain('Fetch remote changes and rebase')
      expect(cr.solution).toContain('git fetch origin')
    })

    it('supports syncDefaultBranches card', () => {
      const crZh = getCrAnalysis('sync-default-branches', dummyItem, 'zh')
      expect(crZh.cause).toContain('默认分支')
      const crEn = getCrAnalysis('sync-default-branches', dummyItem, 'en')
      expect(crEn.cause).toContain('Remote default branch has new features')
    })

    it('supports worktreeParallelDev card', () => {
      const crZh = getCrAnalysis('worktree-parallel-dev', dummyItem, 'zh')
      expect(crZh.cause).toContain('Worktree')
      const crEn = getCrAnalysis('worktree-parallel-dev', dummyItem, 'en')
      expect(crEn.cause).toContain('Separate worktrees')
    })

    it('supports standardProjectOrganization card', () => {
      const crZh = getCrAnalysis('standard-project-organization', dummyItem, 'zh')
      expect(crZh.cause).toContain('单一分组')
      const crEn = getCrAnalysis('standard-project-organization', dummyItem, 'en')
      expect(crEn.cause).toContain('Too many repositories accumulated')
    })

    it('supports standardRepoHygiene card', () => {
      const crZh = getCrAnalysis('standard-repo-hygiene', dummyItem, 'zh')
      expect(crZh.cause).toContain('分支命名')
      const crEn = getCrAnalysis('standard-repo-hygiene', dummyItem, 'en')
      expect(crEn.cause).toContain('Current branch name does not adhere')
    })

    it('supports reviewPendingCommits card', () => {
      const crZh = getCrAnalysis('code-review-pending-push', dummyItem, 'zh')
      expect(crZh.cause).toContain('已生成新提交')
      const crEn = getCrAnalysis('code-review-pending-push', dummyItem, 'en')
      expect(crEn.cause).toContain('Local commits or staged changes exist')
    })

    it('falls back to generic analysis for unknown card IDs', () => {
      const crZh = getCrAnalysis('unknown-card', dummyItem, 'zh')
      expect(crZh.cause).toContain('偏差')
      const crEn = getCrAnalysis('unknown-card', dummyItem, 'en')
      expect(crEn.cause).toContain('Deviations from standard collaborative workflows')
    })
  })

  describe('getItemCardSummary', () => {
    it('extracts ahead/behind in Chinese format', () => {
      expect(getItemCardSummary('领先 2 / 落后 6，建议合流')).toBe('领先 2 / 落后 6')
      expect(getItemCardSummary('领先 3')).toBe('领先 3')
      expect(getItemCardSummary('落后 4')).toBe('落后 4')
    })

    it('extracts ahead/behind in English format', () => {
      expect(getItemCardSummary('ahead 2 / behind 6, please merge')).toBe('ahead 2 / behind 6')
      expect(getItemCardSummary('ahead 5')).toBe('ahead 5')
      expect(getItemCardSummary('behind 3')).toBe('behind 3')
    })

    it('falls back to first clause when no ahead/behind pattern is found', () => {
      expect(getItemCardSummary('存在未清理的工作树，占用空间过多')).toBe('存在未清理的工作树')
      expect(getItemCardSummary('Uncommitted changes detected, please verify')).toBe('Uncommitted changes detected')
    })
  })

  describe('getItemProblemTitle', () => {
    const mockT = jest.fn((key: string) => `trans:${key}`)

    it('maps known card types to corresponding translation keys', () => {
      expect(getItemProblemTitle('merge-diverged-branches', dummyItem, mockT as any)).toBe('trans:workdesk.problemTitles.merge')
      expect(getItemProblemTitle('sync-default-branches', dummyItem, mockT as any)).toBe('trans:workdesk.problemTitles.sync')
      expect(getItemProblemTitle('worktree-parallel-dev', dummyItem, mockT as any)).toBe('trans:workdesk.problemTitles.worktree')
      expect(getItemProblemTitle('standard-project-organization', dummyItem, mockT as any)).toBe('trans:workdesk.problemTitles.organization')
      expect(getItemProblemTitle('standard-repo-hygiene', dummyItem, mockT as any)).toBe('trans:workdesk.problemTitles.standard')
      expect(getItemProblemTitle('code-review-pending-push', dummyItem, mockT as any)).toBe('trans:workdesk.problemTitles.review')
    })

    it('falls back to item summary clause or default key for unknown cards', () => {
      const itemWithClause: WorkItem = { ...dummyItem, summary: '自定义问题描述，详细信息' }
      expect(getItemProblemTitle('unknown-card', itemWithClause, mockT as any)).toBe('自定义问题描述')

      const itemEmpty: WorkItem = { ...dummyItem, summary: '' }
      expect(getItemProblemTitle('unknown-card', itemEmpty, mockT as any)).toBe('trans:workdesk.problemTitles.default')
    })
  })
})
