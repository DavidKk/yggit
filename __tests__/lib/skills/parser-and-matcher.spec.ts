import { buildSkillsSystemPrompt, matchSkillsForPrompt } from '@/lib/skills/matcher'
import { parseSkillMarkdown } from '@/lib/skills/parser'
import { checkAndUpdateGitHubSkill, discoverSkillsFromGitHub } from '@/lib/skills/providers/github-provider'
import type { SkillDescriptor } from '@/lib/skills/types'

describe('Agent Skills Parser & Matcher', () => {
  it('parses standard SKILL.md with YAML frontmatter', () => {
    const raw = `---
name: Go Concurrency Review
description: Guidelines for detecting race conditions and goroutine leaks in Go code.
author: Security Team
version: 1.2.0
---

# Go Concurrency Review Workflow

1. Check for shared state without mutex protection.
2. Ensure channels are closed properly.
`
    const parsed = parseSkillMarkdown(raw)
    expect(parsed.name).toBe('Go Concurrency Review')
    expect(parsed.description).toBe('Guidelines for detecting race conditions and goroutine leaks in Go code.')
    expect(parsed.metadata.author).toBe('Security Team')
    expect(parsed.metadata.version).toBe('1.2.0')
    expect(parsed.body).toContain('1. Check for shared state without mutex protection.')
  })

  it('falls back to markdown headings when frontmatter is absent', () => {
    const raw = `# Performance Optimization Guide

Focus on memory allocations and database indexes.
`
    const parsed = parseSkillMarkdown(raw)
    expect(parsed.name).toBe('Performance Optimization Guide')
    expect(parsed.description).toBe('Focus on memory allocations and database indexes.')
  })

  it('matches skills based on user prompt semantics', () => {
    const skills: SkillDescriptor[] = [
      {
        id: 'review-skill',
        name: 'Code Review Standards',
        description: 'Code review guidelines for Git commits.',
        source: { type: 'builtin', uri: 'builtin://cr' },
        content: 'Review carefully.',
        enabled: true,
        trusted: true,
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'conflict-skill',
        name: 'Conflict Diagnosis',
        description: 'Resolves 3-way git conflicts.',
        source: { type: 'builtin', uri: 'builtin://conflict' },
        content: 'Reconcile 3-way diffs.',
        enabled: true,
        trusted: true,
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'disabled-skill',
        name: 'Disabled Review',
        description: 'Should not match when disabled.',
        source: { type: 'builtin', uri: 'builtin://disabled' },
        content: 'Disabled.',
        enabled: false,
        trusted: true,
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const matchedForCr = matchSkillsForPrompt('请帮我 review feature/login 分支的代码', skills)
    expect(matchedForCr.some((s) => s.id === 'review-skill')).toBe(true)
    expect(matchedForCr.some((s) => s.id === 'disabled-skill')).toBe(false)

    const matchedForConflict = matchSkillsForPrompt('master 和 feature 有冲突，请帮我分析 merge base', skills)
    expect(matchedForConflict.some((s) => s.id === 'conflict-skill')).toBe(true)

    const promptText = buildSkillsSystemPrompt(matchedForCr)
    expect(promptText).toContain('[Active Agent Skills]')
    expect(promptText).toContain('Review carefully.')
  })

  describe('GitHub Provider discovery & update', () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('discovers multiple skills from GitHub tree API', async () => {
      globalThis.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/git/trees/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tree: [
                { path: 'agent-skills/go/code-review/SKILL.md', type: 'blob' },
                { path: 'agent-skills/frontend/react-review/SKILL.md', type: 'blob' },
                { path: 'README.md', type: 'blob' },
              ],
            }),
          } as Response)
        }
        if (url.includes('code-review')) {
          return Promise.resolve({
            ok: true,
            text: async () => '---\nname: Go Review\ndescription: Go review skill\n---\n# Guidelines',
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          text: async () => '---\nname: React Review\ndescription: React review skill\n---\n# Guidelines',
        } as Response)
      })

      const skills = await discoverSkillsFromGitHub({
        repo: 'owner/agent-skills',
        directory: 'agent-skills',
      })

      expect(skills).toHaveLength(2)
      expect(skills[0].name).toBe('Go Review')
      expect(skills[1].name).toBe('React Review')
    })

    it('checks and updates GitHub skill when content changes', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => '---\nname: Go Review v2\ndescription: Updated description\n---\n# New Guidelines',
      } as Response)

      const existingSkill: SkillDescriptor = {
        id: 'gh_owner_repo_skill',
        name: 'Go Review',
        description: 'Old description',
        source: {
          type: 'github',
          uri: 'https://github.com/owner/repo',
          branch: 'main',
          directory: 'skills/go',
        },
        content: '---\nname: Go Review\ndescription: Old description\n---\n# Guidelines',
        enabled: true,
        trusted: true,
        createdAt: 0,
        updatedAt: 0,
      }

      const updateCheck = await checkAndUpdateGitHubSkill(existingSkill)
      expect(updateCheck.hasUpdate).toBe(true)
      expect(updateCheck.updatedSkill?.name).toBe('Go Review v2')
      expect(updateCheck.updatedSkill?.description).toBe('Updated description')
    })
  })
})
