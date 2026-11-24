# Code Modularization & File Size Standards

## 1. File Size Ceiling (600–800 Lines)

To maintain code readability, ease of testing, and prevent monolithic bloat, all code files must adhere to the **600–800 lines max** policy:

- **Target Size**: 300–500 lines per file for typical components, hooks, or service modules.
- **Maximum Ceiling**: **800 lines** absolute maximum.
- **Exceptions**: Static dictionary files (such as `lib/i18n/messages/*.ts`). All other component, hook, logic, or driver files must be refactored into submodules once approaching 800 lines.

---

## 2. Decomposition Strategy

When a component or module exceeds 600 lines, decompose it following this structure:

### A. Subcomponents Folder

Place child components that are tightly coupled to a specific view inside a dedicated subfolder next to the parent component:

```
components/git/
  GitCommitPanel.tsx               # Orchestration & high-level layout (~500 lines)
  commit-panel/
    commitTreeUtils.ts             # Tree building, filtering, marks, and helpers
    TreeRows.tsx                   # Hierarchical recursive file/folder row rendering
    PathRows.tsx                   # Path-grouped file row rendering
    GitCommitBox.tsx               # Bottom commit message, amend, and stash controls
    useCommitPanelActions.ts       # File staging/unstaging and context menu actions
```

### B. Extract Custom Hooks

Isolate event handling, asynchronous tasks, and state management into domain hooks:

- Move complex context menus into `use...ContextMenus.ts`
- Move drag-and-drop or splitter logic into dedicated layout hooks
- Move keyboard chords and shortcuts into dedicated shortcut hooks

### C. Separate Pure Utilities

Isolate pure data transformation functions (tree builders, topology analyzers, string formatters) into separate `.ts` utility files with independent unit tests.

---

## 3. UI Iconography & Accessibility

- Strictly use `react-icons` (e.g. `react-icons/lu`, `react-icons/io5`).
- Never use raw Unicode emojis for UI iconography.
- Avoid trailing clutter buttons behind list items; prioritize right-click context menus and keyboard shortcuts (`⌥A` / `Alt+A`).

---

## 4. Notifications vs. Logs Internationalization Standard

- **User-Facing Notifications (`notify.success`, `notify.error`, toasts)**:
  - User-facing feedback notifications must strictly support internationalization (`lib/i18n/`).
  - Never hardcode Chinese or unlocalized text directly in `notify.success` or `notify.error`.
  - Always use `t('key', fallback)` or `tr('key', 'Default English fallback')` so that the message displays according to the user's active locale.
- **System Logs & Diagnostics**:
  - All logs (`console.log`, `console.warn`, `console.error`, `serviceLogger`, API route diagnostics) must strictly be written in English.
  - Internal debug traces and backend error messages must be in English.
