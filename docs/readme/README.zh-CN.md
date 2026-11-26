<div align="center">

<img src="../../public/world-tree-assets/hero/hero_day_master_1672x941.webp" alt="Yggit — 世界树架构 AI Git 工作空间" width="840" />

# Yggit (世界树 Git)

**Your Git history, brought to life.**

可视化 Git 提交历史、管理多 Worktree、主动发现仓库问题，并借助 AI 理解你的代码。专为 AI 编程时代打造的开源、本地优先（Local-first）Git 工作空间。

**免安装 · 免注册 · 开源免费 · 本地优先**

<p>
  <a href="https://yggit.vercel.app"><strong>在线体验</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/DavidKk/yggit/releases"><strong>下载客户端</strong></a>
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

## 为什么选择 Yggit？

现代开发越来越多地涉及多仓库协同、并行分支、独立 Worktree 以及多个 AI 编程 Agent 同时改动代码。传统 Git 客户端往往只停留在生硬的地铁线路图或基础 Diff 查看。

Yggit 将**有机世界树提交图谱**、**主动式仓库健康诊断**与**开放的本地优先 AI 助手**融合在同一个工作空间中——支持直接在浏览器打开、作为本机 Server 运行，或打包为独立桌面客户端使用。

---

## 核心能力

### Git, brought to life — 世界树 Git 历史可视化

告别冰冷的工业网格，用**有机生命树 DAG** 呈现代码演进脉络。三次贝塞尔曲线分支汇合、主干与侧枝粗细分级、零高度缝隙日期分割线，以及语义化节点标识（虚线 Stash 胶囊、HEAD 呼吸光环与合并年轮结），让复杂分支历史一目了然。

### Meet Yggi — 内置 AI 仓库助手

支持可拖拽悬浮药丸、快速答复卡片与可调节宽度的侧边栏工作区。随时询问分支统计、提交历史或合并状态，一键生成 Commit 信息、引用消息追问，并在图谱上通过 **Agent Spotlight** 查看带有 Fact / Derived / Hypothesis 证据分级的提交标注。

### Stay ahead of Git problems — Workdesk 主动诊断

**工作台（Workdesk）** 持续扫描当前仓库的分支同步偏差、待推送代码审查、分叉偏离、并行 Worktree 冗余以及分支命名与目录规范问题，在演变成合并冲突前提前发现并给出可执行建议。

### One workspace, many repositories — 多项目与 Worktree 管理

在多个本地/远程仓库间快速切换，并支持高度可定制的分支右键菜单：高频动作置顶、二级子菜单分组、危险操作二次确认防误触保护，以及基于仓库运行能力的自适应过滤。

### Your code stays yours — 本地优先与隐私保护

**默认 Local-first**：仓库索引、缓存与加密后的 API 凭据均保存在你的本地设备中；并内置端侧敏感信息双向脱敏机制，在向第三方模型发起请求前自动掩盖密钥、邮箱与自定义敏感词。

### Bring your own AI — 开放的 AI 模型与工具生态

自由接入你习惯的模型与工作流，不被单一厂商绑定：

- **Browser AI** — Chrome 内置 Gemini Nano。
- **Browser Local AI** — 基于 WebGPU / WASM 的浏览器离线开源模型。
- **本机 CLI Agent** — 适配 Claude、Codex、Gemini、Cursor、Antigravity CLI。
- **OpenAI 兼容与主流 API** — 支持 DeepSeek、OpenAI、Claude、Ollama 及自定义网关，支持通配符黑白名单过滤。
- **Skills 与 HTTP MCP** — 支持导入本地或 GitHub 上的 `SKILL.md` 规范，接入外部 Streamable HTTP MCP Server（支持自定义请求头与 MCP OAuth 2.0 PKCE 授权）。

---

## 专为 AI 编程时代设计

当多个 AI Agent 同时在不同分支和 Worktree 上并行开发时，仓库状态极易失控。Yggit 帮你稳住全局：

