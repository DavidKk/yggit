# Yggit SEO & README Optimization PRD

## 1. Background & Context Review

A codebase review of Yggit's SEO metadata, PWA manifest, i18n routing, community files, and repository documentation (incorporating the P0 product positioning & SEO checklist) identified the following requirements:

1. **Legacy Manifest Pollution (`app/manifest.ts`)**: Previously contained leftover strings from an earlier template (`"Yggit Remote Play"`, `start_url: "/play"`). Fixed to Yggit's identity and `start_url: "/"`.
2. **Missing Crawler Entrypoints (`app/robots.ts` & `app/sitemap.ts`)**: Provide `robots.txt` (disallow `/api/`, `/dev/`, `/settings/`) and `sitemap.xml` (canonical non-redirecting public landing pages only, excluding `/privacy` redirect and empty workspace shells `/git`, `/workdesk`, `/import`).
3. **Internal Pages `noindex`**: `/dev/*` and `/settings/*` must emit `robots: { index: false, follow: false }`.
4. **Same-URL Dynamic i18n Hurts SEO**:
   - `/` is canonical English (`en`) and `x-default`.
   - Non-default locales (`/zh`, `/cht`, `/ja`, `/ko`, `/fr`, `/de`, `/es`, `/pt-BR`, `/ru`) have dedicated landing routes (`app/[locale]/page.tsx`), matching `<html lang>`, `canonical`, `hreflang` alternates, OpenGraph, and both `SoftwareApplication` + `WebSite` JSON-LD.
   - Internal workspace routes (`/git`, `/workdesk`, `/settings`, `/dev`) keep preference-based i18n with `noindex`.
5. **Product-First README (`README.md`, `README.zh-CN.md`)**:
   - Shift from engineering-heavy tech-stack framing to user-value framing:
     - Positioning: _An open-source, local-first, AI-powered visual Git workspace._
     - Slogan: _Your Git history, brought to life._
     - Centered hero banner, `No installation · No sign-up · Open Source · Local-first`, Try Online & Releases links, 6 value-oriented core features, dedicated **Built for AI Coding** section, 3 runtime modes (`Local`, `Desktop App`, `Edge / Browser`), Privacy by Design, concise Getting Started, Documentation, Contributing, and License.
6. **Open-Source Community Infrastructure**:
   - Add `CONTRIBUTING.md`, `SECURITY.md`, and `.github/ISSUE_TEMPLATE/` (`bug_report.yml`, `feature_request.yml`).

---

## 2. Scope & Phasing

### In Scope (This Release — P0)

- Technical SEO (`app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts`, `app/layout.tsx`, `app/page.tsx`, `app/[locale]/page.tsx`, `lib/seo/landing-metadata.ts`, `proxy.ts`, `lib/i18n/server.ts`, `dev/layout.tsx`, `settings/layout.tsx`, `LocaleSwitcher.tsx`).
- Product-first `README.md` and `README.zh-CN.md`.
- Community files: `CONTRIBUTING.md`, `SECURITY.md`, `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`.

### Deferred (P1 / P2)

- Dedicated `/features/*`, `/about`, `/blog`, `/changelog` marketing routes.
- Custom 1280×640 GitHub Social Preview graphic & Search Console / Bing Webmaster verification (owner-operated).

---

## 3. Verification Plan

- `pnpm ok` (`fix:imports`, `format`, `lint --max-warnings=0`, `typecheck`, `jest --runInBand`, `next build --webpack`) passes with 0 errors/warnings.
- Verify `/[locale]`, `/robots.txt`, `/sitemap.xml`, and `/manifest.webmanifest` are generated in `next build`.
