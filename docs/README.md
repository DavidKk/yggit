# Yggit Documentation

Welcome to the Yggit documentation repository. Yggit is a high-performance, organic Git visualization and repository management workbench.

## Architecture & Technical Designs

- [Edge-First Issue Diagnosis & Sharing PRD](prd/edge-first-issue-diagnosis-and-sharing.md) - Product requirements for zero-install Web/Edge deployment, interactive problem sharing (replacing static screenshots), and "who merged into who" topology tracing.
- [Edge-First & Dual-Mode Technical Architecture](technical/edge-first-issue-diagnosis-and-sharing.md) - Technical specification for the `IGitDriver` abstraction, `isomorphic-git` + Web File System Access API, IndexedDB handle persistence, and merge topology engine.
- [Git Virtual Window Graph Design](technical/git-virtual-window-graph.md) - Architecture and implementation plan for the 2-tier skeleton index and 200-commit sliding window virtual scroll graph.
- [Repository Identity & URL Routing Specification](../brain/794c2433-2f43-4553-8504-ac1ee92a392d/repository-identity-and-url-routing-design.md) - Stable Repo ID + Multi-Identity + Alias Resolver specification.
- [Temporary Repository Access & Favorites PRD](prd/temporary-repository-and-favorites.md) - Product requirements for browsing public repositories without cloning first ("Browse First, Star to Save").
- [Temporary Repository & Remote Provider Architecture](technical/temporary-repository-architecture.md) - Technical architecture for session-scoped temporary repos, Project Switcher favorites, and Remote Provider driver.
- [Agent Spotlight & Interactive Sharing PRD (Sub-Req 1)](prd/agent-spotlight-and-interactive-sharing.md) - Sub-requirement 1: Product requirements for the center floating pill Agent bar, zero-storage OpenAPI driving, and diagnostic lineage sharing.
- [Agent Spotlight & Zero-Storage OpenAPI Technical Architecture (Sub-Req 1)](technical/agent-spotlight-and-interactive-sharing.md) - Sub-requirement 1: Technical specification for the in-memory OpenAPI client, one-shot Git tool dispatcher, graph lineage highlighting/dimming, and stateless deep link sharing.
- [Agent Model Connections](technical/agent-model-connections.md) - Model connection list, draft editing, testing, selection, and in-memory credentials.
- [Agent Dockable Workspace UX Specification](ux/agent-dockable-workspace-ux.md) - Interaction design for the bottom floating pill, in-place quick response cards, dockable side/bottom workspaces, and explicit dual-track context.
- [Agent Git Graph Annotation & Spotlight PRD (Sub-Req 2)](prd/agent-git-graph-annotation-and-spotlight.md) - Sub-requirement 2: Product requirements for Agent-driven precise commit focusing, multi-target highlighting, graph annotation badges, multi-result stepper navigation, and evidence grading.
- [Agent Git Graph Annotation & Spotlight Technical Architecture (Sub-Req 2)](technical/agent-git-graph-annotation-and-spotlight.md) - Sub-requirement 2: Technical specification for the spotlight context state machine, virtual window scroll coordination, annotation popover badges, and impact resolvers.
- [Agent Context Desensitization & Privacy PRD (Sub-Req 3)](prd/agent-context-desensitization-and-privacy.md) - Sub-requirement 3: Product requirements for client-side context desensitization, round-trip reversible masking, and zero-storage privacy filters.
- [Agent Context Desensitization & Unmasking Technical Architecture (Sub-Req 3)](technical/agent-context-desensitization-and-privacy.md) - Sub-requirement 3: Technical specification for the regex/entropy scanner, semantic placeholder substitution, streaming chunk buffer unmasker, and settings integration.

## Standards

- Local-first repository catalog and project switcher.
- SVG Bézier organic life-tree Git DAG renderer.
- Seam-level zero-gap date dividers (GitKraken-style).
- Full clipboard copy context menus across all columns.
