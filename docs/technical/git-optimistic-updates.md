# Git Optimistic Updates & Incremental UI Specification

This document tracks which Git and repository-management actions use **Optimistic UI** (immediate UI update + queued background persistence + rollback on failure), which use **Post-Ack Incremental Updates**, and which must **never** be optimistic.

---

## 1. Design Principles & Guardrails

1. **Mode-Agnostic Unified UI Path (Local & Edge Parity)**
   - Optimistic state transitions live strictly above `IGitDriver` (`getGitDriver()`), never behind `if (mode === 'edge')` branches. Both **Local** (HTTP + Git CLI child process) and **Edge** (`FileSystemDirectoryHandle` + `isomorphic-git`) share the exact same optimistic transition, FIFO queue, rollback, and incremental reconciliation paths.
   - Local operations also benefit directly (spawning `/api/git/sync` or `/api/git/commit` + CLI `git` normally takes ~50–200 ms plus diff reloads), while keeping one single code path to test and maintain.
2. **Zero UI Block on Deterministic Local Writes**
   - Operations that rarely fail (no Git hooks, no network, no 3-way merge conflict) update React state synchronously (`<1 ms`) and enqueue persistence on a FIFO Promise queue.
3. **Sequential Queue & Mutation Barrier**
   - Dependent commands (for example, `commit`, `stash`, or `discard` right after `stage`) must await `flushPendingStageOps()` so disk `.git/index` / refs reflect user intent before executing.
4. **No Mid-Batch Stale Overwrites**
   - Background `reloadDiff()` and `window.focus` refreshes skip or discard results while `pendingStageCountRef.current > 0`.
5. **Preserve Underlying Driver Caches**
   - Edge driver operations preserve `EdgeRepositoryReader.cache`, `worktreeSnapshot`, and `FileSystemObserver` cleanliness (`runInternalIndexWrite`) so post-queue reconciliation hits cache instead of triggering full `git.walk` scans.
6. **Explicit Rollback & Error-Only Notifications**
   - Optimistic operations succeed silently in the UI without `notify.success` toasts.
   - On write failure: restore pre-operation snapshot immediately if no newer queued operations sit ahead of it, display an i18n error toast (`notify.error`), and reconcile against disk when needed.

---

## 2. Operation Matrix

| Category                      | Action                                                                     | Source Location                                                                                                                            | Strategy                                      | Status             | Notes                                                                                                                                                                                                                |
| :---------------------------- | :------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Worktree Staging**          | Stage file / Stage all                                                     | `components/git/commit-panel/useCommitPanelActions.ts`                                                                                     | **Optimistic + FIFO Queue**                   | **Implemented**    | Updates `changes.files` & `onFilesLoaded` immediately without success toast; Edge uses dirty snapshot paths (`git.remove` for deletions); reconciles via `readCommitDiff` on queue drain without full `onRefresh()`. |
| **Worktree Staging**          | Unstage file / Unstage all                                                 | `components/git/commit-panel/useCommitPanelActions.ts`                                                                                     | **Optimistic + FIFO Queue**                   | **Implemented**    | Updates `staged: false, unstaged: true` immediately without success toast; rolls back + error toast on error; guarded by `flushPendingStageOps()` before Commit/Stash/Discard.                                       |
| **Tag Lifecycle**             | Create tag / Annotated tag / Delete tag                                    | `components/git/sidebar/useBranchContextMenu.ts`, `components/git/sidebar/useSidebarContextMenus.tsx`, `lib/git/optimistic-updates.ts`     | **Optimistic + Rollback**                     | **Implemented**    | Updates `view.tags` and matching `commit.refs` (`tag: <name>`) immediately with no success toast; rolls back and shows error toast on failure.                                                                       |
| **Local Branches**            | Create branch (`checkout: false`) / Delete local branch                    | `components/git/hooks/useGitBranchActions.ts`, `components/git/GitToolbar.tsx`, `lib/git/optimistic-updates.ts`                            | **Optimistic + Rollback**                     | **Implemented**    | Inserts/removes branch entry in `view.branches` and target `commit.refs` without `setBusy` blocking or success toast; rolls back + error toast if rejected.                                                          |
| **Remote Config**             | Add / Edit URL / Rename / Remove remote                                    | `components/git/sidebar/SidebarModals.tsx`, `components/git/sidebar/useSidebarContextMenus.tsx`, `lib/git/optimistic-updates.ts`           | **Optimistic + Rollback**                     | **Implemented**    | Mutates `view.remoteSources`, `view.remotes`, `view.remoteUrl`, and remote `commit.refs` immediately; closes modal immediately with no success toast; rolls back on error.                                           |
| **Project Catalog**           | Create/Rename/Delete/Clear folder, Move project, Set label, Remove project | `components/git/hooks/useGitProjectActions.ts`, `lib/git/optimistic-updates.ts`                                                            | **Optimistic + Rollback**                     | **Implemented**    | Mutates `projects` and `folders` immediately without `setBusy` lockouts or success toasts, reconciles against driver response, and rolls back on failure.                                                            |
| **Commit Creation**           | `commit` (`Commit` button / `Cmd+Enter`)                                   | `components/git/commit-panel/useCommitPanelActions.ts`, `components/git/hooks/useOptimisticGitActions.ts`, `lib/git/optimistic-updates.ts` | **Post-Ack Incremental**                      | **Implemented**    | Awaits `flushPendingStageOps({ suppressReload: true })`; after `driver.commit` returns `hash`, prepends commit to `commits[0]`, advances current branch tip, and clears `worktree` without success toast.            |
| **Worktree Switch / Rewrite** | `checkoutBranch`, `createBranch (checkout: true)`                          | `components/git/hooks/useGitBranchActions.ts`                                                                                              | **Non-Optimistic (Incremental Refresh Only)** | **Not Optimistic** | Can overwrite working-tree files or fail on dirty-tree conflicts; optimize via `O(Δ)` tree diff & cache reuse rather than optimistic UI.                                                                             |
| **Remote & Merge**            | `pull`, `push`, `fetch`, `mergeBranch`, `rebaseBranch`, `cherryPick`       | `components/git/GitToolbar.tsx`, `components/git/hooks/useGitBranchActions.ts`                                                             | **Non-Optimistic**                            | **Not Optimistic** | Subject to network auth/rejection and 3-way merge conflicts; keep explicit progress state.                                                                                                                           |
| **Destructive / Stash**       | `discard`, `stash` (`save` / `pop` / `apply` / `drop`)                     | `components/git/commit-panel/useCommitPanelActions.ts`, `components/git/GitToolbar.tsx`                                                    | **Non-Optimistic (Flush Barrier Before Run)** | **Protected**      | Destructive or conflict-prone; awaits `flushPendingStageOps()` before executing.                                                                                                                                     |

