<div align="center">

<img src="./public/world-tree-assets/hero/hero_day_master_1672x941.webp" alt="Yggit — Open Source AI Git Workspace with World Tree DAG Visualization" width="840" />

# Yggit

**Your Git history, brought to life.**

Visualize Git history, manage worktrees, discover repository issues, and understand your code with AI. An open-source, local-first Git workspace built for the AI coding era.

**No installation · No sign-up · Open Source · Local-first**

<p>
  <a href="https://yggit.vercel.app"><strong>Try Online</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/DavidKk/yggit/releases"><strong>Download App</strong></a>
</p>

<p>
  <a href="./README.md">English</a> · <a href="./docs/readme/README.zh-CN.md">简体中文</a> · <a href="./docs/readme/README.zh-TW.md">繁體中文</a> · <a href="./docs/readme/README.ja.md">日本語</a> · <a href="./docs/readme/README.ko.md">한국어</a> · <a href="./docs/readme/README.fr.md">Français</a> · <a href="./docs/readme/README.de.md">Deutsch</a> · <a href="./docs/readme/README.es.md">Español</a> · <a href="./docs/readme/README.pt-BR.md">Português (Brasil)</a> · <a href="./docs/readme/README.ru.md">Русский</a>
</p>

<p>
  <a href="https://github.com/DavidKk/yggit/actions/workflows/ci.yml"><img src="https://github.com/DavidKk/yggit/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.19-brightgreen?style=flat-square&logo=node.js" alt="Node.js >= 22.19" /></a>
</p>

</div>

---

## Why Yggit?

Modern software development increasingly involves multiple repositories, parallel branches, isolated worktrees, and AI coding agents working side by side. Traditional Git clients either treat commit graphs as rigid industrial grids or stop at basic diff viewing.

Yggit brings together **organic commit graph clarity**, **proactive repository diagnostics**, and an **open, local-first AI assistant** in one workspace — runnable directly in your browser, as a local server, or as a standalone desktop app.

---

## Core Features

### Git, brought to life

Replace rigid subway-line commit grids with an **organic World Tree DAG**. Smooth cubic Bézier branch curves, trunk-to-side-branch visual hierarchy, zero-gap date seam dividers, and semantic node markers (Stash capsules, HEAD pulse rings, merge junctions) make complex branch histories effortless to read.

### Meet Yggi

An integrated **AI repository assistant** available as a draggable floating pill, quick-reply card, or resizable workspace drawer. Ask questions about branch stats, commit diffs, or merge history, generate commit messages, quote messages for follow-up, and inspect **Agent Spotlight** commit annotations backed by Fact / Derived / Hypothesis evidence grades.

### Stay ahead of Git problems

**Workdesk** continuously scans your active repositories for branch sync drift, unpushed commits awaiting review, diverged branches, parallel worktree clutter, and branch naming or organization hygiene issues — surfacing actionable tasks before they turn into merge headaches.

### One workspace, many repositories

Switch seamlessly across local and remote repositories, inspect branches and worktrees in parallel, and customize your branch context menu with pinned quick actions, cascading submenus, two-step confirmation for destructive actions, and adaptive capability filtering.

### Your code stays yours

Yggit is **local-first by design**. Repositories, caches, and encrypted credentials stay on your device, with built-in client-side context redaction for sensitive tokens, emails, and custom secrets before prompts are sent to third-party model providers.

### Bring your own AI

Connect your preferred intelligence layer without vendor lock-in:

- **Browser AI** — Chrome built-in Gemini Nano.
- **Browser Local AI** — Offline WebGPU / WASM open models running directly in your browser.
- **Local CLI Agents** — Claude, Codex, Gemini, Cursor, and Antigravity CLI adapters.
- **OpenAI-compatible & Cloud APIs** — DeepSeek, OpenAI, Claude, Ollama, and custom gateways with wildcard whitelist/blacklist model filters.
- **Skills & HTTP MCP** — Import `SKILL.md` workflows (local or GitHub) and connect Streamable HTTP MCP Servers with custom headers or MCP OAuth 2.0 (PKCE).

---

## Built for AI Coding

When multiple AI coding agents work across branches and worktrees simultaneously, Git state gets noisy fast. Yggit helps you stay in control:

- **Parallel Worktree & Agent Visibility** — Track active worktrees, unmerged commits, and branch divergence across repositories in one place.
- **Proactive Sync & Conflict Checks** — Catch behind/ahead drift, unpushed changes, and 3-way merge conflict risks early.
- **AI-Assisted Diff & History Understanding** — Use Yggi to summarize commits, trace where changes merged, and inspect evidence-graded commit highlights directly on the graph.
- **10-Language Interface** — Full UI localization in English, Simplified Chinese, Traditional Chinese, Japanese, Korean, French, German, Spanish, Brazilian Portuguese, and Russian.

---

## Runtime Modes

Yggit runs in three modes (`YGGIT_SERVICE`) sharing the same workspace experience:

| Mode               | How                                                     | Disk & Git Access                                                                                  |
| ------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Local**          | Node.js server alongside your repositories              | Full native Git CLI, local file access, encrypted local storage, and local CLI agent adapters      |
| **Desktop App**    | Standalone Electron desktop build (`YGGIT_SERVICE=app`) | Full native Git CLI, local file access, and desktop shell integration                              |
| **Edge / Browser** | Browser-first mode (`YGGIT_SERVICE=remote`)             | No server disk — opens local folders in Chromium via the File System Access API (`isomorphic-git`) |

---

## Privacy by Design

- **No account required**: Start using Yggit immediately with zero sign-up or telemetry.
- **Local-first storage**: Repository indexes, caches, and encrypted API tokens stay on your own machine.
- **Explicit external boundaries**: Requests to third-party LLM providers or remote MCP servers are sent directly only to endpoints you configure, with optional reversible client-side redaction. See `/settings/privacy` inside the app for details.

---

## Getting Started

Requires **Node.js ≥ 22.19.0** and **pnpm**.

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) (or the LAN URL printed at startup) to start using Yggit.

<details>
<summary>Common development, testing, and Desktop App build commands</summary>

| Command             | Purpose                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`          | Start development server (listens on LAN by default)                                                         |
| `pnpm dev:lan`      | Explicit LAN development server                                                                              |
| `pnpm dev:loopback` | Loopback-only development server (`127.0.0.1`)                                                               |
| `pnpm build`        | Build production Next.js bundle (`next build --webpack`)                                                     |
| `pnpm build:app`    | Build standalone App bundle and assemble `.electron-builder/app-root`                                        |
| `pnpm dist:mac`     | Package macOS `.app` and release `.zip` (`x64` + `arm64`)                                                    |
| `pnpm dist:win`     | Package Windows NSIS installer (`.exe`)                                                                      |
| `pnpm dist:dir`     | Package unpacked desktop app directory for local testing                                                     |
| `pnpm electron`     | Launch Electron desktop shell against Next dev server                                                        |
| `pnpm start`        | Start production server                                                                                      |
| `pnpm ok`           | Run `fix:imports`, Prettier format, ESLint (`--max-warnings=0`), typecheck, Jest tests, and production build |
| `pnpm ok:ci`        | CI verification (`format:check`, `lint:check`, `typecheck`, Jest tests, production build)                    |

</details>

## Documentation

- [Documentation Index](docs/README.md) — Architecture specs, PRDs, UX guides, and coding standards.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request, and use our [GitHub Issues](https://github.com/DavidKk/yggit/issues) templates for bug reports or feature requests. Security issues can be reported following [SECURITY.md](./SECURITY.md).

## License

Yggit is open-source software released under the [MIT License](./LICENSE).