- **多 Agent 与多 Worktree 可视化** — 统一追踪并行工作树、未合入提交与分支偏离状态。
- **主动同步与冲突预警** — 提前识别落后/领先提交、待审查变更与三方合并冲突风险。
- **AI 辅助理解 Diff 与脉络** — 让 Yggi 梳理改动影响、追踪合并来源，并在图谱上直接高亮关键提交。
- **10 种语言全球化界面** — 完整支持简体中文、英语、繁体中文、日语、韩语、法语、德语、西班牙语、巴西葡萄牙语与俄语。

---

## 三种运行形态

Yggit 提供三种运行形态（`YGGIT_SERVICE`），共享同一套工作台体验：

| 形态               | 方式                                          | 磁盘与 Git 能力                                                                              |
| ------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Local**          | 本机 Node.js 服务贴着仓库目录运行             | 完整原生 Git CLI、本地磁盘读写、加密本地存储及本机 CLI Agent 适配                            |
| **Desktop App**    | 独立桌面客户端打包形态（`YGGIT_SERVICE=app`） | 完整原生 Git CLI、本地磁盘读写与桌面宿主集成                                                 |
| **Edge / Browser** | 浏览器免安装形态（`YGGIT_SERVICE=remote`）    | 服务端无盘——在 Chromium 浏览器中通过 File System Access API 与 `isomorphic-git` 读取本地仓库 |

---

## 隐私设计原则

- **无需注册账号**：打开即可使用，零遥测、零账号绑定。
- **数据留在本地**：仓库数据、分析缓存与加密后的 Token 均保存在你自己的设备上。
- **明确的外部边界**：仅向你主动配置的第三方大模型或远程 MCP 地址发起请求，并可选开启端侧可逆脱敏。详见应用内 `/settings/privacy` 页面。

---

## 快速上手

需要 **Node.js ≥ 22.19.0** 与 **pnpm**。

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)（或启动日志输出的局域网地址）即可开始使用。

<details>
<summary>展开查看完整开发、测试与桌面 App 打包命令</summary>

| 命令                | 用途                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm dev`          | 启动本地开发服务（默认监听局域网）                                                                       |
| `pnpm dev:lan`      | 显式以局域网模式启动开发服务                                                                             |
| `pnpm dev:loopback` | 仅监听本机回环地址（`127.0.0.1`）                                                                        |
| `pnpm build`        | 构建生产产物（`next build --webpack`）                                                                   |
| `pnpm build:app`    | 构建桌面 App standalone 产物并组装 `.electron-builder/app-root`                                          |
| `pnpm dist:mac`     | 打包 macOS `.app` 与发布 `.zip`（`x64` + `arm64`）                                                       |
| `pnpm dist:win`     | 打包 Windows NSIS 安装包（`.exe`）                                                                       |
| `pnpm dist:dir`     | 打包免安装桌面应用目录（用于本地验证）                                                                   |
| `pnpm electron`     | 启动 Electron 桌面壳（连接 Next 开发服务）                                                               |
| `pnpm start`        | 启动生产服务                                                                                             |
| `pnpm ok`           | 一键执行 `fix:imports`、Prettier 格式化、ESLint（`--max-warnings=0`）、类型检查、Jest 全量测试与生产构建 |
| `pnpm ok:ci`        | CI 校验流水线（`format:check`、`lint:check`、`typecheck`、Jest 测试、生产构建）                          |

</details>

## 文档索引

- [开发与架构文档索引](../README.md) — 包含 PRD、UX 规范、技术架构与代码规范。

## 参与贡献

欢迎提交 Issue 与 Pull Request！贡献前请先阅读 [CONTRIBUTING.md](../../CONTRIBUTING.md)，安全漏洞反馈请参考 [SECURITY.md](../../SECURITY.md)。

## 开源协议

Yggit 是基于 [MIT 许可证](../../LICENSE) 发布的开源项目。
