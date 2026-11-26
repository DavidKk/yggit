<div align="center">

<img src="../../public/world-tree-assets/hero/hero_day_master_1672x941.webp" alt="Yggit — Workspace Git com IA Open Source e grafo Árvore do Mundo" width="840" />

# Yggit

**Your Git history, brought to life.**

Visualize o histórico do Git, gerencie worktrees, descubra problemas no repositório e entenda seu código com IA. Um workspace Git open source e local-first feito para a era do AI coding.

**Sem instalação · Sem cadastro · Open Source · Local-first**

<p>
  <a href="https://yggit.vercel.app"><strong>Testar online</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/DavidKk/yggit/releases"><strong>Baixar App</strong></a>
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

## Por que escolher o Yggit?

O desenvolvimento moderno envolve cada vez mais múltiplos repositórios, branches paralelos, worktrees isolados e agentes de IA trabalhando ao mesmo tempo. Clientes Git tradicionais costumam se limitar a grades rígidas ou visualizadores simples de diff.

O Yggit reúne **clareza orgânica de grafo de commits**, **diagnósticos proativos de repositório** e **um assistente de IA aberto e local-first** em um único workspace — rodando direto no navegador, como servidor local ou como aplicativo desktop independente.

---

## Principais recursos

### Git, brought to life — Visualização Árvore do Mundo

Substitua grades industriais por um **DAG orgânico em Árvore do Mundo**: curvas Bézier cúbicas suaves, hierarquia visual entre tronco e branches secundários, divisores de data sem espaços vazios e nós semânticos (cápsulas Stash, anel HEAD e junções de merge).

### Meet Yggi — Assistente de IA para repositórios

Disponível como pílula flutuante arrastável, cartão de resposta rápida ou painel lateral redimensionável. Pergunte sobre estatísticas de branches, diffs ou histórico de merges, gere mensagens de commit, cite respostas e inspecione destaques **Agent Spotlight** com níveis de evidência Fact / Derived / Hypothesis.

### Stay ahead of Git problems — Diagnósticos Workdesk

O **Workdesk** monitora continuamente seus repositórios ativos para detectar desvios de sincronização, commits sem push aguardando revisão, branches divergentes, excesso de worktrees paralelos e problemas de nomenclatura antes que virem conflitos.

### One workspace, many repositories — Multirrepositório e Worktrees

Alterne facilmente entre repositórios locais e remotos e personalize o menu de contexto de branches: ações rápidas fixadas, submenus em cascata, confirmação em duas etapas para ações destrutivas e filtragem adaptativa.

### Your code stays yours — Local-first e privacidade

**Local-first por padrão**: índices, caches e credenciais criptografadas ficam no seu dispositivo, com mascaramento reversível no cliente para tokens, e-mails e segredos personalizados antes do envio a provedores externos.

### Bring your own AI — Ecossistema aberto de IA e MCP

Conecte seus modelos preferidos sem aprisionamento:

- **Browser AI** — Gemini Nano integrado ao Chrome.
- **Browser Local AI** — Modelos open source offline via WebGPU / WASM no navegador.
- **Agentes CLI locais** — Adaptadores para Claude, Codex, Gemini, Cursor e Antigravity CLI.
- **APIs compatíveis com OpenAI e Cloud** — DeepSeek, OpenAI, Claude, Ollama e gateways próprios com filtros wildcard de allowlist/blocklist.
- **Skills e HTTP MCP** — Importe fluxos `SKILL.md` (locais ou GitHub) e conecte servidores Streamable HTTP MCP com cabeçalhos customizados ou MCP OAuth 2.0 (PKCE).

---

## Feito para AI Coding

Quando vários agentes de IA trabalham em paralelo em branches e worktrees diferentes, o estado do Git fica confuso rapidamente. O Yggit mantém tudo sob controle:

- **Visibilidade paralela de Worktrees e Agentes** — Acompanhe worktrees ativos, commits não mesclados e divergências em um só lugar.
- **Detecção proativa de sincronização e conflitos** — Identifique desvios e riscos de conflito de merge 3-way com antecedência.
- **Compreensão de Diffs e histórico com IA** — Resuma mudanças e rastreie onde cada alteração foi mesclada diretamente no grafo.
- **Interface em 10 idiomas** — Inglês, chinês simplificado/tradicional, japonês, coreano, francês, alemão, espanhol, português brasileiro e russo.

---

## Modos de execução

O Yggit roda em três modos (`YGGIT_SERVICE`) mantendo a mesma experiência:

| Modo               | Como funciona                                          | Acesso a disco e Git                                                                                   |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Local**          | Servidor Node.js junto aos seus repositórios           | Git CLI nativo completo, acesso local a arquivos, armazenamento criptografado e adaptadores CLI locais |
| **Desktop App**    | Aplicativo Electron independente (`YGGIT_SERVICE=app`) | Git CLI nativo completo, acesso local a arquivos e integração desktop                                  |
| **Edge / Browser** | Modo navegador sem instalação (`YGGIT_SERVICE=remote`) | Sem disco no servidor — abre pastas locais no Chromium via File System Access API (`isomorphic-git`)   |

---

## Privacidade por design

- **Sem necessidade de conta**: Comece a usar imediatamente, sem cadastro ou telemetria.
- **Armazenamento local-first**: Índices, caches e tokens criptografados permanecem na sua máquina.
- **Fronteiras externas explícitas**: As requisições só vão para os endpoints LLM ou MCP configurados por você, com redação opcional no cliente. Veja `/settings/privacy` no aplicativo.

---

## Primeiros passos

Requer **Node.js ≥ 22.19.0** e **pnpm**.

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000) (ou a URL LAN exibida ao iniciar).

<details>
<summary>Comandos de desenvolvimento, testes e empacotamento Desktop App</summary>

| Comando             | Finalidade                                                                            |
| ------------------- | ------------------------------------------------------------------------------------- |
| `pnpm dev`          | Inicia o servidor de desenvolvimento (escuta na LAN por padrão)                       |
| `pnpm dev:lan`      | Servidor de desenvolvimento LAN explícito                                             |
| `pnpm dev:loopback` | Servidor apenas em loopback (`127.0.0.1`)                                             |
| `pnpm build`        | Compila o bundle de produção Next.js                                                  |
| `pnpm build:app`    | Compila o bundle App standalone e monta `.electron-builder/app-root`                  |
| `pnpm dist:mac`     | Empacota `.app` para macOS e `.zip` (`x64` + `arm64`)                                 |
| `pnpm dist:win`     | Empacota instalador Windows NSIS (`.exe`)                                             |
| `pnpm dist:dir`     | Empacota diretório descompactado para testes locais                                   |
| `pnpm electron`     | Inicia o shell Electron conectado ao servidor Next dev                                |
| `pnpm start`        | Inicia o servidor de produção                                                         |
| `pnpm ok`           | Executa `fix:imports`, Prettier, ESLint (`--max-warnings=0`), typecheck, Jest e build |
| `pnpm ok:ci`        | Verificação completa de CI                                                            |

</details>

## Documentação

- [Índice da documentação](../README.md) — Especificações de arquitetura, PRDs, guias UX e padrões de código.

## Contribuindo

Contribuições são bem-vindas! Leia [CONTRIBUTING.md](../../CONTRIBUTING.md) antes de abrir um Pull Request e use os templates em [GitHub Issues](https://github.com/DavidKk/yggit/issues). Para reportar falhas de segurança, siga [SECURITY.md](../../SECURITY.md).

## Licença

O Yggit é um software de código aberto licenciado sob a [Licença MIT](../../LICENSE).