---

## 3. Implemented Worktree Optimistic Flow (Phase 1 Details)

Implemented across [`useCommitPanelActions.ts`](../../components/git/commit-panel/useCommitPanelActions.ts), [`GitCommitPanel.tsx`](../../components/git/GitCommitPanel.tsx), [`useCommitPanelContextMenus.tsx`](../../components/git/commit-panel/useCommitPanelContextMenus.tsx), and [`edge-git-write.ts`](../../lib/git/driver/edge-git-write.ts):

1. **Immediate UI Transition**
   - `handleStage`, `handleUnstage`, `handleStageAll`, and `handleUnstageAll` call `enqueueStageMutation(...)`:
     - Snapshot `latestFilesRef.current`
     - Compute `nextFiles`, update `latestFilesRef.current`, and push synchronously to `onOptimisticFilesChange(nextFiles)` (updates both `GitCommitPanel` `changes.files` and parent `onFilesLoaded`)
2. **Serialized Execution Queue**
   - Increments `pendingStageCountRef.current`
   - Appends the `driver.stage` / `driver.unstage` call to `mutationQueueRef.current` (catching errors internally so subsequent queued operations stay unblocked)
3. **Commit / Stash / Discard Synchronization**
   - `handleCommitSubmit`, `handleStashSubmit`, `handleDiscard`, and context-menu `stash-file` await `flushPendingStageOps()` prior to invoking driver commands. If any awaited stage operation failed during the flush, `handleCommitSubmit` aborts cleanly rather than committing unintended state.
4. **Tail Reconciliation & Failure Recovery**
   - When `pendingStageCountRef.current` reaches `0` and the active `repo` hasn't changed, calls `reloadDiff()` (`readCommitDiff` with preserved Edge `observerClean`).
   - Full `onRefresh?.()` (`silentRefresh`) is skipped on normal stage/unstage success and only triggered on batch failure after restoring state.

---

## 4. Phase 2 Status Checklist

- [x] **P1 — Branch & Tag Ref Optimism**: Optimistically update `view.tags`, `view.branches`, and `commit.refs` on `createTag`, `deleteTag`, `createBranch(checkout=false)`, and `deleteBranch`, with automatic rollback and error-only toasts.
- [x] **P1 — Post-Commit Incremental Graph Insert**: On `driver.commit` resolve, prepend `{ hash }` + advance `HEAD` branch ref in memory and serialize pending stage flush with `suppressReload: true`.
- [x] **P2 — Remote Config Optimism**: Update `view.remoteSources` / `view.remotes` / `view.remoteUrl` optimistically in `SidebarModals` and `useSidebarContextMenus`.
- [x] **P2 — Project Catalog Optimism**: Mutate `projects` and `folders` state immediately on folder/project CRUD actions in `useGitProjectActions` without `setBusy` lockouts or success toasts.
