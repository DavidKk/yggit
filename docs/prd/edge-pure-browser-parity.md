# PRD: Edge Pure-Browser Parity & Local Folder Conflict Support

## 1. Background & Core Principle

**Core Principle**: `Edge` mode on `http://localhost:3001` MUST behave **100% identically** to `https://yggit.vercel.app` (Vercel production).

Previously, switching to `Edge` mode on `localhost:3001` silently invoked `this.companion` (`LocalGitDriver`) and direct `/api/git/*` endpoints, which hit the local Node.js + system `git` server on `localhost` while failing (400/404/empty) on Vercel. This created false confidence during local testing and broke pure-browser workflows such as viewing merge conflicts in locally mounted `edge_` folders.

## 2. Audited Issues

| #   | Area                                           | Problem                                                                                                                                                 | Impact                                                                                    |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `lib/git/driver/edge-driver.ts`                | `EdgeGitDriver` called `this.companion` (`/api/git/*`) in 35+ methods (`readLog`, `readCommitDiff`, `readBlob`, `commit`, `stage`, `getProjects`, etc.) | Local Edge mode secretly ran Local server `git` commands instead of browser logic         |
| 2   | `lib/git/conflict-cache.ts`                    | `queryConflictsBatch` and `fetchRemergeDiff` always called `/api/git/conflicts`                                                                         | Merge conflict badges and 3-way conflict diffs were missing in Edge mode                  |
| 3   | `components/git/GitFileDiff.tsx`               | 3-way conflict loader directly called `fetch('/api/git/blob?...')` instead of `getGitDriver().readBlob(...)`                                            | Opening 3-way conflict diff for `edge_` folders failed on Vercel                          |
| 4   | `components/git/hooks/useGitLogAutoSync.ts`    | Opened `new EventSource('/api/git/watch?...')` even in Edge mode                                                                                        | Produced 404 console/network errors on Vercel                                             |
| 5   | `components/git/sidebar/SidebarModals.tsx`     | `handleSetUpstream` directly called `fetch('/api/git/remote')`                                                                                          | Bypassed driver abstraction in Edge mode                                                  |
| 6   | `components/git/hooks/useGitProjectActions.ts` | `chooseFolder` / `addRemote` / `cloneProject` could call `/api/pick`, `/api/git/projects`, `/api/git/clone` in Edge mode                                | Failed with server errors on Vercel when `showDirectoryPicker` was unavailable or cloning |
| 7   | `components/git/GitAssociateRepoGuide.tsx`     | Local path association called `/api/pick` and `/api/git/projects`                                                                                       | Should be strictly gated to `local` mode                                                  |

## 3. Requirements

### R1. Zero Server `/api/git/*` Calls in Edge Mode

- In `Edge` mode (`getDriverMode() === 'edge'`), **no** Git read/write/watch/conflict/blob operation may call `/api/git/*` or `/api/pick`.
- `EdgeGitDriver` must operate exclusively via:
  - Browser File System Access API (`EdgeRepositoryReader` + `handle-fs` + `isomorphic-git` + IndexedDB) for `edge_` local folder handles.
  - Public GitHub REST/Raw APIs (`services/git/remote-provider.ts`) for public remote URLs.
- Operations not supported in pure browser (e.g., `mergeBranch`, `rebaseBranch`, `cherryPick`, `undo`, `redo`, `stash`, `worktree`, `push`, `clone`) must fail fast with a clear message instructing the user to switch to `Local` mode.

### R2. Pure-Browser Merge Conflict Detection & 3-Way Diff for Local Folders

- When a local Git folder is opened in Edge mode (`edge_` handle):
  - Detect conflicted historical merge commits (`parents.length >= 2`) in pure browser without `/api/git/conflicts`.
  - Display conflict badges, conflict file counts, and unresolved conflict indicators in the commit graph and commit panel.
  - Support 3-way conflict diff and remerge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) in `GitFileDiff` using `getGitDriver().readBlob(...)` and pure-browser remerge diff generation.

### R3. Verification & Acceptance Criteria

- `pnpm ok` passes (Prettier, ESLint `--max-warnings=0`, TypeScript, all Jest tests, Next.js build).
- Playwright MCP verification on `http://localhost:3001` in `Edge` mode confirms **zero** `/api/git/*` network requests during Git browsing, commit selection, conflict inspection, and file diffing.
