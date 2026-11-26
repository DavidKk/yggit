<div align="center">

<img src="../../public/world-tree-assets/hero/hero_day_master_1672x941.webp" alt="Yggit — Open-Source KI-Git-Workspace mit Weltenbaum-DAG" width="840" />

# Yggit

**Your Git history, brought to life.**

Visualisiere Git-Verläufe, verwalte Worktrees, erkenne Repository-Probleme frühzeitig und verstehe deinen Code mit KI. Ein quelloffener, local-first Git-Workspace für die Ära des AI Coding.

**Keine Installation · Keine Registrierung · Open Source · Local-first**

<p>
  <a href="https://yggit.vercel.app"><strong>Online testen</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/DavidKk/yggit/releases"><strong>App herunterladen</strong></a>
</p>

<p>
  <a href="../../README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a> · <a href="./README.zh-TW.md">繁體中文</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.fr.md">Français</a> · <a href="./README.de.md">Deutsch</a> · <a href="./README.es.md">Español</a> · <a href="./README.pt-BR.md">Português (Brasil)</a> · <a href="./README.ru.md">Русский</a>
</p>

<p>
  <a href="https://github.com/DavidKk/yggit/actions/workflows/ci.yml"><img src="https://github.com/DavidKk/yggit/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.19-brightgreen?style=flat-square&logo=node.js" alt="Node.js >= 22.19" /></a>
</p>

</div>

---

## Warum Yggit?

Moderne Softwareentwicklung umfasst zunehmend mehrere Repositories, parallele Branches, isolierte Worktrees und mehrere KI-Coding-Agents, die gleichzeitig arbeiten. Klassische Git-Clients beschränken sich oft auf starre Linienraster oder einfache Diff-Ansichten.

Yggit vereint **organische Commit-Graph-Klarheit**, **proaktive Repository-Diagnose** und einen **offenen, local-first KI-Assistenten** in einem Workspace – direkt im Browser, als lokaler Server oder als eigenständige Desktop-App.

---

## Kernfunktionen

### Git, brought to life — Weltenbaum-Git-Visualisierung

Ersetze starre U-Bahn-Netz-Raster durch einen **organischen Weltenbaum-DAG**: weiche kubische Bézier-Kurven, klare visuelle Hierarchie zwischen Stamm und Seiten-Branches, lückenlose Datumstrenner und semantische Knotenmarker (Stash-Kapseln, HEAD-Pulsring, Merge-Knoten).

### Meet Yggi — Integrierter KI-Repository-Assistent

Verfügbar als verschiebbare Floating-Pill, Quick-Reply-Karte oder größenveränderbare Seitenleiste. Stelle Fragen zu Branches, Commits oder Merges, generiere Commit-Nachrichten, zitiere Antworten für Rückfragen und nutze **Agent Spotlight** mit Fact / Derived / Hypothesis Evidenzstufen.

### Stay ahead of Git problems — Workdesk-Diagnose

**Workdesk** scannt aktive Repositories kontinuierlich auf Branch-Sync-Abweichungen, ausstehende unpushte Commits, divergierte Branches, paralleles Worktree-Chaos sowie Benennungs- und Strukturprobleme – bevor Merge-Konflikte entstehen.

### One workspace, many repositories — Multi-Repo & Worktrees

Wechsle nahtlos zwischen lokalen und entfernten Repositories und passe dein Branch-Kontextmenü flexibel an: angepinnte Schnellaktionen, Untermenüs, Zwei-Schritt-Bestätigung für destruktive Aktionen und adaptive Filterung.

### Your code stays yours — Local-first & Datenschutz

**Local-first by Design**: Repository-Indizes, Caches und verschlüsselte Zugangsdaten bleiben auf deinem Gerät – inklusive umkehrbarer clientseitiger Maskierung von Tokens, E-Mails und eigenen Mustern vor dem Versand an externe Modelle.

### Bring your own AI — Offenes KI- & MCP-Ökosystem

Binde deine bevorzugten Modelle ohne Vendor-Lock-in an:

- **Browser AI** — Chromes integriertes Gemini Nano.
- **Browser Local AI** — Offline-Modelle direkt im Browser via WebGPU / WASM.
- **Lokale CLI-Agents** — Adapter für Claude, Codex, Gemini, Cursor und Antigravity CLI.
- **OpenAI-kompatible & Cloud-APIs** — DeepSeek, OpenAI, Claude, Ollama und eigene Gateways mit Wildcard-Whitelist/Blacklist.
- **Skills & HTTP MCP** — `SKILL.md` Workflows (lokal / GitHub) und Streamable HTTP MCP-Server mit Custom Headers oder MCP OAuth 2.0 (PKCE).

