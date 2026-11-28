# PRD: Edge Mode Performance, Algorithmic Pruning & Worker Isolation

## 1. Background & Problem Statement

Yggit's pure-browser **Edge** mode mounts local user repositories directly via the Web File System Access API (`FileSystemDirectoryHandle`) and executes Git operations through `isomorphic-git@1.44.13`. Following Phase 1 & Phase 2 optimistic UI updates ([Git Optimistic Updates](./../technical/git-optimistic-updates.md)), high-frequency small writes (staging, unstaging, tags, non-checkout branch creation, remote edits, catalog operations) now respond synchronously on UI state without toast/overlay blocking.

However, large repositories opened in Edge mode still suffer from two distinct performance bottlenecks:

1. **Redundant Traversal & Repeated Object Decompression (Absolute Latency)**
   - Merge conflict scanning enters unchanged subtrees indiscriminately.
   - Worktree rescans flush `handle-fs` directory handle caches completely and walk `HEAD`, `WORKDIR`, and `STAGE` simultaneously even for routine working-tree checks.
   - Branch `ahead/behind` calculations re-read shared ancestor commits independently per branch.
2. **Main-Thread CPU Contention (UI Frame Drops / Input Stalls)**
   - In pure-browser Edge mode, `isomorphic-git` internal CPU work (`.git/index` encode/decode, zlib `pako` inflate on packfiles/objects, `git.walk`, SHA-1 content checks) plus Myers `diffLines` on up to 25 dirty files run on the browser UI main thread, causing typing lag, scroll stutter, and frame drops on large repos.

At the same time, **Local mode** (backed by native `git` CLI subprocesses via `/api/git/*`) and **GitHub remote read-only mode** (`fetch`) do **not** run heavy Git parsing in the browser main thread and should not incur unnecessary Worker overhead.

---

## 2. Goals & Non-Goals

### Goals

- **Phase 1 (Algorithmic Pruning & Cache Reuse)**: Reduce absolute wall-clock latency of conflict detection, worktree scans, and multi-branch log loading **without modifying `isomorphic-git` internals** (`2x–20x` speedup on targeted hot paths).
- **Phase 2 (Dedicated Repo Worker Isolation)**: Eliminate main-thread UI stalls (`85%–95%+` main-thread blocking reduction) during heavy Edge local-handle operations while keeping permission prompts, Local mode, GitHub remote mode, and optimistic UI on the main thread.
- **Phase 3 (Optional Hot-Path Acceleration for Extra-Large Repos)**: Provide a clear escalation path (`stage/unstage` zero-rescan index patching, targeted WASM / OPFS `SyncAccessHandle` pack caching) only if repos with 10k+ files exceed latency budgets after Phases 1–2.

### Explicit Non-Goals

- **No Forking/Patching `isomorphic-git` for Native `DecompressionStream`**: Verified inspection of `isomorphic-git@1.44.13` confirms it already uses `crypto.subtle.digest('SHA-1')` and `CompressionStream('deflate')`, while intentionally keeping `supportsDecompressionStream = false` and `pako.Inflate()` for packfile parsing because `DecompressionStream` does not expose `avail_in` stream boundaries and adds per-small-object Blob/Stream overhead. Custom patching creates high maintenance risk with poor ROI.
- **No Worker Wrapping for Local Mode, GitHub REST API, Permission Prompts, or Metadata CRUD**: Those paths are already offloaded, network-bound, main-thread security-gated, or sub-millisecond IndexedDB operations.

---

## 3. Staged Requirements

### P1 — Phase 1: Upper-Layer Pruning & Cache Preservation (Highest ROI, Zero Risk)

