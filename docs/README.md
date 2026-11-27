# Yggit Documentation

Welcome to the Yggit documentation repository. Yggit is a high-performance, organic Git visualization and repository management workbench.

## Architecture & Technical Designs

- [Edge-First Issue Diagnosis & Sharing PRD](prd/edge-first-issue-diagnosis-and-sharing.md) - Product requirements for zero-install Web/Edge deployment, interactive problem sharing (replacing static screenshots), and "who merged into who" topology tracing.
- [Edge-First & Dual-Mode Technical Architecture](technical/edge-first-issue-diagnosis-and-sharing.md) - Technical specification for the `IGitDriver` abstraction, `isomorphic-git` + Web File System Access API, IndexedDB handle persistence, and merge topology engine.
- [Commit Conflict Indicators](technical/git-conflict-status.md) - Tooltip status, committed conflict marker detection, and message cell backgrounds.
- [Git Virtual Window Graph Design](technical/git-virtual-window-graph.md) - Architecture and implementation plan for the 2-tier skeleton index and 200-commit sliding window virtual scroll graph.
- [Repository Identity & URL Routing Specification](../brain/794c2433-2f43-4553-8504-ac1ee92a392d/repository-identity-and-url-routing-design.md) - Stable Repo ID + Multi-Identity + Alias Resolver specification.
- [Temporary Repository Access & Favorites PRD](prd/temporary-repository-and-favorites.md) - Product requirements for browsing public repositories without cloning first ("Browse First, Star to Save").
- [Temporary Repository & Remote Provider Architecture](technical/temporary-repository-architecture.md) - Technical architecture for session-scoped temporary repos, Project Switcher favorites, and Remote Provider driver.
- [Agent Spotlight & Interactive Sharing PRD (Sub-Req 1)](prd/agent-spotlight-and-interactive-sharing.md) - Sub-requirement 1: Product requirements for the center floating pill Agent bar, zero-storage OpenAPI driving, and diagnostic lineage sharing.
- [Agent Spotlight & Zero-Storage OpenAPI Technical Architecture (Sub-Req 1)](technical/agent-spotlight-and-interactive-sharing.md) - Sub-requirement 1: Technical specification for the in-memory OpenAPI client, one-shot Git tool dispatcher, graph lineage highlighting/dimming, and stateless deep link sharing.
- [Agent Settings Tools](technical/agent-settings-tools.md) - Live rule previews and dedicated custom menu action editors.
- [Remote Group Import](technical/remote-group-import.md) - Import GitLab groups and GitHub organizations into project folders.
- [Agent Model Connections](technical/agent-model-connections.md) - Model connection list, draft editing, testing, selection, and in-memory credentials.
- [Browser Local & Free Online AI PRD](prd/browser-local-and-free-online-ai.md) - Product requirements for current-origin browser model downloads (Qwen3.5 0.8B / LFM2.5 350M), cache cleanup, and free online endpoint evaluation.
- [Browser Local & Free Online AI Architecture](technical/browser-local-and-free-online-ai.md) - Technical design for Transformers.js Web Worker inference, CacheStorage cleanup, and DownloadCenter integration.
- [Agent Dockable Workspace UX Specification](ux/agent-dockable-workspace-ux.md) - Interaction design for the bottom floating pill, in-place quick response cards, dockable side/bottom workspaces, and explicit dual-track context.
- [Agent Git Graph Annotation & Spotlight PRD (Sub-Req 2)](prd/agent-git-graph-annotation-and-spotlight.md) - Sub-requirement 2: Product requirements for Agent-driven precise commit focusing, multi-target highlighting, graph annotation badges, multi-result stepper navigation, and evidence grading.
- [Agent Git Graph Annotation & Spotlight Technical Architecture (Sub-Req 2)](technical/agent-git-graph-annotation-and-spotlight.md) - Sub-requirement 2: Technical specification for the spotlight context state machine, virtual window scroll coordination, annotation popover badges, and impact resolvers.
- [Agent Context Desensitization & Privacy PRD (Sub-Req 3)](prd/agent-context-desensitization-and-privacy.md) - Sub-requirement 3: Product requirements for client-side context desensitization, round-trip reversible masking, and zero-storage privacy filters.
- [Agent Context Desensitization & Unmasking Technical Architecture (Sub-Req 3)](technical/agent-context-desensitization-and-privacy.md) - Sub-requirement 3: Technical specification for the regex/entropy scanner, semantic placeholder substitution, streaming chunk buffer unmasker, and settings integration.
- [Agent Application Control & Security Architecture](technical/agent-app-control-and-security.md) - Standardized bounded tools for application control, project switching, UI navigation, and elimination of arbitrary system-level execution.
- [Agent Skills, WebMCP, Task Tracing & Service Diagnostics PRD](prd/agent-skills-mcp-and-observability.md) - Product requirements for custom Skill engine (Agent Skills standard), HTTP MCP & WebMCP tool expansion, agent task execution tracing, and service diagnostics.
- [Agent Skills, WebMCP, Task Tracing & Service Diagnostics Architecture](technical/agent-skills-mcp-and-observability.md) - Technical architecture for custom Skill engine (Agent Skills standard), WebMCP / HTTP MCP client, execution task traces, and service diagnostics.
- [Yggit Workdesk Virtual Teammate PRD](prd/yggit-workdesk-virtual-teammate.md) - Product requirements for the local-first Git virtual teammate, 4-category adaptive board, aggregated work cards, and deep Git evidence linking.
- [Yggit Workdesk UX Specification](ux/yggit-workdesk-ux.md) - Interaction and visual design specifications for the 4-column adaptive board, compact task cards, split-pane evidence viewer, and bottom Agent pill integration.
- [Yggit Workdesk Technical Architecture](technical/yggit-workdesk-architecture.md) - Technical specification for the dual-mode deterministic detection pipeline, 4-tier domain models, fingerprint deduplication, and Portable Check sharing protocol.
- [Smart Project Categorization & Governance PRD](prd/yggit-project-categorization-and-governance.md) - Product requirements for automated detection of bloated project folders, Agent-driven architecture-aware categorization, and safe batch grouping execution.
- [Smart Project Categorization & Governance Technical Architecture](technical/yggit-project-categorization-and-governance.md) - Technical specification for the organization hygiene detector, four-tier taxonomy pipeline, project-organizer Agent Skill, and dual-mode transactional catalog updates.
- [Large Repository Scalability & Segmented Rendering PRD](prd/large-repository-scalability.md) - Product requirements for defensive thresholds, lazy directory tree mounting, deep Git log search, and anti-freeze boundaries.
- [Large Repository Scalability & Segmented Rendering Technical Architecture](technical/large-repository-rendering-architecture.md) - Technical architecture for chunked branch listing, pruned tree traversal, native Git `--grep` / hash locate coordination, and SVG DAG safety limits.
- [SEO & README Optimization PRD](prd/seo-and-readme-optimization.md) - Product requirements for fixing manifest metadata, adding `robots.ts` / `sitemap.ts`, locale-aware OpenGraph/JSON-LD, internal route `noindex`, and multilingual README structure.

- [Theme Persistence & Hydration](technical/theme-hydration.md) - Cookie preference, system theme resolution, and consistent SSR/client initialization.
- [E2E Workflow Contracts](technical/e2e-workflow-contracts.md) - Locked-down Playwright E2E behavioral contracts for shared components, Git read/write/Edge parity, settings, and Agent Skill/MCP runtime injection.
- [Git Optimistic Updates & Incremental UI Specification](technical/git-optimistic-updates.md) - Phase 1 implemented optimistic worktree staging/unstaging queue and Phase 2 roadmap for branch, tag, remote, and catalog optimistic operations.

## Standards

- File size limit: Keep all source code files strictly within 600–800 lines of code. Split complex components into modular subcomponents and custom hooks. [Code Modularization Standards](technical/code-standards.md) · [TypeScript Move to File Guide](technical/typescript-move-to-file-guide.md).
- All UI icons must strictly use `react-icons` (e.g. `react-icons/lu`, `react-icons/io5`). Never use raw emojis for UI iconography.
- Local-first repository catalog and project switcher.
- SVG Bézier organic life-tree Git DAG renderer.
- Seam-level zero-gap date dividers.
- Full clipboard copy context menus across all columns.
