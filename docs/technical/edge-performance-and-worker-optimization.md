# Technical Architecture: Edge Mode Performance, Pruning & Worker Isolation

This specification details the phased optimization plan for Yggit's pure-browser **Edge** Git engine ([edge-driver.ts](../../lib/git/driver/edge-driver.ts), [edge-repository-reader.ts](../../lib/git/driver/edge-repository-reader.ts), [edge-conflicts.ts](../../lib/git/driver/edge-conflicts.ts), [edge-log-walker.ts](../../lib/git/driver/edge-log-walker.ts), and [handle-fs.ts](../../lib/git/driver/handle-fs.ts)), complementary to UI-layer [Git Optimistic Updates](./git-optimistic-updates.md).

---

## 1. Architectural Rationale: Why Upper-Layer Pruning + Owned Reader Worker Beats Ad-Hoc Tricks

### 1.1 Findings on `isomorphic-git@1.44.13` Internals

Direct inspection of the installed `isomorphic-git@1.44.13` package confirms:

- **SHA-1 (`shasum`)** already probes and uses `crypto.subtle.digest('SHA-1', buffer)` when available.
- **Compression (`deflate`)** already probes and uses `CompressionStream('deflate')`.
- **Decompression (`inflate`)** locks `supportsDecompressionStream = false` and uses synchronous/streaming `pako.Inflate()` during `.pack` reading because Git packfiles concatenate compressed entries back-to-back without uncompressed byte-size framing headers and rely on `inflator.strm.avail_in` to rewind the reader cursor after each entry. Native `DecompressionStream` does not expose `avail_in` and introduces per-chunk Promise/Blob allocation overhead on tiny commit/tree objects.
- **Implication**: Patching `isomorphic-git` crypto/inflate internals carries high maintenance risk and poor compatibility ROI. All Phase 1 & Phase 2 gains belong cleanly above `isomorphic-git`.

### 1.2 Why Full-Reader Worker Isolation Beats Stateless Compute-Only Workers

- In pure-browser Edge mode, `70%–85%` of main-thread CPU time happens inside `isomorphic-git` itself (`.git/index` parse/serialize, `pako` inflate/delta reconstruction, `.gitignore` pattern checks, SHA-1 hashing when browser stats omit POSIX inode fields) rather than final `diffLines` or graph layout.
- Moving only stateless functions (`diffLines`, `structuredPatch`) into a Worker still forces the UI main thread to decompress multi-megabyte blobs and copy them over `postMessage`.
- Moving the **entire `EdgeRepositoryReader` instance** into a dedicated Worker keeps `handle-fs` reads, `reader.cache`, `worktreeSnapshot`, `isomorphic-git` walks, `diffLines`, and conflict analysis inside one thread-local closed loop, sending only compact JSON results back to React.

---

## 2. Phase 1: Upper-Layer Algorithmic Pruning & Cache Reuse

### Step 1: Tree-OID Directory Pruning in Conflict Detection