| Step       | Target Area                                                            | Requirement                                                                                                                                                                                                                                                                                                      | Target Improvement                                                                    |
| :--------- | :--------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| **Step 1** | Merge Conflict Detection (`edge-conflicts.ts`)                         | Prune unchanged directories by comparing `tree` OIDs (`ours === theirs`, or `base` matching `ours`/`theirs` when merged marker checks do not require descent) so `git.walk` returns `null` and skips unaffected subtrees.                                                                                        | **5x–20x** faster historical merge conflict scans on large monorepos.                 |
| **Step 2** | Worktree & Handle Caches (`edge-repository-reader.ts`, `handle-fs.ts`) | Stop wiping `dirCache` / `fileHandleCache` / `kindCache` via full `clearCache()` on routine scans; rely on granular `invalidatePath()` on file mutations and `FileSystemObserver` dirty paths, cache compiled `.gitignore` matchers, and separate fast `STAGE` vs `WORKDIR` dirty detection from `HEAD` lookups. | **2x–5x** faster cold scans and non-Observer fallback refreshes.                      |
| **Step 3** | Multi-Branch Log & `ahead/behind` (`edge-log-walker.ts`)               | Share one in-memory commit parent/timestamp map across `walkMultiBranchLog` and per-branch `computeBranchAheadBehind`, replace sorted array splice with a binary heap, and optionally persist immutable commit topology `{ oid -> { parents, ts } }` in IndexedDB.                                               | **2x–4x** faster repository open and branch status computation on multi-branch repos. |

### P2 — Phase 2: Dedicated Edge Repository Worker Isolation

- **Step 4 — Scenario-Based Routing**:
  - **Main Thread**: React UI, optimistic state (`lib/git/optimistic-updates.ts`), `LocalGitDriver`, GitHub public API (`parseGitHubRepo`), project catalog CRUD, `FileSystemDirectoryHandle.queryPermission` / `requestPermission`.
  - **Dedicated Worker (`EdgeGitWorker`)**: Receives already-authorized `FileSystemDirectoryHandle` instances and exclusively owns `EdgeRepositoryReader` (`cache`, `worktreeSnapshot`, `observerDirtyPaths`, index write locks), `worktreeFiles`, `readWorktreeStatus` (`diffLines`), `detectConflictsBatch`, `walkMultiBranchLog`, `readCommitDiff`, `readFileHistory`, and index-mutating Edge writes (`stage`, `unstage`, `commit`, `checkoutBranch`, `pull`).
- **Consistency Guarantee**: Never split `EdgeRepositoryReader.cache` or `worktreeSnapshot` across main and Worker threads; one canonical owner eliminates cross-thread cache divergence.
- **UX Acceptance**: Typing commit messages, dragging `PanelSplitter`, scrolling `GitGraph`, and opening menus remain `<16ms` frame budget while multi-second scans or conflict checks run in background.

### P3 — Phase 3: Large-Repo Hot-Path Escalation (10k+ Files, On-Demand)

- **Step 5**:
  - Patch `.git/index` entries and `worktreeSnapshot` incrementally on single-file `stage` / `unstage` without post-write `git.statusMatrix` re-walks.
  - Evaluate focused Rust WASM `.git/index` / pack `.idx` lookup + optional OPFS `FileSystemSyncAccessHandle` mirror cache in Worker for cold pack reads if Phase 1 + 2 remain above target latency budgets.

---

## 4. Verification & Acceptance Criteria

1. **Correctness & Edge Parity**: All Jest suites covering `edge-conflicts`, `edge-repository-reader`, `edge-log-walker`, `edge-git-toolkit`, and Playwright E2E `worktree-full-chain` (Edge mode) continue passing with identical conflict counts, staged/unstaged matrices, and commit graphs.
2. **Thread Safety & Lifecycle**: Switching repositories or revoking directory handle permissions cleanly terminates or invalidates pending Worker RPCs with no stale state leak into the newly active repository.
3. **Observability**: Lightweight timing instrumentation confirms main-thread long tasks (`>50ms`) during Edge repo load and background conflict scans drop substantially after Step 4, and conflict/worktree scan durations improve per Steps 1–3 targets.
