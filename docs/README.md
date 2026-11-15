# Yggit Documentation

Welcome to the Yggit documentation repository. Yggit is a high-performance, organic Git visualization and repository management workbench.

## Architecture & Technical Designs

- [Git Virtual Window Graph Design](technical/git-virtual-window-graph.md) - Architecture and implementation plan for the 2-tier skeleton index and 200-commit sliding window virtual scroll graph.
- [Repository Identity & URL Routing Specification](../brain/794c2433-2f43-4553-8504-ac1ee92a392d/repository-identity-and-url-routing-design.md) - Stable Repo ID + Multi-Identity + Alias Resolver specification.
- [Temporary Repository Access & Favorites PRD](prd/temporary-repository-and-favorites.md) - Product requirements for browsing public repositories without cloning first ("Browse First, Star to Save").
- [Temporary Repository & Remote Provider Architecture](technical/temporary-repository-architecture.md) - Technical architecture for session-scoped temporary repos, Project Switcher favorites, and Remote Provider driver.

## Standards

- Local-first repository catalog and project switcher.
- SVG Bézier organic life-tree Git DAG renderer.
- Seam-level zero-gap date dividers (GitKraken-style).
- Full clipboard copy context menus across all columns.
