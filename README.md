# Yggit

<p align="center">
  <strong>Organic World Tree Git Graph & Repository Workbench</strong>
</p>

<p align="center">
  <a href="./README.zh-CN.md">简体中文</a> | <a href="./README.md">English</a>
</p>

---

## Overview

**Yggit** (World Tree Git) transforms standard industrial grid Git graphs into an **organic life-tree network**. Built with Next.js, React 19, and Tailwind CSS, Yggit provides a fast, aesthetic, and local-first Git commit history visualization and repository management experience.

## Key Features

- 🌳 **Organic World Tree DAG** — Cubic Bézier branch curves, smooth branch-to-trunk gradient convergence, and trunk vs. side-branch line-width differentiation.
- ⏱️ **GitKraken-Style Seam Dividers** — Zero-gap date grouping dividers seamlessly positioned on commit seams without stretching or inflating graph lane geometry.
- 🌿 **Semantic Node Styling** — Circular dashed stash capsules, head ring pulse animations, and merge junction nodes.
- 📋 **Comprehensive Context Actions** — Right-click context menus across all columns (copy branch name, commit subject, full/short hash, author, and timestamp).
- 🧭 **Multi-Repository Workspace Switcher** — Seamlessly manage and switch between local and remote repositories with real-time status detection.
- ⚡ **High Performance & React Memoization** — Decoupled SVG graph layers preventing unnecessary re-renders during loading or state changes.
- 🌐 **Full Internationalization (i18n)** — Native multi-language support (English and Simplified Chinese).

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/DavidKk/yggit.git
cd yggit

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to view your Git repository log.

### Build & Production

```bash
# Production build
pnpm build

# Start production server
pnpm start
```

## License

MIT © [DavidJones](https://github.com/DavidKk)
