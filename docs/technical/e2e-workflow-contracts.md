# E2E Workflow Contracts (`pnpm test:e2e`)

This document defines the locked-down end-to-end (E2E) behavioral contracts for Yggit. Any future feature, refactor, or UI adjustment **must** keep these contracts intact and pass `pnpm test:e2e`.

## 1. Test Architecture & Separation

- **Unit & API Route Tests (`pnpm test` -> `__tests__/`)**: Fast Jest tests covering pure logic, hooks, component units, and Next.js API route handlers (`app/api/**`).
- **Playwright E2E Tests (`pnpm test:e2e` -> `e2e/`)**: Real Chromium browser tests verifying full-stack user workflows across UI interactions, driver routing (`Local` vs `Edge`), API/IndexedDB state, and DOM rendering.

## 2. Shared Component Contracts (`e2e/shared-components.spec.ts`)

| Component / Capability       | User Action                                                                        | Expected Event & State Contract                                                                               |
| :--------------------------- | :--------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| Sidebar Section Collapse     | Click `Local` section header                                                       | Toggles `aria-expanded` (`true` <-> `false`) and hides/shows branch tree items                                |
| Branch Search Filter         | Click `Search` in `Branches` -> type query                                         | Opens floating `Search` input; filters `Local` tree items live; clearing restores full tree                   |
| `PanelSplitter` Drag Resize  | `pointerdown` -> `pointermove` -> `pointerup` on branch or file-tree separator     | Updates `aria-valuenow` width via `requestAnimationFrame` and persists resize                                 |
| Commit File Tree & Diff Find | Click folder in `Files`; click `Search`; click `Search content`; switch `Full` tab | Collapses/expands nested folders; filters files; opens diff find box (`Escape` closes); switches viewport tab |
| Floating Context Menu        | Right-click branch/commit/file -> press `Escape`                                   | Opens `role="menu"` at pointer anchor; `Escape` unmounts menu cleanly                                         |

## 3. Core Git & Edge Parity Contracts (`e2e/git-core-flows.spec.ts`, `e2e/git-main-workflows.spec.ts`, `e2e/git-advanced-and-edge.spec.ts`)

| Flow                          | Driver Mode       | Trigger Action                                                                              | Event / Network Contract                                                                                              | Expected UI & State Outcome                                                               |
| :---------------------------- | :---------------- | :------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| Remote GitHub Commit View     | `edge`            | Navigate to `/git/github/<owner>/<repo>/commit/<hash>`                                      | **Zero** `/api/git/*` requests; reads via GitHub remote provider                                                      | Commit message & file tree render cleanly                                                 |
| Mode Switch `Local -> Edge`   | `local` -> `edge` | Click `Local` mode switcher button                                                          | Dispatches `yggit:driver_mode_changed`; closes `/api/git/watch` `EventSource`; **zero** subsequent `/api/git/*` calls | `localStorage['yggit.driver_mode'] === 'edge'`                                            |
| Auto Conflict Detection       | `local`           | Open repo `/git?repo=<dir>` with historical conflicted merge commit                         | `useMergeConflicts` triggers `POST /api/git/conflicts` automatically without manual refresh                           | Merge badge & `"Conflict"` 3-way button enabled; clicking renders `ours` vs `theirs` diff |
| Open Local Repo & Switcher    | `local`           | Navigate to `/git?repo=<dir>`, open Project Switcher, create/delete folder                  | Calls `GET /api/git/log` & `/api/git/projects`; folder CRUD updates catalog                                           | Branches & commits render; custom folder appears and deletes after confirm                |
| Branch Selection & File Views | `local`           | Click branch -> click commit -> click file -> switch `File View` / `File History` / `Blame` | Fetches `/api/git/commit`, `/api/git/file-history`, `/api/git/blame`                                                  | Selected branch `aria-selected="true"`; all 4 file views render                           |
| Right-Click Context Menus     | `local`           | Right-click Branch, Commit row, and File item (`History`)                                   | Opens respective `FloatingMenu`; clicking `History` opens `GitFileHistoryView`                                        | Menu items render and action navigates to file history                                    |
| Merge Lineage & Solo Filter   | `local`           | Click merge commit; right-click branch -> `Focus Branch`                                    | `GitMergePanel` computes topology; `soloBranch` updates sidebar badge                                                 | `Highlight` toggles to `Clear`; `Focus` badge appears in sidebar                          |

