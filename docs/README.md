# Yggit Documentation

Welcome to the Yggit documentation repository. Yggit is a high-performance, organic Git visualization and repository management workbench.

## Architecture & Technical Designs

- [Edge-First Issue Diagnosis & Sharing PRD](prd/edge-first-issue-diagnosis-and-sharing.md) - Product requirements for zero-install Web/Edge deployment, interactive problem sharing (replacing static screenshots), and "who merged into who" topology tracing.
- [Edge-First & Dual-Mode Technical Architecture](technical/edge-first-issue-diagnosis-and-sharing.md) - Technical specification for the `IGitDriver` abstraction, `isomorphic-git` + Web File System Access API, IndexedDB handle persistence, and merge topology engine.
- [Git Virtual Window Graph Design](technical/git-virtual-window-graph.md) - Architecture and implementation plan for the 2-tier skeleton index and 200-commit sliding window virtual scroll graph.
- [Repository Identity & URL Routing Specification](../brain/794c2433-2f43-4553-8504-ac1ee92a392d/repository-identity-and-url-routing-design.md) - Stable Repo ID + Multi-Identity + Alias Resolver specification.
- [Temporary Repository Access & Favorites PRD](prd/temporary-repository-and-favorites.md) - Product requirements for browsing public repositories without cloning first ("Browse First, Star to Save").
- [Temporary Repository & Remote Provider Architecture](technical/temporary-repository-architecture.md) - Technical architecture for session-scoped temporary repos, Project Switcher favorites, and Remote Provider driver.
- [Agent Spotlight & Interactive Sharing PRD](prd/agent-spotlight-and-interactive-sharing.md) - Product requirements for the center floating pill Agent bar, zero-storage OpenAPI driving, and diagnostic lineage sharing.
- [Agent Spotlight & Zero-Storage OpenAPI Technical Architecture](technical/agent-spotlight-and-interactive-sharing.md) - Technical specification for the in-memory OpenAPI client, one-shot Git tool dispatcher, graph lineage highlighting/dimming, and stateless deep link sharing.

## Standards

- Local-first repository catalog and project switcher.
- SVG Bézier organic life-tree Git DAG renderer.
- Seam-level zero-gap date dividers (GitKraken-style).
- Full clipboard copy context menus across all columns.
