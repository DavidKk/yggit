import { filterAllowedModels, getModelFilterConflicts, isModelAllowed, matchesModelPattern } from '@/lib/agent/model-filter'

describe('model-filter logic', () => {
  describe('matchesModelPattern', () => {
    it('matches exact model ids case-insensitively', () => {
      expect(matchesModelPattern('gpt-4o', 'GPT-4o')).toBe(true)
      expect(matchesModelPattern('deepseek-chat', 'deepseek-chat')).toBe(true)
      expect(matchesModelPattern('o1', 'o3')).toBe(false)
    })

    it('handles wildcard patterns', () => {
      expect(matchesModelPattern('gpt-*', 'gpt-4o-mini')).toBe(true)
      expect(matchesModelPattern('*-mini', 'gpt-4o-mini')).toBe(true)
      expect(matchesModelPattern('o*', 'o1')).toBe(true)
      expect(matchesModelPattern('o*', 'gpt-4o')).toBe(false)
      expect(matchesModelPattern('*', 'any-model')).toBe(true)
    })
  })

  describe('isModelAllowed', () => {
    it('allows all models when filter is empty', () => {
      const filter = { whitelist: [], blacklist: [] }
      expect(isModelAllowed('gpt-4o', filter)).toBe(true)
      expect(isModelAllowed('deepseek-chat', filter)).toBe(true)
    })

    it('enforces whitelist when specified', () => {
      const filter = { whitelist: ['gpt-4o', 'claude-3-5-sonnet'], blacklist: [] }
      expect(isModelAllowed('gpt-4o', filter)).toBe(true)
      expect(isModelAllowed('claude-3-5-sonnet', filter)).toBe(true)
      expect(isModelAllowed('deepseek-chat', filter)).toBe(false)
    })

    it('enforces blacklist taking priority over whitelist', () => {
      const filter = {
        whitelist: ['gpt-4o', 'o1-mini'],
        blacklist: ['o1-mini'],
      }
      expect(isModelAllowed('gpt-4o', filter)).toBe(true)
      expect(isModelAllowed('o1-mini', filter)).toBe(false)
    })

    it('blocks blacklisted model even when whitelist is empty', () => {
      const filter = {
        whitelist: [],
        blacklist: ['gpt-4*'],
      }
      expect(isModelAllowed('gpt-4o', filter)).toBe(false)
      expect(isModelAllowed('gpt-4o-mini', filter)).toBe(false)
      expect(isModelAllowed('claude-3-5-sonnet', filter)).toBe(true)
    })
  })

  describe('filterAllowedModels', () => {
    it('filters out blacklisted and non-whitelisted items', () => {
      const models = [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
        { id: 'deepseek-chat', name: 'DeepSeek Chat' },
        { id: 'o1', name: 'o1' },
      ]
      const filter = {
        whitelist: ['gpt-*'],
        blacklist: ['gpt-4o-mini'],
      }
      const allowed = filterAllowedModels(models, filter)
      expect(allowed.map((m) => m.id)).toEqual(['gpt-4o'])
    })
  })

  describe('getModelFilterConflicts', () => {
    it('detects models present in both lists', () => {
      const filter = {
        whitelist: ['gpt-4o', 'o1', 'claude-3-5-sonnet'],
        blacklist: ['o1', 'deepseek-chat'],
      }
      expect(getModelFilterConflicts(filter)).toEqual(['o1'])
    })
  })
})
