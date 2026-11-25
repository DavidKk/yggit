import type { RepositoryPersistence } from '@/lib/git/resolver'
import type { GitLogView, GitSelection } from '@/lib/git/types'

export type GitLogPageProps = {
  initial: GitLogView | { error: string; repo: string }
  initialCommitHash?: string
  initialFilePath?: string
  initialPersistence?: RepositoryPersistence
}

export const SIDEBAR_MIN = 200
export const TREE_MIN = 220
export const MAIN_MIN = 240

export function isGitSelection(value: unknown): value is GitSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as { kind?: unknown; name?: unknown; path?: unknown }
  if (item.kind === 'all') return true
  if (item.kind === 'local' || item.kind === 'remote' || item.kind === 'tag' || item.kind === 'stash') return typeof item.name === 'string'
  if (item.kind === 'worktree') return typeof item.path === 'string'
  return false
}

export function isError(value: GitLogPageProps['initial']): value is { error: string; repo: string } {
  return 'error' in value
}

export function repoName(path: string, displayPath?: string): string {
  const target = displayPath || path
  const parts = target.split('/').filter(Boolean)
  return parts[parts.length - 1] || target
}

export function selectionFor(view: GitLogView): GitSelection {
  const current = view.branches.find((branch) => branch.current) || view.branches.find((branch) => branch.name === view.branch)
  return current ? { kind: 'local', name: current.name } : { kind: 'all' }
}

export function highlightOf(view: GitLogView, selection: GitSelection): string {
  if (selection.kind === 'local' || selection.kind === 'remote' || selection.kind === 'tag' || selection.kind === 'stash') return selection.name
  if (selection.kind === 'worktree') return view.worktrees.find((entry) => entry.path === selection.path)?.branch || ''
  return ''
}
