# Yggit Agent — Skill、MCP、任务流追踪与服务诊断 PRD

> 版本：V1.1  
> 类型：产品需求文档（PRD）  
> 状态：方案定稿，分阶段实施推进（Token 统计部分暂缓并移除，优先聚焦于 Skill、MCP、Task 链路追踪与服务诊断）  
> 所属模块：Git Agent 智能扩展 / 开放协议连接 / 任务追溯与服务诊断 / 双模统一驱动

---

## 1. 项目背景与目标

### 1.1 现状与团队协作核心痛点

现有的 Yggit Agent 具备基础的 Git 上下文理解和会话交互能力，但在实际工程与深度 Git 协作场景中，面临以下瓶颈：

1. **专业知识与团队规约无法沉淀复用**：
   - 不同的项目和团队有着截然不同的 Code Review 规范、Commit Message 格式标准（如 Conventional Commits、Angular 规范）以及特定语言的并发安全/排障 SOP。
   - 目前 Agent 只能依靠用户在每次 Prompt 里临时输入长篇背景指令，缺乏持久化、团队级沉淀的**专业知识与操作流程（Skill）**。
2. **缺乏标准化的外部生态工具连接**：
   - Git 研发流往往与外部系统紧密相关（如 GitHub/GitLab Issue、CI/CD 构建日志、代码静态扫描 Lint 服务、内部脚手架）。
   - Agent 缺乏标准的外部工具连接协议，无法安全、无侵入地调用用户已有的第三方工具或微服务。
3. **Agent 执行黑盒，排错与反馈成本高**：
   - Agent 在会话中执行工具或多步思考时，用户无法看清内部步骤（如匹配了什么 Skill、发起了什么 Tool Call、入参和结果是什么）。
   - 遇到异常时缺少结构化诊断日志，无法一键生成标准化 Issue 报告以反馈问题。

> **说明**：关于 Token 消耗统计看板部分，经评估现阶段优先打通技能、工具与诊断链路，统计部分暂不处理、先行移除，后续根据需要再独立规划。

### 1.2 核心目标与定位

为 Yggit Agent 增加 Skill、MCP 扩展能力、任务执行链路追踪及统一服务诊断日志，让用户能够为 Agent 自由配置专业知识、工作流程及外部工具。

**核心定位**：

- **Skill**：告诉 Agent 应该如何完成特定任务（规约、知识、工作流）。
- **MCP**：为 Agent 提供可以调用的标准化外部工具和外部数据。
- **Agent**：根据用户任务意图自动匹配 Skill，并按需调用对应的 MCP 工具。
- **Tasks & Diagnostics**：白盒化追踪任务执行步骤（Skill 匹配 ➔ LLM 回合 ➔ Tool 执行），集中管理服务诊断日志并支持一键导出脱敏 Issue 报告。
- **最终定位**：**Yggit 提供 Agent Runtime、Skill 管理和 MCP 连接能力，而不是成为 Skill 或 MCP 的集中云端托管平台。**

---

## 2. 整体架构与设计原则

```text
                           Yggit Agent
                                |
                 +--------------+--------------+
                 |                             |
            Skill Engine                   MCP Client
                 |                             |
           Skill Registry              MCP Server Manager
                 |                             |
      +----------+----------+       +----------+----------+
      |          |          |       |          |          |
    Preset     Local      GitHub   HTTP Srv   WebMCP   OAuth/Bearer
      |          |          |       |          |          |
      +----------+----------+       +----------+----------+
                 |                             |
                 +--------------+--------------+
                                |
                          Agent Runtime
                                |
                         Yggit Core API
                                |
            +-------------------+-------------------+
            |                                       |
       EDGE Runtime                            LOCAL Runtime
    Browser / IndexedDB                     Local Companion
   Web FS Access / Fetch                    Local Storage / Git
            |                                       |
            +-------------------+-------------------+
                                |
                        Settings Center UI
             (/settings/skills, mcp, tasks, logs)
```

### 2.1 六大设计原则

