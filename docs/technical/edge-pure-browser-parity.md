# Technical Design: Edge Pure-Browser Parity & Conflict Detection

## 1. Architecture Overview

In `Edge` mode, the frontend must run identically on `http://localhost:3001` and `https://yggit.vercel.app`. All Git data paths go through `EdgeGitDriver` or pure-browser helpers without touching `/api/git/*`.

```text
UI (GitLogPage / GitFileDiff / useMergeConflicts)
  ├── getDriverMode() === 'local' ──▶ LocalGitDriver ──▶ /api/git/* (Node + git CLI)
  └── getDriverMode() === 'edge'  ──▶ EdgeGitDriver
        ├── edge_* handle ──▶ EdgeRepositoryReader (handle-fs + isomorphic-git + edge-conflicts)
        └── github.com/*  ──▶ remote-provider.ts (GitHub REST + raw.githubusercontent.com)
```

## 2. Module Changes

### 2.1 `lib/git/driver/edge-driver.ts`

- Remove `LocalGitDriver` (`this.companion`) completely.
- `resolveRepo(repo)`: resolves only from `edge_` handle IDs, IndexedDB Edge catalog, or `parseGitHubRepo(repo)`.
- Pure-browser `isomorphic-git` implementations for:
  - `readLog`, `readCommitDiff`, `readBlob`, `readFileHistory`
  - `checkoutBranch`, `createBranch`, `deleteBranch`, `stage`, `unstage`, `commit`, `createTag`, `deleteTag`
  - `getRemotes`, `getRemoteUrl`, `addRemote`, `setRemoteUrl`, `renameRemote`, `removeRemote`, `pull`, `fetch`
  - `detectConflictsBatch`, `readRemergeDiff`
- Unsupported pure-browser operations (`renameBranch`, `mergeBranch`, `rebaseBranch`, `cherryPick`, `undo`, `redo`, `ignorePattern`, `createFile`, `deleteFile`, `discard`, `push`, `stash`, `addWorktree`) throw a clear `unsupportedInEdge` error.

### 2.2 `lib/git/driver/edge-conflicts.ts`

- **Candidate discovery (`findCandidateConflictFiles`)**:
  - Uses `git.findMergeBase({ fs, dir: '/', oids: [p1, p2], cache })` to locate the merge base commit.
  - Walks `[p1, p2, hash, base?]` via `git.walk` and collects files where `oursSha !== theirsSha` and (if `baseSha` exists) `oursSha !== baseSha && theirsSha !== baseSha`.
- **3-way conflict detection (`detectThreeWayConflicts`)**:
  - Uses `structuredPatch` (`diff` package) with `context: 0` on `(base, ours)` and `(base, theirs)` to extract modified line ranges (`HunkRange`).
  - Overlapping hunks with differing changes are flagged as conflict regions and formatted into standard `<<<<<<<` / `=======` / `>>>>>>>` hunks for `conflictRegions(...)` in `GitFileDiff.tsx`.
  - Binary or missing-side changes are counted as `1` structural conflict.
  - Checks `containsConflictMarkers` on the committed blob at `hash` to populate `unresolvedConflictFiles`.

### 2.3 `lib/git/conflict-cache.ts`

- `isEdgeDriverActive()` checks `localStorage.getItem('yggit.driver_mode')` and `NEXT_PUBLIC_YGGIT_TARGET === 'cloud'`.
- When `isEdgeDriverActive()` is true:
  - `queryConflictsBatch` delegates to `EdgeGitDriver.detectConflictsBatch` (dynamically imported to avoid circular dependencies) and caches results in IndexedDB.
  - `fetchRemergeDiff` delegates to `EdgeGitDriver.readRemergeDiff`.

### 2.4 UI Direct-Fetch Cleanups

- `components/git/GitFileDiff.tsx`: replace `fetch('/api/git/blob?...')` with `getGitDriver().readBlob({ repo, hash: h, path })`.
- `components/git/hooks/useGitLogAutoSync.ts`: skip `new EventSource('/api/git/watch?...')` when `getDriverMode() === 'edge'`.
- `components/git/sidebar/SidebarModals.tsx`: guard `handleSetUpstream` in Edge mode with a clear unsupported message instead of calling `/api/git/remote`.
- `components/git/hooks/useGitProjectActions.ts`: in Edge mode, `addRemote` / `cloneProject` must not silently call `/api/git/projects` or `/api/git/clone`.

## 3. Verification Plan

1. Unit tests in `__tests__/lib/git/edge-conflicts.spec.ts` covering overlapping conflicts, non-overlapping edits, and identical edits.
2. Full `pnpm ok` check (lint, typecheck, 92 Jest suites, Next.js build).
3. Playwright MCP verification on `http://localhost:3001` in `Edge` mode verifying zero `/api/git/*` requests and working commit + conflict inspection.
