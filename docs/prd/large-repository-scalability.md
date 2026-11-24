# PRD: Large Repository Scalability & Segmented Rendering

## 1. Background & Problem Statement

In enterprise monorepos and long-lived Git repositories (e.g. Linux kernel, Chromium, large monorepos with 100k+ files or 20k+ branches), client-side web applications frequently suffer from severe performance bottlenecks:

1. **DOM Tree Explosion**: Attempting to render tens of thousands of branch items, flat file trees, or commit nodes simultaneously blocks the JavaScript main thread, causing severe input lag, browser unresponsiveness warnings, and tab crashes.
2. **Search Inefficiency**: When commit history is paginated, in-memory client searches fail to locate older commits whose hash or commit message resides beyond the currently loaded slice.
3. **Memory Bloat**: Loading unrestricted recursive file hierarchies and monster diffs (e.g., auto-generated lockfiles or minified bundles) exhausts browser heap memory.

Rather than attempting unbounded compatibility with extreme edge cases at the expense of stability, Yggit adheres to **Predictable Scalability & Defensive Degradation**:

- Set defensive rendering thresholds for all unbounded lists.
- Employ lazy directory expansion and chunked/segmented rendering.
- Delegate deep commit searches directly to optimized native Git commands.
- Provide clear, non-blocking UI notifications and guidance instead of freezing or crashing.

---

## 2. Goals & Success Metrics

- **Zero Main-Thread Freezes**: The application must never freeze or trigger browser "Page Unresponsive" dialogs, even in repositories containing >10,000 branches or >100,000 modified files.
- **Lazy Directory Expansion**: Unexpanded directory nodes in the commit and worktree panels must never render descendant DOM elements until explicitly expanded by the user.
- **Segmented / Chunked List Rendering**: Unbounded lists (branches, tags, flat file changes) cap initial rendering at safe limits (e.g., 300 branches, 500 files) with an explicit truncation notice and a "Load More (+200)" affordance.
- **Full-Breadth Filter Search**: When a user inputs a query in the branch or file filter, searching executes across the _entire_ collection, returning up to the threshold of matching items immediately.
- **Deep Git Log Search**: When searching commits by hash or message, queries missing from the active memory slice trigger backend Git searches (`git log --grep` / hash resolution) bounded by `--max-count=50`, debounced at 350ms, and automatically locate the target in the DAG sliding window.

---

## 3. Detailed Feature Requirements

### 3.1 Branch & Remote List Rendering Boundaries

- **Default Cap**: Maximum of 300 branch/remote/tag items rendered per section initially.
- **Truncation Notice Banner**: If a section contains >300 items, render the first 300 items followed by a localized notice:
  - _EN_: "Showing first 300 branches (of {total}). Use the search box above to quickly find specific branches, or load more."
  - _ZH_: "已显示前 300 个分支（共 {total} 个）。建议使用上方搜索框快速检索，或加载更多。"
- **Load More Action**: A button allowing users to incrementally load +200 items on demand.
- **Global Search Filtering**: Typing into the section filter checks all branch names in the repository and displays matching results up to 300 items, bypassing the default truncation.

### 3.2 Commit & Worktree File Tree Lazy Architecture

- **Lazy Folder Rendering**: Only render direct child nodes of expanded directories. Collapsed folder subtrees remain purely in JavaScript memory without mounting DOM elements.
- **Single-Folder & Flat List Cap**: If any single folder or flat list contains >500 files, clamp rendered files to 500 items and append a notification:
  - _EN_: "Showing first 500 changed files (of {total}). Use path search or directory grouping to inspect others."
  - _ZH_: "已显示前 500 个变更文件（共 {total} 个）。为保证界面流畅，建议使用路径搜索或目录视图查看。"
- **Search Expansion Guard**: During tree search, only expand folders that contain matching items, preventing 10,000 nested folders from opening at once.

### 3.3 Commit History Deep Search & Locate

- **Local-First Fast Path**: First query currently loaded commits and stashes in memory.
- **Backend Git Search Fallback**: If query has >= 2 characters, debounce 350ms and query `/api/git/log?q=<query>&take=50`.
  - Native `git log` executes `--date-order -n 50 -i --grep=<term>`.
  - Hex queries (4-40 chars) trigger hash verification and offset lookup.
- **DAG Window Jump (Locate)**: When a remote search match is selected:
  - Backend resolves commit offset via `locateCommitOffset`.
  - Virtual window slides to `startIndex = max(0, offset - 25)` and loads surrounding 50 commits.
  - DAG smoothly centers and selects the located commit.

---

## 4. Non-Functional Requirements

- **i18n Compliance**: All user-facing limit notices and banners must support English, Simplified Chinese, Traditional Chinese, and Japanese via `lib/i18n/`.
- **Iconography**: Use `react-icons` exclusively. No raw unicode emojis.
- **File Length Limitation**: Keep files under 600-800 lines of code by modularizing hooks and subcomponents.
