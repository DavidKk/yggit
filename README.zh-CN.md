[![中文](https://img.shields.io/badge/%E6%96%87%E6%A1%A3-%E4%B8%AD%E6%96%87-green?style=flat-square&logo=docs)](https://github.com/DavidKk/yggit/blob/main/README.zh-CN.md) [![English](https://img.shields.io/badge/docs-English-green?style=flat-square&logo=docs)](https://github.com/DavidKk/yggit/blob/main/README.md) [![Node.js](https://img.shields.io/badge/node-%3E%3D22.19-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org/) [![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)

# Yggit (世界树 Git)

**Yggit**（世界树 Git）将传统的生硬工业网格 Git 提交图升级为**有机生命树网络**。基于 Next.js 16、React 19 与 Tailwind CSS 4 构建，提供高性能、Local-first 的 Git 图谱可视化、AI 仓库助手（**Yggi**）、工作台诊断以及可扩展的 Skills 与 MCP 工具能力。

运行形态：

| 形态             | 方式                                       | 磁盘与 Git 能力                                                                              |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Local**        | 本机 Node.js 服务贴着仓库目录运行          | 完整原生 Git CLI、本地磁盘读写、加密本地存储及本机 CLI Agent 适配                            |
| **Edge / Cloud** | Vercel / 浏览器（`VERCEL=1` 或 Edge 驱动） | 服务端无盘——在 Chromium 浏览器中通过 File System Access API 与 `isomorphic-git` 读取本地仓库 |

## 核心特性

- **世界树有机生命图谱** — 三次贝塞尔曲线分支汇合、主干与侧枝粗细分级与双色渐变汇流、零高度缝隙日期分割线，以及语义化节点呈现（虚线 Stash 胶囊、HEAD 呼吸光环与交汇点年轮结）。
- **Yggi AI 仓库助手** — 支持可拖拽悬浮药丸、快速答复卡片与可调节宽度的侧边栏工作区；支持引用追问、AI Commit 信息生成，以及 **Agent 聚焦巡检（Spotlight）**（附带 Fact / Derived / Hypothesis 归因证据分级）。
- **多层模型与运行时生态** — 原生支持 **Browser AI**（Chrome 内置 Gemini Nano）、**浏览器离线模型**（WebGPU / WASM）、本机 **CLI Agent**（Claude、Codex、Gemini、Cursor、Antigravity CLI）以及 **OpenAI 兼容 / DeepSeek / Claude / Ollama** 渠道，并支持通配符黑白名单过滤。
- **Agent 技能库 (`SKILL.md`) 与 HTTP MCP** — 支持导入本地 `SKILL.md` 或关联 GitHub 仓库自动同步；支持接入外部 **Streamable HTTP MCP Server**，提供自定义请求头与 **MCP OAuth 2.0 (PKCE)** 授权及单工具粒度开关。
- **工作台与仓库健康诊断** — 自动检测分支同步状态、未合入提交、仓库卫生规范与三方合并冲突分析。
- **可定制右键菜单** — 支持高频动作置顶、二级子菜单分组管理、危险操作二次确认防误触保护，以及基于仓库运行能力的动态自适应过滤。
- **开发者可观测性** — 内置 `/dev/logs/operations` 与 `/dev/logs/context` 诊断视图，支持多级别日志筛选、Agent 上下文追踪与一键导出诊断报告。
- **10 种语言全球化本地化** — 全量支持简体中文、英语、繁体中文、日语、韩语、法语、德语、西班牙语、巴西葡萄牙语与俄语。
- **数据本地化与隐私优先** — 密钥与凭据均经本地加密保存，无需注册账号，不收集任何个人配置信息。

## 部署到 Vercel（Cloud / Edge）

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDavidKk%2Fyggit)

在 Vercel 上运行时，Yggit 自动切换为 **Edge / 浏览器** 模式：云端仅提供界面服务，仓库目录读取与 `isomorphic-git` 操作全部在本地浏览器中通过 File System Access API 完成。

1. 将 [DavidKk/yggit](https://github.com/DavidKk/yggit) 导入 Vercel（或点击上方按钮）。
2. 框架预设选择 **Next.js**，构建命令：`pnpm build`。
3. 部署完成后使用 Chrome 或 Microsoft Edge 打开站点，授权本地 Git 仓库目录即可使用。

## 本地开发

需要 **Node.js ≥ 22.19.0** 与 **pnpm**。

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)（或启动日志输出的局域网地址）即可开始使用。

| 命令                | 用途                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm dev`          | 启动本地开发服务（默认监听局域网）                                                                       |
| `pnpm dev:lan`      | 显式以局域网模式启动开发服务                                                                             |
| `pnpm dev:loopback` | 仅监听本机回环地址（`127.0.0.1`）                                                                        |
| `pnpm build`        | 构建生产产物（`next build --webpack`）                                                                   |
| `pnpm start`        | 启动生产服务                                                                                             |
| `pnpm ok`           | 一键执行 `fix:imports`、Prettier 格式化、ESLint（`--max-warnings=0`）、类型检查、Jest 全量测试与生产构建 |
| `pnpm ok:ci`        | CI 校验流水线（`format:check`、`lint:check`、`typecheck`、Jest 测试、生产构建）                          |

GitHub Actions：[CI](.github/workflows/ci.yml) 会在 `main` 分支与 PR 上自动运行校验。

开发文档索引：[docs/README.md](docs/README.md)。

## 目录结构

```text
yggdrasil/
  app/          Next.js App Router 页面与 API 路由
  components/   Git 图谱、Yggi AI 工作区、工作台、开发者日志与设置界面
  hooks/        共享 React Hooks
  lib/          Agent 运行时、多语言文案、Git 辅助工具、日志与安全模块
  services/     Git 服务层与工程脚本
  docs/         PRD、UX 设计与技术架构文档
  data/         本地运行时数据与缓存（已 gitignore）
```

## 隐私说明

Yggit 无需登录账号，不收集任何可识别个人身份的信息。本地模式下，仓库数据、缓存与加密凭据均严格保存在您的设备本地；对第三方大模型或远程 MCP 服务的请求仅按您配置的地址直接发起。完整内容见应用内 `/privacy` 页面。

## 开源协议

Yggit 是基于 [MIT 许可证](./LICENSE) 发布的开源项目。
