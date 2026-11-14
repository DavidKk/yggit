import type { GitCommit, GitLogView, GitSelection } from '@/lib/git/types'

/** Sidebar navigation resolves a node without changing the history scope. */
export function gitSelectionHash(view: GitLogView, selection: GitSelection): string {
  switch (selection.kind) {
    case 'local':
      return view.branches.find((item) => item.name === selection.name)?.tip || ''
    case 'remote':
      return view.remotes.find((item) => item.name === selection.name)?.tip || ''
    case 'tag':
      return view.tags.find((item) => item.name === selection.name)?.tip || ''
    case 'stash':
      return view.stashes.find((item) => item.name === selection.name)?.hash || ''
    case 'worktree':
      return view.worktrees.find((item) => item.path === selection.path)?.head || ''
    default:
      return ''
  }
}

function refMatches(ref: string, name: string): boolean {
  return ref === name || ref === `HEAD -> ${name}` || ref === `tag: ${name}`
}

/** Commits in the loaded window that are the named ref or its ancestors. */
export function commitsReachableFromRef(commits: GitCommit[], refName: string): GitCommit[] {
  const byHash = new Map(commits.map((commit) => [commit.hash, commit]))
  const keep = new Set<string>()
  const stack = commits.filter((commit) => commit.refs.some((ref) => refMatches(ref, refName))).map((commit) => commit.hash)
  while (stack.length > 0) {
    const hash = stack.pop()
    if (!hash || keep.has(hash)) continue
    keep.add(hash)
    const commit = byHash.get(hash)
    if (!commit) continue
    for (const parent of commit.parents) {
      if (byHash.has(parent)) stack.push(parent)
    }
  }
  return commits.filter((commit) => keep.has(commit.hash))
}
