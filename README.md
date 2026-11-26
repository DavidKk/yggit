[![Chinese docs](https://img.shields.io/badge/docs-Chinese-green?style=flat-square&logo=docs)](https://github.com/DavidKk/yggit/blob/main/README.zh-CN.md) [![English](https://img.shields.io/badge/docs-English-green?style=flat-square&logo=docs)](https://github.com/DavidKk/yggit/blob/main/README.md) [![Node.js](https://img.shields.io/badge/node-%3E%3D22.19-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org/) [![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)

# Yggit

**Yggit** (World Tree Git) transforms standard industrial grid Git graphs into an **organic life-tree network**. Built with Next.js 16, React 19, and Tailwind CSS 4, Yggit delivers a fast, local-first Git commit history workbench with an integrated AI assistant (**Yggi**), repository diagnostics, and extensible Skills & MCP tooling.

Runtime modes (`YGGIT_SERVICE`):

| Mode             | How                                                                       | Disk & Git Access                                                                                  |
| ---------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Local**        | Node.js server alongside your repositories                                | Full native Git CLI, local file access, encrypted local storage, and local CLI agent adapters      |
| **Desktop App**  | Standalone desktop build (`YGGIT_SERVICE=app` / `YGGIT_ELECTRON_BUILD=1`) | Full native Git CLI, local file access, and desktop shell integration                              |
| **Cloud / Edge** | Browser-first mode (`YGGIT_SERVICE=remote` / `VERCEL=1`)                  | No server disk — opens local folders in Chromium via the File System Access API (`isomorphic-git`) |

## Features

- **Organic World Tree DAG** — Cubic Bézier branch curves, smooth branch-to-trunk gradient convergence, trunk vs. side-branch stroke hierarchy, zero-gap seam date dividers, and semantic node styling (dashed Stash capsules, HEAD pulse rings, and merge junction nodes).
- **Yggi AI Repository Assistant** — Available as a draggable floating pill, quick-reply card, or resizable docked sidebar. Supports quote-and-follow-up conversations, AI commit message generation, and **Agent Spotlight** commit inspection with Fact / Derived / Hypothesis attribution evidence.
- **Multi-Tier Model & Provider Ecosystem** — Supports **Browser AI** (Chrome built-in Gemini Nano), **Browser Local AI** (offline WebGPU / WASM models), local **CLI Agents** (Claude, Codex, Gemini, Cursor, Antigravity), and **OpenAI-compatible / DeepSeek / Claude / Ollama** channels with wildcard whitelist/blacklist filtering.
- **Agent Skills (`SKILL.md`) & HTTP MCP** — Import local `SKILL.md` files or sync skill repositories from GitHub; connect external **Streamable HTTP MCP Servers** with custom headers or **MCP OAuth 2.0 (PKCE)** and per-tool toggles.
- **Workdesk & Repository Diagnostics** — Automated branch synchronization checks, unmerged commit detection, organization hygiene diagnostics, and 3-way merge conflict analysis.
- **Customizable Context Menus** — Pin high-frequency branch actions, toggle cascading submenus, enable two-step confirmation for destructive operations, and filter actions adaptively by repository capability.
- **Developer Observability** — Built-in `/dev/logs/operations` and `/dev/logs/context` views for inspecting operation error stacks, multi-level logs, and Agent context traces with one-click diagnostics export.
- **10-Language Localization** — Full UI internationalization across English, Simplified Chinese, Traditional Chinese, Japanese, Korean, French, German, Spanish, Brazilian Portuguese, and Russian.
- **Local-First & Privacy-First** — API keys and tokens are encrypted locally; no account is required and no personal configuration data is collected.

## Local Development

Requires **Node.js ≥ 22.19.0** and **pnpm**.

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) (or the LAN URL printed at startup) to view your repositories.

| Command             | Purpose                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`          | Start development server (listens on LAN by default)                                                             |
| `pnpm dev:lan`      | Explicit LAN development server                                                                                  |
| `pnpm dev:loopback` | Loopback-only development server (`127.0.0.1`)                                                                   |
| `pnpm build`        | Build production Next.js bundle (`next build --webpack`; set `YGGIT_ELECTRON_BUILD=1` for standalone App output) |
| `pnpm build:app`    | Build standalone App bundle and assemble `.electron-builder/app-root`                                            |
| `pnpm dist:mac`     | Package macOS `.app` and release `.zip` (`x64` + `arm64`)                                                        |
| `pnpm dist:win`     | Package Windows NSIS installer (`.exe`)                                                                          |
| `pnpm dist:dir`     | Package unpacked desktop app directory for local testing                                                         |
| `pnpm electron`     | Launch Electron desktop shell against Next dev server                                                            |
| `pnpm start`        | Start production server                                                                                          |
| `pnpm ok`           | Run `fix:imports`, Prettier format, ESLint (`--max-warnings=0`), typecheck, Jest tests, and production build     |
| `pnpm ok:ci`        | CI verification (`format:check`, `lint:check`, `typecheck`, Jest tests, production build)                        |

GitHub Actions: [CI](.github/workflows/ci.yml) runs automated checks on `main` and pull requests.

Development documentation index: [docs/README.md](docs/README.md).

## Project Layout

```text
yggdrasil/
  app/          Next.js App Router pages & API routes
  components/   Git graph, Yggi AI workspace, Workdesk, Dev Logs, and Settings UI
  hooks/        Shared React hooks
  lib/          Agent runtime, i18n messages, Git helpers, logger, and security utilities
  services/     Git service layer and tooling scripts
  docs/         PRDs, UX notes, and technical architecture docs
  data/         Local runtime data & caches (gitignored)
```

## Privacy

Yggit requires no sign-in and collects no personally identifiable information. In Local and Desktop App modes, repositories, caches, and encrypted credentials remain strictly on your device. Requests to third-party LLM providers or remote MCP servers are sent directly according to the endpoints you configure. See `/privacy` in the app for details.

## License

Yggit is open-source software released under the [MIT License](./LICENSE).
