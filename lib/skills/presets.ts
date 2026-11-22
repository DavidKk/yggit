import type { SkillDescriptor } from './types'

export const PRESET_SKILLS: SkillDescriptor[] = [
  {
    id: 'builtin_git_code_review',
    name: 'Git Code Review',
    description: 'Expert standards for reviewing Git commits, pull requests, concurrency safety, error handling, and diff impact.',
    source: {
      type: 'builtin',
      uri: 'builtin://skills/git-code-review',
    },
    content: `---
name: Git Code Review
description: Expert standards for reviewing Git commits, pull requests, concurrency safety, error handling, and diff impact.
---

# Git Code Review Workflow

When reviewing Git changes, diffs, or branches:
1. **Understand Intent**: Inspect the commit message or PR objective before reviewing code.
2. **Architecture & Scope**: Verify that changes stay focused on the stated goal and do not introduce unrelated modifications.
3. **Correctness & Safety**: Check edge cases, nullability, boundary checks, resource leaks, and concurrency races.
4. **Code Cleanliness**: Ensure variable naming is meaningful, functions are single-responsibility, and dead code is removed.
5. **Actionable Feedback**: Format findings with specific file names, line numbers, severity, and suggested solutions.
`,
    enabled: true,
    trusted: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'builtin_conflict_resolution',
    name: 'Git Conflict Analysis',
    description: 'Methodical 3-way conflict diagnosis, finding common ancestors, comparing ours vs theirs, and safe reconciliation.',
    source: {
      type: 'builtin',
      uri: 'builtin://skills/conflict-analysis',
    },
    content: `---
name: Git Conflict Analysis
description: Methodical 3-way conflict diagnosis, finding common ancestors, comparing ours vs theirs, and safe reconciliation.
---

# Git Conflict Analysis Guide

When diagnosing merge or rebase conflicts:
1. Identify the **Common Merge Base**: Determine what code existed before both branches diverged.
2. Compare **Ours (Current Branch)** and **Theirs (Incoming Branch)** against the common base to isolate specific logical changes.
3. Beware of semantic conflicts where two changes do not overlap textually but conflict logically (e.g. signature changes or renamed variables).
4. Provide structured conflict resolution recommendations showing the reconciled output clearly.
`,
    enabled: true,
    trusted: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'builtin_commit_linter',
    name: 'Conventional Commits Crafting',
    description: 'Guidelines for generating high-quality Conventional Commit messages with clear scopes and concise imperative mood.',
    source: {
      type: 'builtin',
      uri: 'builtin://skills/commit-linter',
    },
    content: `---
name: Conventional Commits Crafting
description: Guidelines for generating high-quality Conventional Commit messages with clear scopes and concise imperative mood.
---

# Conventional Commit Standards

Follow these rules for commit messages:
1. Format: \`<type>(<optional scope>): <subject>\`
2. Types: \`feat\`, \`fix\`, \`docs\`, \`style\`, \`refactor\`, \`perf\`, \`test\`, \`chore\`.
3. Subject must be written in English, using the imperative present tense (e.g., "add", not "added" or "adds").
4. Never end subject line with a period. Keep header within 72-100 characters.
`,
    enabled: true,
    trusted: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'builtin_project_categorizer',
    name: 'Project Organization & Taxonomy',
    description: 'Guidelines and heuristics for analyzing repository paths, remotes, and architecture domains to clean up bloated project folders into structured groups.',
    source: {
      type: 'builtin',
      uri: 'builtin://skills/project-categorizer',
    },
    content: `---
name: Project Organization & Taxonomy
description: Guidelines and heuristics for analyzing repository paths, remotes, and architecture domains to clean up bloated project folders into structured groups.
---

# Project Organization & Categorization Guide

When assisting users with project catalog cleanup, folder restructuring, or organizing bloated groups:
1. **Analyze Existing Catalog**: Call \`analyze_project_groups\` to inspect the project list, common physical path prefixes, and Git remote namespaces.
2. **Present Clear Proposal**: Present the proposed groups in a structured Markdown table, explaining the rationale for each cluster (e.g. Backend Services, Frontend Apps & Editors, Plugins & Components, Infrastructure, Worktrees).
3. **Execution Guard**: Explicitly ask the user for confirmation before executing. Once approved, call \`apply_project_grouping\` with the proposed folder names and project moves.
4. **Safety Verification**: Ensure no disk operations are performed; only Yggit project catalog metadata is modified.
`,
    enabled: true,
    trusted: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
]