1. **来源无关 (Source Agnostic)**：Skill 不绑定特定的存储方式，支持 Local 本地文件、GitHub 仓库，未来预留 Remote 市场/企业源。
2. **运行环境无关 (Runtime Agnostic)**：EDGE（纯浏览器）和 LOCAL（本地伴侣）使用统一的 Skill 与 MCP 数据结构与接口。
3. **协议标准化 (Protocol Standard)**：
   - Skill 严格遵循 [Agent Skills](https://agentskills.io/) 开放标准，以 `SKILL.md`（带 YAML Frontmatter）为核心。
   - MCP 严格遵循官方 [Model Context Protocol](https://modelcontextprotocol.io/) 规范，采用 JSON-RPC 2.0 over Streamable HTTP，不自行发明私有协议。
4. **用户数据绝对本地化 (Zero Cloud Data Leakage)**：
   - 源代码、Git Diff、提交历史、分析结果不上传 Yggit 官方服务器。
   - Skill 私有内容、MCP 访问 Token 与凭据均保存在用户本地设备（浏览器 IndexedDB 或本地系统存储）。
5. **渐进式按需加载 (Progressive Loading)**：
   - Agent 上下文控制：第一阶段只读取 Skill 名称与描述；意图匹配命中后再完整注入 `SKILL.md` 指南；外部工具按任务动态过滤，杜绝上下文浪费与模型幻觉。
6. **权限最小化 (Least Privilege)**：
   - 默认只读权限；高风险工具、文件写入、Git 提交等写操作必须具备明确的授权开关与确认机制。

---

## 3. Skill 系统详细设计

### 3.1 Skill 定位与格式规范

Skill 是 Agent 的专业知识和工作流程扩展，采用开放标准以 `SKILL.md` 为核心，头部包含 YAML Frontmatter：

```markdown
---
name: Git Code Review
description: Review pull request diffs focusing on architecture, edge cases, and maintainability.
tags: ['git', 'code-review', 'quality']
---

# Git Code Review Skill Guidelines

...
```

### 3.2 Skill 来源支持

1. **Preset 内置技能（开箱即用）**：
   - **Git Code Review**：代码审查规范与清单。
   - **Git Conflict Analysis**：代码冲突成因溯源与安全合并策略。
   - **Conventional Commits Crafting**：语义化 Commit 信息自动生成规约。
2. **Local Skill（本地导入）**：
   - EDGE 模式支持手动粘贴输入 `SKILL.md` 源码或通过本地文件上传导入，存入 IndexedDB (`yggit_skills_store`)。
   - LOCAL 模式直接读取用户授权的本地目录。
3. **GitHub Skill（代码仓挂载）**：
   - 支持 Public（免鉴权直读）与 Private（PAT / 授权）仓库。
   - 支持指定 Repository、分支与目录，支持检查更新。
4. **Remote Skill（预留）**：
   - 预留企业内部 Skill Registry 与第三方市场接口。

---

## 4. MCP 系统详细设计

### 4.1 MCP 定位与协议范围

- **传输层**：Streamable HTTP（遵循标准 Content-Type 与流式传输规范）。
- **协议握手**：MCP `initialize` 握手协商与版本对齐。
- **功能特性**：
  - `tools/list`：工具清单与 JSON Schema 参数发现。
  - `tools/call`：工具调用执行与结果解析。
  - `resources/list`：外部上下文资源发现。
  - `prompts/list`：预置提示词模板发现。
- **认证机制**：支持 `none`、`bearer` 及 `oauth`（预留）。
- **WebMCP 探测**：自动嗅探浏览器宿主 `window.modelContext` / `navigator.modelContext`。
- **命名空间与分发**：外部工具以 `mcp__{serverId}__{toolName}` 格式命名，支持单项启用/禁用 Toggle，并在调用时自动隔离异常与超时。

---

## 5. EDGE 与 LOCAL 双模兼容矩阵

| 维度               | EDGE 模式 (Web / Browser)                     | LOCAL 模式 (Companion)           |
| :----------------- | :-------------------------------------------- | :------------------------------- |
| **运行宿主**       | 任意现代浏览器 (Zero-install)                 | 本地伴侣守护进程 (Node / Go)     |
| **Skill 本地导入** | File System Access API / 手动录入             | 直接读取本地磁盘路径             |
| **Skill 持久化**   | 浏览器 IndexedDB (`yggit_skills_store`)       | 本地文件与磁盘存储               |
| **GitHub 访问**    | 前端原生 fetch 直连 (CORS / Proxy)            | 本地网络环境直连                 |
| **HTTP MCP 传输**  | Streamable HTTP (需允许跨域 CORS)             | 本地 HTTP / 局域网服务无阻断直连 |
| **STDIO MCP**      | 不支持 (浏览器沙箱限制)                       | 支持通过本地子进程执行           |
| **服务日志**       | 内存环形缓冲 + IndexedDB (`yggit_logs_store`) | 本地日志文件 + 内存缓冲          |
| **数据隐私保证**   | 源码、Diff、Token 绝对不离设备                | 源码、Diff、Token 绝对不离设备   |

---

## 6. 任务追踪与服务诊断

### 6.1 Agent Task 任务执行流追踪

- **全生命周期管理**：当 Agent 接收复杂任务时生成 `AgentTask` 实体，状态流转：`pending` ➔ `running` ➔ `completed` / `failed`。
- **步骤流水线追踪 (`AgentTaskStep`)**：
  1. `skill_match`：匹配到的技能名称与匹配原因。
  2. `llm_turn`：大模型推理回合与提示词摘要。
  3. `tool_call`：调用的工具名称（原生或 MCP）、传入参数与执行返回结果。
  4. `artifact`：生成的代码差异或分析报告。
- **可视化时间轴**：在设置中心提供时间轴展开视图，展示各步骤耗时与状态。

### 6.2 统一服务日志与一键 Issue 导出

- **模块分级记录**：集中捕获 `agent`, `mcp`, `skill`, `git`, `system` 五大模块的日志。
- **实时过滤与检索**：支持按级别（Info/Warn/Error）与模块筛选，支持实时关键词过滤。
- **一键 Issue 反馈 (Copy for Issue)**：
  - 点击按钮自动收集最近的报错日志与运行环境信息。
  - **自动脱敏**：强制过滤所有 GitHub PAT、Bearer Token、私有仓库地址与敏感路径。
  - 生成标准 Markdown 模版，一键复制即可粘贴到 GitHub / GitLab 提交 Bug Issue。

---

## 7. UI 信息架构与设置中心页面

在 Yggdrasil 设置中心（`/settings`）左侧导航整合四大专属板块，严格遵循 Calm Ops 规范与 `react-icons` 规范：

```text
Settings Navigation
├── General
├── Models
├── Skills (/settings/skills)
│   ├── Installed Skills List (Status, Source, Version, Toggle)
│   ├── Add Local Skill Modal (Name, Description, Markdown Editor)
│   ├── Connect GitHub Modal (Repo, Branch, Directory, PAT)
│   └── View SKILL.md Modal (Rendered Markdown + YAML Header)
├── MCP Servers (/settings/mcp)
│   ├── WebMCP Native Status Banner
│   ├── Server Cards (URL, Transport, Auth, Status, Toggle)
│   ├── Add Server Modal (URL, Bearer Token, Transport)
│   └── Tools Drawer (Parameters Schema, Enable/Disable per Tool)
├── Tasks (/settings/tasks)
│   ├── Task Overview Cards (Duration, Status)
│   └── Execution Steps Timeline (Skill Match, Turns, Tool Calls)
└── Logs (/settings/logs)
    ├── Level & Module Filters
    ├── Real-time Log Stream Viewer
    └── Copy Issue Report Button
```

---

## 8. 实施计划与交付路线图

| 里程碑                     | 目标与交付范围                                                                                                                                                            | 状态       |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- |
| **Milestone 1 (已就绪)**   | **V1 核心闭环**：`SKILL.md` 解析与 Preset 预设；Streamable HTTP MCP 客户端与动态工具路由；Task 分步流水线追踪；服务日志与 Issue 导出；全部 4 个设置面板与自动化单元测试。 | **已交付** |
| **Milestone 2 (下一阶段)** | **外部生态与鉴权深化**：GitHub 仓库多级目录递归扫描（支持 `agent-skills/` 树结构）；标准 OAuth 2.1 PKCE 鉴权；WebMCP 浏览器原生 API 深度桥接。                            | 规划中     |
| **Milestone 3 (中期待建)** | **策略与容灾优化**：结合 Git 分支与 Diff 语义的多维启发式 Skill 匹配评分；MCP 工具故障自愈重试。                                                                          | 规划中     |
| **Milestone 4 (长期演进)** | **Local 伴侣增强**：本地文件目录监听（`chokidar`）实现 `SKILL.md` 热重载；企业内网私有 Skill/MCP Registry 离线离网同步。                                                  | 规划中     |

---

## 9. 验收标准

### 9.1 Skill 验收标准

- [x] 支持手动输入或导入本地 `SKILL.md` 并正确解析 Frontmatter。
- [x] 支持配置 GitHub 仓库并拉取 `SKILL.md`。
- [x] 开箱提供 3 款内置预设且支持自由启停。
- [x] 对话时自动匹配相关 Skill 并动态注入 System Prompt。
- [x] Skill 内容保存在用户本地，不上传云端。

### 9.2 MCP 验收标准

- [x] 支持添加符合 JSON-RPC 2.0 的 HTTP MCP 服务并完成 `initialize`。
- [x] 成功发现工具列表与参数 Schema，支持个别工具独立启停。
- [x] 支持 Bearer Token 鉴权，密钥保存在本地。
- [x] Agent 触发 Tool Call 时正确路由到目标 MCP Server 并回传结果。
- [x] 单个 MCP 超时或失败时具备隔离降级，不导致会话崩溃。

### 9.3 任务与日志验收标准

- [x] 任务流水线能够分步记录 Skill 匹配、LLM 推理与 Tool 调用入参结果。
- [x] 日志覆盖 5 大模块，支持关键词检索。
- [x] Issue 报告一键生成且彻底脱敏。