**Target**: `findCandidateConflictFiles` in [edge-conflicts.ts](../../lib/git/driver/edge-conflicts.ts#L123-L176)

- **Current behavior**: When `oursType`, `theirsType`, `mergedType`, or `baseType` is `'tree'`, `git.walk` returns `undefined`, forcing descent into every directory across the repository.
- **Optimization**:
  1. When all present directory entries are `'tree'` (or when missing sides match unmodified base semantics), evaluate tree OIDs via `.oid()`.
  2. Prune by returning `null` whenever a subtree cannot produce divergent file edits:
     - `oursTreeOid && oursTreeOid === theirsTreeOid` (both sides reached identical subtree state) **and** `(mergedTreeOid === oursTreeOid || !mergedTreeOid)` (unless historical committed conflict markers inside an unchanged merged tree must be scanned; when scanning unresolved markers across merge outcomes, still prune `base === ours && base === theirs && merged === base`).
     - If `baseTreeOid` exists and `oursTreeOid === baseTreeOid` or `theirsTreeOid === baseTreeOid`, and `mergedTreeOid` equals the changed side (`(ours === base && merged === theirs) || (theirs === base && merged === ours)`), skip the entire subtree (`return null`).
- **Expected gain**: Eliminates `git.walk` descent and blob reads across >90% of untouched directories on large merge commits (`5x–20x` faster).

### Step 2: Granular `handle-fs` Cache Invalidation & Two-Tier Worktree Scan

**Targets**: [edge-repository-reader.ts](../../lib/git/driver/edge-repository-reader.ts#L196-L315), [handle-fs.ts](../../lib/git/driver/handle-fs.ts#L16-L43)

- **Current behavior**:
  - `worktreeFiles()` calls `this.fs.clearCache()` on every full scan miss, discarding `dirCache`, `fileHandleCache`, and `kindCache` accumulated across prior navigations.
  - Full scans always walk `[TREE({ ref: 'HEAD' }), WORKDIR({ refresh: false }), STAGE()]` together.
- **Optimization**:
  1. **Preserve handle caches across refreshes**: Replace unconditional `this.fs.clearCache()` in normal refresh paths with targeted `this.fs.invalidatePath(path)` for observer-reported dirty paths and Edge write targets; reserve full `clearCache()` for explicit `clearCache(repo)` resets or retry fallback after `ENOENT`.
  2. **Compile/cache `.gitignore` matchers per directory scope**: Cache parsed ignore rules tied to `.gitignore` `mtimeMs` instead of re-invoking `git.isIgnored` rule compilation for every untracked file.
  3. **Decouple `STAGE vs WORKDIR` fast scan from `HEAD` tree walk** (follow-on within Step 2): Read `.git/index` entries and compare against `WORKDIR` (`size` + `mtimeSeconds` + racy-git window) first, consulting `HEAD` tree OIDs only for staged entries or index changes rather than decoding every `HEAD` tree object on every refresh.
- **Expected gain**: `2x–5x` reduction in handle resolution IPC + object walking during cold opens and non-Observer fallback polling.

### Step 3: Shared Ancestor Commit Map & Binary-Heap Log Walker

**Target**: [edge-log-walker.ts](../../lib/git/driver/edge-log-walker.ts#L18-L171)

- **Current behavior**:
  - `walkMultiBranchLog` maintains its priority queue via binary search + `Array.prototype.splice`.
  - `computeBranchAheadBehind` runs an independent BFS up to `maxHops = 100` per local branch, re-decoding shared ancestor commits multiple times.
- **Optimization**:
  1. Accept a shared `commitMap: Map<string, RawCommitItem>` across `walkMultiBranchLog` and all `computeBranchAheadBehind` invocations within the same `readEdgeRefsSnapshot` pass so every commit OID is decoded once per refresh.
  2. Replace `queue.splice(low, 0, parentCommit)` in `walkMultiBranchLog` with an explicit binary max-heap (`push` / `pop` in $O(\log K)$).
  3. Optionally persist an IndexedDB topology cache keyed by `${repoKey}:oid` storing immutable `{ parents, ts }` metadata to accelerate cold repository opens across browser sessions.
- **Expected gain**: `2x–4x` faster log + branch status calculation on repositories with many active branches.

---

## 3. Phase 2: Dedicated `EdgeGitWorker` Architecture (Step 4)

### 3.1 Scenario & Operation Routing Matrix

| Scenario / Operation                                                                                                                                                                                                                                                                             | Execution Thread                         | Reason                                                                                                                                                                                                    |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LocalGitDriver` (`/api/git/*`)                                                                                                                                                                                                                                                                  | Main Thread                              | Node backend spawns native `git` CLI; UI only handles compact JSON                                                                                                                                        |
| GitHub Public Remote (`parseGitHubRepo`)                                                                                                                                                                                                                                                         | Main Thread                              | Network `fetch()` IO only; minimal CPU                                                                                                                                                                    |
| `queryPermission` / `requestPermission` / `showDirectoryPicker`                                                                                                                                                                                                                                  | Main Thread                              | Browser security model requires user activation on main thread                                                                                                                                            |
| Catalog / Folder Metadata (`IndexedDB`)                                                                                                                                                                                                                                                          | Main Thread                              | Lightweight key/value updates; already covered by 0ms optimistic UI                                                                                                                                       |
| Lightweight Metadata (`getLastCommit`, `getRemotes`, simple `readBlob`)                                                                                                                                                                                                                          | Main Thread or light Worker pass-through | Sub-millisecond if cached; pass-through if sharing Worker `reader.cache` avoids duplicate cache                                                                                                           |
| **Edge Local Repo Heavy Engine** (`worktreeFiles`, `readWorktreeStatus`, `detectConflictsBatch`, `readRemergeDiff`, `readCommitDiff`, `readFileHistory`, `walkMultiBranchLog`, `stage`, `unstage`, `commit`, `checkoutBranch`, `createBranch`, `deleteBranch`, `createTag`, `deleteTag`, `pull`) | **Dedicated `EdgeGitWorker`**            | Owns the canonical `EdgeRepositoryReader` (`cache`, `worktreeSnapshot`, `observerDirtyPaths`, `runInternalIndexWrite` lock) and runs all `isomorphic-git` + `diffLines` + conflict math off the UI thread |

### 3.2 Worker Lifecycle & Ownership Design

```text
[Main Thread UI]
  ├─ Optimistic UI state & Rollback (useOptimisticGitActions / useCommitPanelActions)
  ├─ Directory Handle Permission Guard (handle.queryPermission / requestPermission)
  ├─ FileSystemObserver callback ──postMessage({ type: 'dirtyPaths', repoId, paths })──┐
  └─ EdgeGitDriver RPC Client ───────postMessage({ id, op, payload })─────────────────┼──> [Dedicated EdgeGitWorker]
                                                                                             ├─ Map<repoId, EdgeRepositoryReader>
                                                                                             ├─ handle-fs + isomorphic-git cache
                                                                                             ├─ worktreeSnapshot + index lock
                                                                                             └─ diffLines / edge-conflicts
```

Key design invariants:

1. **Handle Transfer Timing**: Always validate `queryPermission` / `requestPermission` on the main thread before instantiating or messaging the Worker with `FileSystemDirectoryHandle`.
2. **Single Source of Truth for Caches**: Once a `repoId` is registered inside `EdgeGitWorker`, no main-thread `EdgeRepositoryReader` instance should be kept for that `repoId`. Ref mutations (`createTag`, `deleteBranch`, etc.) that share `reader.cache` execute as quick RPCs inside the Worker so `reader.cache` and `worktreeSnapshot` remain strictly consistent.
3. **Request Cancellation / Repo Switch Guard**: Attach `repoGeneration` or `AbortController`-equivalent request IDs so stale `detectConflictsBatch` or `readWorktreeStatus` results never overwrite a newly selected repository.
4. **Graceful Worker Fallback**: Keep `EdgeRepositoryReader` modular and pure TypeScript without DOM globals so unit tests (Node/Jest) and Worker-restricted environments can run the exact same reader class directly on the main thread as fallback.

---

## 4. Phase 3: Extra-Large Repo Escalation (Step 5, On-Demand)

Only proceed if repositories exceeding ~10,000 tracked files remain noticeably slow after Phases 1 and 2:

1. **Zero-Rescan Incremental `.git/index` Writes** ([edge-git-write.ts](../../lib/git/driver/edge-git-write.ts)):
   - Replace post-stage `refreshWorktreePaths` (`git.statusMatrix` re-walk) on known single-file `stage` / `unstage` calls with direct snapshot entry updates (`staged`/`unstaged` flags) verified against updated index `mtimeMs`, plus optional binary `.git/index` entry patching.
2. **Scoped Rust WASM Kernel + Optional OPFS Pack Mirror** (inside `EdgeGitWorker`):
   - Offload binary `.git/index` serialization/checksum verification and pack `.idx`/inflate loops to a self-contained WASM module running inside `EdgeGitWorker`.
   - Optionally mirror immutable `.git/objects/pack/*.pack` & `.idx` files into OPFS so `FileSystemSyncAccessHandle` enables synchronous byte-range reads instead of per-object async `getFile()` promises.

---

## 5. Verification Plan per Step

- **After Step 1**: Unit tests in `__tests__/lib/git/edge-conflicts.spec.ts` verifying subtree pruning counts (`fs.readdir` / tree walk spy assertions) alongside identical conflict outputs for conflicted and clean merges.
- **After Step 2**: Unit tests in `__tests__/lib/git/edge-repository-reader.spec.ts` proving `dirCache` hit retention across worktree refreshes and accurate `invalidatePath` eviction after writes/deletes.
- **After Step 3**: Unit tests in `__tests__/lib/git/edge-log-walker.spec.ts` verifying shared `commitMap` read deduplication (spy `git.readCommit` call counts across multi-branch ahead/behind) and heap ordering equivalence.
- **After Step 4**: Worker RPC mock + fallback parity tests, plus Playwright E2E `e2e/worktree-full-chain.spec.ts` verifying Edge mode stage/commit/diff parity with zero `/api/git/*` requests.
