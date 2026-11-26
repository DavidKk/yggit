# Contributing to Yggit

Thank you for your interest in contributing to **Yggit**!

## Prerequisites

- **Node.js** `>= 22.19.0`
- **pnpm** (`corepack enable` or `npm i -g pnpm`)

## Getting Started

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

## Coding Standards

- Write all code comments and diagnostics/logs in **English**.
- All user-facing UI copy must support internationalization (`lib/i18n/`).
- Use `react-icons` for UI icons (avoid raw Unicode emojis in UI components).
- Keep source files modular and under 600–800 lines where practical.
- Use Conventional Commits for commit messages (enforced by `commitlint`).

## Verification Before Opening a PR

Run the full local check suite before submitting a pull request:

```bash
pnpm ok
```

This runs import fixes, Prettier formatting, ESLint (`--max-warnings=0`), TypeScript typechecking, the full Jest test suite, and the Next.js production build.

## Reporting Bugs & Requesting Features

Please use the GitHub Issue templates in `.github/ISSUE_TEMPLATE/` when reporting a bug or proposing a new feature.
