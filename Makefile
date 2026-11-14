.PHONY: help dev dev-loopback start build test typecheck lint format ok check

help:
	@echo "Yggdrasil CLI recipes:"
	@echo "  make dev          - Start web dev server (LAN :3000)"
	@echo "  make dev-loopback - Start loopback dev server (127.0.0.1:3000)"
	@echo "  make start        - Start production web server (:3927)"
	@echo "  make build        - Full build (native + Next.js)"
	@echo "  make test         - Run unit tests"
	@echo "  make typecheck    - TypeScript type check"
	@echo "  make check        - Pre-commit check (format:check + lint:check + typecheck)"
	@echo "  make ok           - Full verification and build (format + lint + typecheck + test + build)"

dev:
	pnpm dev

dev-loopback:
	pnpm dev:loopback

start:
	pnpm start

build:
	pnpm build

test:
	pnpm test

typecheck:
	pnpm typecheck

lint:
	pnpm lint:check

format:
	pnpm format

check:
	pnpm format:check && pnpm lint:check && pnpm typecheck

ok:
	pnpm ok
