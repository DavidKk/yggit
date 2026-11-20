# Agent notes

- Product details belong in code and `docs/`.
- All comments must be written in English.
- User-facing text must support i18n (`lib/i18n/`).
- Documentation index is located at `docs/README.md`.
- All UI icons must strictly use `react-icons` (e.g. `react-icons/lu`, `react-icons/io5`). Never use raw Unicode emojis for UI iconography.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