## 4. Git Write & Remote Sync Contracts (`e2e/git-write-workflows.spec.ts`)

All write tests run against isolated temporary Git repositories + local bare `origin.git` remotes (`e2e/helpers/git-fixture.ts`).

| Flow                            | Trigger Action                                                                                                                                                                                          | Event / Git Outcome Contract                                                        |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------- |
| Worktree Stage & Commit         | Click `Working tree` row -> `Stage All` -> fill `Commit summary` -> `Ctrl/Cmd+Enter`                                                                                                                    | Stages tracked & untracked files; creates new commit at top of graph                |
| Branch Create / Switch / Delete | Toolbar `Branch` -> create `feat/e2e-branch` -> right-click `main` (`Switch to`) -> right-click `feat/e2e-branch` -> `Branch Operations` -> `Delete branch` (2-click inline confirm + `window.confirm`) | Creates branch, switches `HEAD` back to `main`, deletes `feat/e2e-branch` from repo |
| Stash & Pop                     | Toolbar `Stash` -> Toolbar `Pop`                                                                                                                                                                        | `git stash list` becomes non-empty on `Stash`, then empty on `Pop`                  |
| Push & Pull with Remote         | Commit locally -> Toolbar `Push`; peer pushes to `origin.git` -> Toolbar `Pull`                                                                                                                         | `bareDir` receives pushed commit; `Pull` brings peer commit into graph              |
| Undo Last Commit                | Toolbar `Undo`                                                                                                                                                                                          | Resets `HEAD` back to previous commit (`feat: remote peer commit`)                  |

## 5. Settings, Workspace & Agent Runtime Injection Contracts (`e2e/workspace-settings.spec.ts`, `e2e/agent-crud-and-injection.spec.ts`)

| Flow                                 | Trigger Action                                                                                                                                                       | Expected Contract                                                                                                                                          |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings Pages & Locale              | Visit `/settings/{general,models,mcp,skills,menus,privacy,about}`; toggle `简体中文` <-> `English`                                                                   | Zero `pageerror`s; UI strings switch immediately                                                                                                           |
| Model Channel CRUD                   | Create on `/settings/models/new` -> open -> `Delete` -> confirm `Remove`                                                                                             | Redirects back to `/settings/models` and removes channel from list                                                                                         |
| Skill & MCP CRUD + Runtime Injection | Create Model + custom Skill + MCP Server (`initialize` + `tools/list`) -> wake Yggi -> send prompt matching Skill trigger -> intercept `POST /api/git/agent/gateway` | Gateway request `messages` contains custom Skill directive, `tools` contains discovered MCP tool (`e2e_custom_ping`), and Yggi renders SSE stream response |
| Workspace Pages & Yggi Drawer        | Visit `/workdesk`, `/import`, `/dev/logs`, `/dev/studio`; click `Wake Yggi`                                                                                          | Zero `pageerror`s; Yggi drawer opens cleanly                                                                                                               |

## 6. Running & Maintaining E2E

```bash
# Run full E2E suite (auto-reuses localhost:3001 or starts pnpm dev)
pnpm test:e2e

# Run a specific spec file
pnpm test:e2e e2e/agent-crud-and-injection.spec.ts
```

- Always clean up temporary test data (temp Git repos via `cleanupTestRepo`, created Model/Skill/MCP records via UI delete).
- Whenever a user-facing label, ARIA role, or workflow step changes intentionally, update both the corresponding `e2e/*.spec.ts` and this contract document in the same PR.
