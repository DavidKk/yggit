<div align="center">

<img src="../../public/world-tree-assets/hero/hero_day_master_1672x941.webp" alt="Yggit — Espace de travail Git IA Open Source avec graphe Arbre-Monde" width="840" />

# Yggit

**Your Git history, brought to life.**

Visualisez votre historique Git, gérez vos worktrees, détectez les problèmes de dépôt et comprenez votre code avec l'IA. Un espace de travail Git open source, local-first, conçu pour l'ère du développement assisté par IA.

**Sans installation · Sans inscription · Open Source · Local-first**

<p>
  <a href="https://yggit.vercel.app"><strong>Essayer en ligne</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/DavidKk/yggit/releases"><strong>Télécharger l'app</strong></a>
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

## Pourquoi Yggit ?

Le développement moderne implique de plus en plus de dépôts multiples, de branches parallèles, de worktrees isolés et d'agents de code IA travaillant simultanément. Les clients Git classiques se limitent souvent à des grilles rigides ou à de simples vues de diff.

Yggit réunit dans un même espace **un graphe de commits organique**, **des diagnostics proactifs de dépôt** et **un assistant IA local-first ouvert** — utilisable directement dans votre navigateur, en serveur local ou en application de bureau autonome.

---

## Fonctionnalités clés

### Git, brought to life — Graphe Git Arbre-Monde

Remplacez les grilles industrielles rigides par un **DAG organique en Arbre-Monde** : courbes de Bézier cubiques fluides, hiérarchie visuelle entre tronc et branches secondaires, séparateurs temporels sans espace perdu et marqueurs sémantiques (capsules Stash, anneau HEAD, nœuds de fusion).

### Meet Yggi — Assistant IA de dépôt

Disponible sous forme de pilule flottante déplaçable, carte de réponse rapide ou panneau latéral redimensionnable. Posez des questions sur vos branches, commits ou fusions, générez des messages de commit, citez des messages pour approfondir et explorez **Agent Spotlight** avec niveaux de preuve Fact / Derived / Hypothesis.

### Stay ahead of Git problems — Diagnostics Workdesk

**Workdesk** analyse en continu vos dépôts actifs pour détecter les dérives de synchronisation, les commits non poussés à relire, les branches divergentes, l'encombrement des worktrees parallèles et les anomalies de nommage avant qu'elles ne causent des conflits.

### One workspace, many repositories — Multi-dépôts & Worktrees

Basculez facilement entre dépôts locaux et distants et personnalisez votre menu contextuel de branche : actions rapides épinglées, sous-menus en cascade, double confirmation pour les actions destructives et filtrage adaptatif.

### Your code stays yours — Local-first & Confidentialité

**Local-first par conception** : vos dépôts, caches et jetons chiffrés restent sur votre appareil, avec masquage réversible côté client des secrets, e-mails et motifs sensibles avant tout envoi vers un fournisseur de modèles externe.

### Bring your own AI — Écosystème IA & MCP ouvert

Connectez vos propres modèles sans verrouillage fournisseur :

- **Browser AI** — Gemini Nano intégré à Chrome.
- **Browser Local AI** — Modèles open source hors ligne via WebGPU / WASM dans le navigateur.
- **Agents CLI locaux** — Adaptateurs pour Claude, Codex, Gemini, Cursor et Antigravity CLI.
- **APIs compatibles OpenAI & Cloud** — DeepSeek, OpenAI, Claude, Ollama et passerelles personnalisées avec listes blanches/noires par jokers.
- **Skills & HTTP MCP** — Importez des workflows `SKILL.md` (locaux ou GitHub) et connectez des serveurs Streamable HTTP MCP avec en-têtes personnalisés ou OAuth 2.0 (PKCE).

---

## Conçu pour le développement avec IA

Lorsque plusieurs agents IA modifient des branches et worktrees en parallèle, l'état Git devient vite complexe. Yggit vous aide à garder le contrôle :

- **Visibilité parallèle des Worktrees et Agents** — Suivez les worktrees actifs, les commits non fusionnés et les divergences au même endroit.
- **Détection proactive des synchronisations et conflits** — Repérez tôt les retards/avances et les risques de conflit de fusion à 3 voies.
- **Compréhension des Diffs par IA** — Résumez les changements et tracez l'origine des fusions directement sur le graphe.
- **Interface en 10 langues** — Anglais, chinois simplifié/traditionnel, japonais, coréen, français, allemand, espagnol, portugais brésilien et russe.

---

## Modes d'exécution

Yggit propose trois modes (`YGGIT_SERVICE`) partageant la même expérience :

| Mode               | Fonctionnement                                             | Accès disque & Git                                                                                           |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Local**          | Serveur Node.js près de vos dépôts                         | Git CLI natif complet, accès fichiers local, stockage chiffré et adaptateurs CLI locaux                      |
| **Desktop App**    | Application Electron autonome (`YGGIT_SERVICE=app`)        | Git CLI natif complet, accès fichiers local et intégration bureau                                            |
| **Edge / Browser** | Mode navigateur sans installation (`YGGIT_SERVICE=remote`) | Aucun disque serveur — ouvre les dossiers locaux dans Chromium via File System Access API (`isomorphic-git`) |

---

## Confidentialité par conception

- **Aucun compte requis** : utilisez Yggit immédiatement, sans inscription ni télémétrie.
- **Stockage local-first** : index, caches et jetons chiffrés restent sur votre machine.
- **Frontières externes explicites** : les requêtes vers des LLM ou serveurs MCP tiers ne partent que vers les points de terminaison que vous configurez, avec masquage côté client en option. Voir `/settings/privacy` dans l'application.

---

## Démarrage rapide

Nécessite **Node.js ≥ 22.19.0** et **pnpm**.

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) (ou l'URL LAN affichée au démarrage).

<details>
<summary>Commandes de développement, tests et packaging Desktop App</summary>

| Commande            | Usage                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev`          | Démarre le serveur de développement (écoute LAN par défaut)                            |
| `pnpm dev:lan`      | Serveur de développement LAN explicite                                                 |
| `pnpm dev:loopback` | Serveur local uniquement (`127.0.0.1`)                                                 |
| `pnpm build`        | Compile le bundle Next.js de production                                                |
| `pnpm build:app`    | Compile le bundle App autonome et prépare `.electron-builder/app-root`                 |
| `pnpm dist:mac`     | Empaquette `.app` macOS et `.zip` (`x64` + `arm64`)                                    |
| `pnpm dist:win`     | Empaquette l'installateur Windows NSIS (`.exe`)                                        |
| `pnpm dist:dir`     | Génère le dossier d'application non empaqueté pour test local                          |
| `pnpm electron`     | Lance Electron connecté au serveur de développement Next                               |
| `pnpm start`        | Démarre le serveur de production                                                       |
| `pnpm ok`           | Exécute `fix:imports`, Prettier, ESLint (`--max-warnings=0`), typecheck, Jest et build |
| `pnpm ok:ci`        | Vérification CI complète                                                               |

</details>

## Documentation

- [Index de la documentation](../README.md) — Spécifications d'architecture, PRDs, guides UX et standards de code.

## Contribuer

Les contributions sont les bienvenues ! Consultez [CONTRIBUTING.md](../../CONTRIBUTING.md) avant d'ouvrir une PR, et utilisez nos modèles sur [GitHub Issues](https://github.com/DavidKk/yggit/issues). Pour signaler une faille de sécurité, suivez [SECURITY.md](../../SECURITY.md).

## Licence

Yggit est un logiciel open source publié sous [licence MIT](../../LICENSE).
