import { buildSkillsSystemPrompt, matchSkillsForPrompt } from '@/lib/skills/matcher'
import { parseSkillMarkdown } from '@/lib/skills/parser'
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
})
