# Technical Architecture: Large Repository Scalability & Segmented Rendering

## 1. Overview & Architectural Principles

This document specifies the technical design and data flow for handling high-volume repositories in Yggit. The architecture focuses on **four defensive vectors**:

1. Branch & Remote Tree Segmented Windowing
2. Worktree & Commit File Tree Lazy Traversal
3. Deep Git Log Search & Offset-Based Locate Coordination
4. Large Diff & SVG DAG Boundary Protection

```
+-------------------------------------------------------------------------+
|                              Client (UI)                                |
+------------------------------------+------------------------------------+
| 1. Branch Tree (Clamped <= 300)   | 2. File Tree (Lazy Folder Mounting)|
|    - Chunked "+200" affordance    |    - Truncated at 500 files/group  |
|    - Full-collection filter search|    - Pruned search expansions      |
+------------------------------------+------------------------------------+
| 3. Commit Graph DAG               | 4. Search State Machine            |
|    - 50-commit sliding window     |    - Memory slice lookup (0ms)     |
|    - Clamped SVG lanes (max 24)   |    - Debounced (350ms) Git query   |
+------------------------------------+------------------------------------+
                                      |
                      HTTP /api/git/log?q=<term>&take=50
                                      |
                                      v
+-------------------------------------------------------------------------+
|                        Server (services/git/read.ts)                    |
| - searchGitCommits: git log --date-order -n 50 -i --grep=<term>         |
| - Hash lookup: exact rev-parse or prefix verification                   |
| - locateCommitOffset: calculates DAG offset for window sliding          |
+-------------------------------------------------------------------------+
```

---

## 2. Vector 1: Branch & Remote Tree Segmented Windowing

### 2.1 State & Chunking Model

Located in `components/git/sidebar/useSidebarSections.tsx` and `BranchTree.tsx`:

- Constant: `MAX_BRANCH_RENDER_CHUNK = 300`
- Initial render threshold: `renderedCount = Math.min(totalCount, MAX_BRANCH_RENDER_CHUNK)`
- When user clicks "Load More", `renderedCount` increments by 200.
- When `filterNeedle` is active, the entire branch list is filtered in memory:
  ```ts
  const matches = allBranches.filter((b) => nameMatch(b.name, needle))
  const visible = matches.slice(0, renderedCount)
  ```
- This guarantees DOM element count per section is strictly bounded by `renderedCount` regardless of total branch count.

### 2.2 Truncation Notification Component

Rendered at the bottom of the section:

```tsx
{
  hasMoreBranches && (
    <div className="flex flex-col gap-1.5 p-2 bg-panel-2/40 border-t border-line/40 text-[11px] text-ink-soft">
      <span>{t('git.sidebar.truncatedNotice', { count: visibleCount, total: totalCount })}</span>
      <button onClick={handleLoadMore} className="text-accent hover:underline text-left">
        {t('git.sidebar.loadMoreBranches', { step: 200 })}
      </button>
    </div>
  )
}
```

---

## 3. Vector 2: File Tree Lazy Traversal & Memory Safety

### 3.1 Strict Lazy Mounting

In `TreeRows.tsx`, collapsed directory subtrees do not emit DOM elements:

```tsx
const expanded = folder && (open.has(node.path) || (isSearching && containsMatch(node, needle)))

if (folder) {
  return (
    <div key={node.path}>
      <FolderRow ... />
      {expanded && (
        <TreeRows nodes={clampedChildren} ... />
      )}
    </div>
  )
}
```

### 3.2 Single Folder / Flat List Clamping

In `commitTreeUtils.tsx` and `TreeRows.tsx`:

- `MAX_FILES_PER_DIR = 500`
- If `node.children.length > MAX_FILES_PER_DIR`, only the first 500 items are rendered, followed by an inline warning indicator:
  `{t('git.tree.truncatedNotice', { count: 500, total: node.children.length })}`

---

## 4. Vector 3: Deep Git Log Search & Offset-Based Locate Coordination

### 4.1 Native Git Search Engine

In `services/git/read.ts`:

- Function: `searchGitCommits(options: { repo?: string; ref?: string; query: string; limit?: number })`
- Execution:
  1. Hex Hash Check: If query matches `/^[0-9a-f]{4,40}$/i`, verify direct commit existence via `git log -1` or hash prefix lookup.
  2. Message & Author Grep: `git log <revisions> --date-order -n ${limit} -i --grep=${query} --date=iso-strict --pretty=format:${LOG_FORMAT}`.
  3. Bounded to `-n 50` with a 10s timeout to prevent thread blocking on 1M+ commit repositories.

### 4.2 Frontend Locate Sliding Window Coordination

In `components/git/GitHistory.tsx`:

1. User types in `GitFindBox`:
   - Instant search against currently loaded `commits` slice.
2. If query >= 2 chars:
   - Debounce 350ms.
   - If local hits are insufficient or query is missing from current version:
     - Invoke `driver.searchLog({ repo, ref: scope, query: needle, limit: 50 })`.
     - Append external matches to `matches`.
3. When user selects a commit not in the current `commits` array:
   - Invoke `driver.readLog({ repo, ref: scope, locate: commit.hash, take: 50 })`.
   - Update `commits` state with the newly centered 50-commit window.
   - Graph smoothly updates and scrolls to the selected row via `data-git-commit-hash`.

---

## 5. Vector 4: DAG Lane & Diff Boundary Protection

### 5.1 SVG Bézier Lane Clamping

In `lib/git/graph.ts`:

- When repositories exhibit complex octopus merges, clamp `maxLaneIndex = 24`.
- Prevents horizontal SVG width blowout from consuming gigabytes of GPU texture memory.

### 5.2 Huge Diff Guard

In `components/git/GitFileDiff.tsx`:

- Diff line threshold: 5,000 lines or 2MB payload size.
- If exceeded, render a non-blocking preview placeholder with an explicit "Render Full Diff" user prompt.
