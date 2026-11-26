<div align="center">

<img src="../../public/world-tree-assets/hero/hero_day_master_1672x941.webp" alt="Yggit — Espacio de trabajo Git con IA Open Source y grafo Árbol del Mundo" width="840" />

# Yggit

**Your Git history, brought to life.**

Visualiza el historial de Git, gestiona worktrees, detecta problemas en tus repositorios y comprende tu código con IA. Un espacio de trabajo Git open source y local-first pensado para la era del desarrollo con IA.

**Sin instalación · Sin registro · Open Source · Local-first**

<p>
  <a href="https://yggit.vercel.app"><strong>Probar online</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/DavidKk/yggit/releases"><strong>Descargar App</strong></a>
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

## ¿Por qué Yggit?

El desarrollo moderno implica múltiples repositorios, ramas paralelas, worktrees aislados y agentes de IA trabajando al mismo tiempo. Los clientes Git tradicionales suelen quedarse en cuadrículas rígidas o simples visores de diffs.

Yggit reúne **un grafo orgánico de commits**, **diagnósticos proactivos de repositorios** y **un asistente IA abierto y local-first** en un solo espacio de trabajo — ejecutable en el navegador, como servidor local o como aplicación de escritorio independiente.

---

## Características principales

### Git, brought to life — Visualización Árbol del Mundo

Reemplaza las cuadrículas industriales por un **DAG orgánico en Árbol del Mundo**: curvas Bézier cúbicas suaves, jerarquía visual entre tronco y ramas secundarias, divisores de fecha sin huecos y nodos semánticos (cápsulas Stash, anillo HEAD y nodos de fusión).

### Meet Yggi — Asistente IA de repositorios

Disponible como píldora flotante arrastrable, tarjeta de respuesta rápida o panel lateral redimensionable. Consulta estadísticas de ramas, diffs o fusiones, genera mensajes de commit, cita respuestas y revisa anotaciones **Agent Spotlight** con niveles de evidencia Fact / Derived / Hypothesis.

### Stay ahead of Git problems — Diagnósticos Workdesk

**Workdesk** analiza continuamente tus repositorios activos para detectar desfases de sincronización, commits sin push pendientes de revisión, ramas divergentes, worktrees paralelos y problemas de nomenclatura antes de que provoquen conflictos.

### One workspace, many repositories — Multirrepositorio y Worktrees

Cambia fácilmente entre repositorios locales y remotos y personaliza el menú contextual de ramas: acciones rápidas fijadas, submenús en cascada, doble confirmación para acciones destructivas y filtrado adaptativo.

### Your code stays yours — Local-first y privacidad

**Local-first por diseño**: índices, cachés y credenciales cifradas permanecen en tu dispositivo, con redacción reversible en el cliente para tokens, correos y secretos personalizados antes de enviar prompts a proveedores externos.

### Bring your own AI — Ecosistema abierto de IA y MCP

Conecta tus modelos favoritos sin ataduras:

- **Browser AI** — Gemini Nano integrado en Chrome.
- **Browser Local AI** — Modelos open source offline con WebGPU / WASM en el navegador.
- **Agentes CLI locales** — Adaptadores para Claude, Codex, Gemini, Cursor y Antigravity CLI.
- **APIs compatibles con OpenAI y Cloud** — DeepSeek, OpenAI, Claude, Ollama y gateways propios con filtros wildcard de lista blanca/negra.
- **Skills y HTTP MCP** — Importa flujos `SKILL.md` (locales o GitHub) y conecta servidores Streamable HTTP MCP con cabeceras personalizadas o MCP OAuth 2.0 (PKCE).

---

## Diseñado para AI Coding

Cuando varios agentes de IA trabajan en paralelo sobre distintas ramas y worktrees, el estado de Git se vuelve complejo rápidamente. Yggit te ayuda a mantener el control:

- **Visibilidad paralela de Worktrees y Agentes** — Supervisa worktrees activos, commits sin fusionar y divergencias en un único lugar.
- **Detección proactiva de sincronización y conflictos** — Detecta desfases y riesgos de conflicto de fusión a 3 vías con antelación.
- **Comprensión de Diffs e historial con IA** — Resume cambios y rastrea dónde se fusionó cada commit directamente en el grafo.
- **Interfaz en 10 idiomas** — Inglés, chino simplificado y tradicional, japonés, coreano, francés, alemán, español, portugués brasileño y ruso.

---

## Modos de ejecución

Yggit funciona en tres modos (`YGGIT_SERVICE`) compartiendo la misma experiencia:

| Modo               | Cómo funciona                                           | Acceso a disco y Git                                                                                         |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Local**          | Servidor Node.js junto a tus repositorios               | Git CLI nativo completo, acceso local a archivos, almacenamiento cifrado y adaptadores CLI locales           |
| **Desktop App**    | Aplicación Electron independiente (`YGGIT_SERVICE=app`) | Git CLI nativo completo, acceso local a archivos e integración de escritorio                                 |
| **Edge / Browser** | Modo navegador sin instalación (`YGGIT_SERVICE=remote`) | Sin disco en servidor — abre carpetas locales en Chromium mediante File System Access API (`isomorphic-git`) |

---

## Privacidad por diseño

- **Sin cuenta obligatoria**: Úsalo al instante sin registro ni telemetría.
- **Almacenamiento local-first**: Índices, cachés y tokens cifrados permanecen en tu equipo.
- **Fronteras externas explícitas**: Las peticiones solo se envían a los endpoints LLM o MCP que tú configures, con redacción opcional en el cliente. Consulta `/settings/privacy` en la aplicación.

---

## Primeros pasos

Requiere **Node.js ≥ 22.19.0** y **pnpm**.

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) (o la URL LAN mostrada al iniciar).

<details>
<summary>Comandos de desarrollo, pruebas y empaquetado Desktop App</summary>

| Comando             | Propósito                                                                             |
| ------------------- | ------------------------------------------------------------------------------------- |
| `pnpm dev`          | Inicia el servidor de desarrollo (escucha en LAN por defecto)                         |
| `pnpm dev:lan`      | Servidor de desarrollo LAN explícito                                                  |
| `pnpm dev:loopback` | Servidor solo en loopback (`127.0.0.1`)                                               |
| `pnpm build`        | Compila el bundle de producción de Next.js                                            |
| `pnpm build:app`    | Compila el bundle App standalone y prepara `.electron-builder/app-root`               |
| `pnpm dist:mac`     | Empaqueta `.app` para macOS y `.zip` (`x64` + `arm64`)                                |
| `pnpm dist:win`     | Empaqueta el instalador NSIS para Windows (`.exe`)                                    |
| `pnpm dist:dir`     | Empaqueta el directorio de la app sin comprimir para pruebas locales                  |
| `pnpm electron`     | Ejecuta Electron conectado al servidor de desarrollo Next                             |
| `pnpm start`        | Inicia el servidor de producción                                                      |
| `pnpm ok`           | Ejecuta `fix:imports`, Prettier, ESLint (`--max-warnings=0`), typecheck, Jest y build |
| `pnpm ok:ci`        | Verificación completa de CI                                                           |

</details>

## Documentación

- [Índice de documentación](../README.md) — Especificaciones de arquitectura, PRDs, guías UX y estándares de código.

## Contribuir

¡Las contribuciones son bienvenidas! Lee [CONTRIBUTING.md](../../CONTRIBUTING.md) antes de abrir un Pull Request y usa las plantillas de [GitHub Issues](https://github.com/DavidKk/yggit/issues). Para reportar vulnerabilidades de seguridad, sigue [SECURITY.md](../../SECURITY.md).

## Licencia

Yggit es software de código abierto publicado bajo la [Licencia MIT](../../LICENSE).