---

## Entwickelt für AI Coding

Wenn mehrere KI-Agents gleichzeitig in verschiedenen Branches und Worktrees arbeiten, wird der Git-Status schnell unübersichtlich. Yggit hält alles unter Kontrolle:

- **Parallele Worktree- & Agent-Transparenz** — Behalte aktive Worktrees, ungemergte Commits und Abweichungen zentral im Blick.
- **Proaktive Sync- & Konfliktprüfungen** — Erkenne Ahead/Behind-Drifts und 3-Wege-Merge-Konfliktrisiken frühzeitig.
- **KI-gestütztes Diff- & Verlaufsverständnis** — Lass Yggi Änderungen zusammenfassen und Merge-Pfade direkt im Graphen markieren.
- **10 Sprachen** — Vollständig lokalisiert in Englisch, Chinesisch (vereinfacht/traditionell), Japanisch, Koreanisch, Französisch, Deutsch, Spanisch, Brasilianischem Portugiesisch und Russisch.

---

## Ausführungsmodi

Yggit unterstützt drei Modi (`YGGIT_SERVICE`) mit identischer Oberfläche:

| Modus              | Funktionsweise                                           | Festplatten- & Git-Zugriff                                                                                 |
| ------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Local**          | Node.js-Server neben deinen Repositories                 | Volle native Git-CLI, lokaler Dateizugriff, verschlüsselter Speicher und lokale CLI-Agent-Adapter          |
| **Desktop App**    | Eigenständige Electron-Desktop-App (`YGGIT_SERVICE=app`) | Volle native Git-CLI, lokaler Dateizugriff und Desktop-Integration                                         |
| **Edge / Browser** | Browser-Modus ohne Installation (`YGGIT_SERVICE=remote`) | Kein Server-Speicher – öffnet lokale Ordner in Chromium über die File System Access API (`isomorphic-git`) |

---

## Privacy by Design

- **Kein Konto erforderlich**: Sofort nutzbar ohne Anmeldung oder Telemetrie.
- **Lokale Datenhaltung**: Indizes, Caches und verschlüsselte Tokens verbleiben auf deinem Gerät.
- **Klare externe Grenzen**: Anfragen gehen nur an explizit konfigurierte LLM- oder MCP-Endpunkte, optional mit clientseitiger Redaktion. Siehe `/settings/privacy` in der App.

---

## Erste Schritte

Erfordert **Node.js ≥ 22.19.0** und **pnpm**.

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

Öffne [http://localhost:3000](http://localhost:3000) (oder die beim Start ausgegebene LAN-URL).

<details>
<summary>Entwicklungs-, Test- und Desktop-App-Build-Befehle</summary>

| Befehl              | Zweck                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm dev`          | Entwicklungsserver starten (lauscht standardmäßig im LAN)                                 |
| `pnpm dev:lan`      | Expliziter LAN-Entwicklungsserver                                                         |
| `pnpm dev:loopback` | Nur Loopback (`127.0.0.1`)                                                                |
| `pnpm build`        | Produktions-Next.js-Bundle bauen                                                          |
| `pnpm build:app`    | Eigenständiges App-Bundle und `.electron-builder/app-root` erstellen                      |
| `pnpm dist:mac`     | macOS `.app` und `.zip` (`x64` + `arm64`) paketieren                                      |
| `pnpm dist:win`     | Windows NSIS-Installer (`.exe`) paketieren                                                |
| `pnpm dist:dir`     | Entpacktes App-Verzeichnis für lokale Tests erstellen                                     |
| `pnpm electron`     | Electron-Shell gegen Next-Dev-Server starten                                              |
| `pnpm start`        | Produktionsserver starten                                                                 |
| `pnpm ok`           | `fix:imports`, Prettier, ESLint (`--max-warnings=0`), Typecheck, Jest und Build ausführen |
| `pnpm ok:ci`        | Vollständige CI-Prüfung                                                                   |

</details>

## Dokumentation

- [Dokumentationsindex](../README.md) — Architektur-Specs, PRDs, UX-Leitfäden und Code-Standards.

## Mitwirken

Beiträge sind willkommen! Bitte lies vor einem Pull Request [CONTRIBUTING.md](../../CONTRIBUTING.md) und nutze unsere [GitHub Issues](https://github.com/DavidKk/yggit/issues) Vorlagen. Sicherheitslücken bitte gemäß [SECURITY.md](../../SECURITY.md) melden.

## Lizenz

Yggit ist Open-Source-Software unter der [MIT-Lizenz](../../LICENSE).
